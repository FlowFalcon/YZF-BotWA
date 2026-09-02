import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { createSettingsStore } from '../../lib/settings.js'

const dirs: string[] = []

async function settingsPath(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'yzf-settings-'))
  dirs.push(dir)
  return path.join(dir, 'settings.json')
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('settings store', () => {
  it('uses owner-only as the safe migration default when settings do not exist', async () => {
    const store = await createSettingsStore(await settingsPath())

    expect(store.getMode()).toBe('owner-only')
  })

  it('uses owner-only when an old or corrupt settings file has no valid mode', async () => {
    const file = await settingsPath()
    await writeFile(file, JSON.stringify({ public: true, gconly: true }), 'utf8')

    const store = await createSettingsStore(file)

    expect(store.getMode()).toBe('owner-only')
  })

  it('persists a mode atomically and loads it after restart', async () => {
    const file = await settingsPath()
    const store = await createSettingsStore(file)

    await store.setMode('group-only')

    expect(store.getMode()).toBe('group-only')
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({ mode: 'group-only' })
    expect((await createSettingsStore(file)).getMode()).toBe('group-only')
  })

  it('serializes concurrent writes so the final in-memory mode matches disk', async () => {
    const file = await settingsPath()
    const store = await createSettingsStore(file)

    await Promise.all([store.setMode('public'), store.setMode('owner-only')])

    expect(store.getMode()).toBe('owner-only')
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({ mode: 'owner-only' })
  })

  it('keeps memory and disk unchanged and cleans temporary state after rename failure', async () => {
    const file = await settingsPath()
    await writeFile(file, `${JSON.stringify({ mode: 'owner-only' })}\n`, 'utf8')
    const removed: string[] = []
    const store = await createSettingsStore(file, {
      mkdir,
      writeFile,
      rename: () => Promise.reject(new Error('rename failed')),
      rm: async (target, options) => { removed.push(String(target)); await rm(target, options) },
    })
    await expect(store.setMode('public')).rejects.toThrow('rename failed')
    expect(store.getMode()).toBe('owner-only')
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({ mode: 'owner-only' })
    expect(removed).toHaveLength(1)
  })

  it('accepts a retry after a failed settings write', async () => {
    const file = await settingsPath()
    let fail = true
    const store = await createSettingsStore(file, {
      mkdir,
      writeFile: async (...args) => {
        if (fail) { fail = false; throw new Error('write failed') }
        await writeFile(...args)
      },
      rename,
      rm,
    })
    await expect(store.setMode('public')).rejects.toThrow('write failed')
    await store.setMode('group-only')
    expect(store.getMode()).toBe('group-only')
  })

})
