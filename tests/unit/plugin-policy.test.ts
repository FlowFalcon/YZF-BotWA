import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { promoteStagedPlugin, stagePluginSource, validatePluginSources } from '../../lib/commands/plugin-policy.js'

/** The repository itself: the runtime build path validates exactly this tree. */
const PROJECT_ROOT = path.resolve(import.meta.dirname, '../..')

const roots: string[] = []
async function project(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'plugin-policy-'))
  roots.push(root)
  await mkdir(path.join(root, 'plugins'), { recursive: true })
  return root
}

afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))))

describe('validatePluginSources', () => {
  it('accepts trusted TypeScript command source using contract imports', async () => {
    const root = await project()
    await writeFile(path.join(root, 'plugins', 'ping.ts'), `import type { Command } from '../lib/commands/command.js'\nexport default { name: 'ping', category: 'tools', description: 'ping', async run() {} } satisfies Command\n`)
    await expect(validatePluginSources(path.join(root, 'plugins'), root)).resolves.toEqual(['ping.ts'])
  })

  it('accepts every plugin shipped in the repository so the runtime build path can publish them', async () => {
    await expect(validatePluginSources(path.join(PROJECT_ROOT, 'plugins'), PROJECT_ROOT)).resolves.toEqual([
      'games/dino.ts',
      'group/add.ts',
      'group/demote.ts',
      'group/gcdesc.ts',
      'group/gcname.ts',
      'group/group.ts',
      'group/groupmenu.ts',
      'group/hidetag.ts',
      'group/kick.ts',
      'group/linkgroup.ts',
      'group/promote.ts',
      'group/tagall.ts',
      'owner/ban.ts',
      'owner/banchat.ts',
      'owner/banlist.ts',
      'owner/botmode.ts',
      'owner/delpp.ts',
      'owner/delthumbnail.ts',
      'owner/ownermenu.ts',
      'owner/setabout.ts',
      'owner/setname.ts',
      'owner/setpp.ts',
      'owner/setthumbnail.ts',
      'owner/unban.ts',
      'owner/unbanchat.ts',
      'sticker/sticker.ts',
      'tools/hd.ts',
      'tools/menu.ts',
      'tools/ping.ts',
      'tools/qrcode.ts',
      'tools/ssweb.ts',
    ])
  })

  it('rejects symlinks before reading plugin source', async () => {
    const root = await project()
    const outside = path.join(root, 'secret.ts')
    await writeFile(outside, 'secret')
    await symlink(outside, path.join(root, 'plugins', 'linked.ts'))
    await expect(validatePluginSources(path.join(root, 'plugins'), root)).rejects.toThrow('Symlink plugin ditolak: linked.ts')
  })

  it.each([
    ['direct eval', "export default {run(){eval('1')}}"],
    ['aliased eval', "const e = eval; export default {run(){e('1')}}"],
    ['aliased Function', "const F = Function; export default {run(){return new F('return 1')()}}"],
    ['computed global eval', "const e = globalThis['eval']; export default {run(){e('1')}}"],
    ['computed process env', "const secret = process['env']; export default {run(){return secret}}"],
    ['global process env', "const secret = globalThis.process.env; export default {run(){return secret}}"],
    ['require', "const fs = require('node:fs'); export default {run(){return fs}}"],
    ['createRequire', "const m = await import('node:module'); const r=m.createRequire(import.meta.url); export default {run(){}}"],
    ['dynamic child process', "const cp = await import('node:child_process'); export default {run(){return cp}}"],
    ['constructor chain', "export default { name: 'x', category: 'tools', description: 'x', run(){return (()=>{}).constructor('return process.env')()} }"],
    ['computed constructor chain', "export default { name: 'x', category: 'tools', description: 'x', run(){return []['filter']['constructor']('return process.env')()} }"],
    ['class static block', "class X { static { fetch('https://example.invalid') } } export default { name: 'x', category: 'tools', description: 'x', run(){} }"],
    ['metadata getter', "export default { get name(){ fetch('https://example.invalid'); return 'x' }, category: 'tools', description: 'x', run(){} }"],
    ['metadata setter', "export default { name: 'x', category: 'tools', description: 'x', set usage(value){ fetch(String(value)) }, run(){} }"],
    ['computed member access', "export default { name: 'x', category: 'tools', description: 'x', run(context){return context['reply']('x')} }"],
  ])('rejects %s', async (_name, source) => {
    const root = await project()
    await writeFile(path.join(root, 'plugins', 'unsafe.ts'), source)
    await expect(validatePluginSources(path.join(root, 'plugins'), root)).rejects.toThrow()
  })

  it.each([
    "const x = fetch('https://example.com')",
    'const x = new Date()',
    'const x = await Promise.resolve(1)',
    'let x = 1; x = 2',
    'const tag = String.raw; const x = tag`x`',
  ])('rejects unsafe top-level initializer or effect: %s', async (prefix) => {
    const root = await project()
    await writeFile(path.join(root, 'plugins', 'unsafe.ts'), `${prefix}; export default { name: 'x', category: 'tools', description: 'x', run() {} }`)
    await expect(validatePluginSources(path.join(root, 'plugins'), root)).rejects.toThrow(/Top-level|ditolak/)
  })

  it('rejects a relative import whose real path escapes through a symlink', async () => {
    const root = await project()
    const outside = await mkdtemp(path.join(tmpdir(), 'plugin-outside-'))
    roots.push(outside)
    await writeFile(path.join(outside, 'secret.ts'), 'export default 1')
    await symlink(outside, path.join(root, 'bridge'))
    await writeFile(path.join(root, 'plugins', 'unsafe.ts'), "import x from '../bridge/secret.js'; export default { name: 'x', category: 'tools', description: String(x), run() {} }")
    await expect(validatePluginSources(path.join(root, 'plugins'), root)).rejects.toThrow(/symlink|keluar project/i)
  })

  it('stages only normalized TypeScript names without replacing plugins', async () => {
    const root = await project()
    const staged = await stagePluginSource(root, 'safe-plugin', 'export default {}\n')
    expect(staged).toBe(path.join(root, '.runtime', 'plugin-staging', 'safe-plugin.ts'))
    await expect(validatePluginSources(path.join(root, 'plugins'), root)).resolves.toEqual([])
    await expect(stagePluginSource(root, '../escape', 'x')).rejects.toThrow('Nama plugin invalid')
  })

  it('rejects a symlinked staging root without writing outside the project', async () => {
    const root = await project()
    const outside = await mkdtemp(path.join(tmpdir(), 'plugin-staging-outside-'))
    roots.push(outside)
    const sentinel = path.join(outside, 'sentinel')
    await writeFile(sentinel, 'safe')
    await mkdir(path.join(root, '.runtime'))
    await symlink(outside, path.join(root, '.runtime', 'plugin-staging'))

    await expect(stagePluginSource(root, 'safe', 'payload')).rejects.toThrow(/symlink/i)
    expect(await readFile(sentinel, 'utf8')).toBe('safe')
    await expect(readFile(path.join(outside, 'safe.ts'), 'utf8')).rejects.toThrow()
  })

  it('promotes staged source only after validation without premature overwrite', async () => {
    const root = await project()
    const target = path.join(root, 'plugins', 'safe-plugin.ts')
    await writeFile(target, 'old')
    const staged = await stagePluginSource(root, 'safe-plugin', 'new')
    await expect(promoteStagedPlugin(root, 'safe-plugin', staged, () => Promise.reject(new Error('invalid')))).rejects.toThrow('invalid')
    expect(await readFile(target, 'utf8')).toBe('old')
    await promoteStagedPlugin(root, 'safe-plugin', staged, () => Promise.resolve())
    expect(await readFile(target, 'utf8')).toBe('new')
  })
})
