import { execFile } from 'node:child_process'
import { access, mkdir, mkdtemp, readFile, readdir, rename, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const execFileAsync = promisify(execFile)
import { loadCommands } from '../../lib/commands/loader.js'
import { buildPluginRegistry } from '../../lib/commands/runtime-plugin-build.js'
import { createReloadableRegistry } from '../../lib/commands/reloadable-registry.js'

function fixtureDir(name: string): string {
  return fileURLToPath(new URL(`../fixtures/features/${name}/`, import.meta.url))
}

// Vitest mengimpor source TypeScript; production memuat hasil compile `.js`.
const EXTENSION = '.ts'

describe('loadCommands', () => {
  it('discovers commands in nested directories', async () => {
    const registry = await loadCommands(fixtureDir('good'), { extension: EXTENSION })

    expect(registry.list().map((command) => command.name)).toEqual(['dice', 'ping'])
    expect(registry.get('p')?.name).toBe('ping')
    expect(registry.get('dadu')?.name).toBe('dice')
  })

  it('names the offending file when a default export is not a command', async () => {
    await expect(loadCommands(fixtureDir('invalid'), { extension: EXTENSION })).rejects.toThrow(
      /not-a-command\.ts" harus memiliki default export berupa Command/,
    )
  })

  it('fails the whole load on duplicate triggers, naming both sources', async () => {
    await expect(
      loadCommands(fixtureDir('duplicate'), { extension: EXTENSION }),
    ).rejects.toThrow(/Duplicate trigger "ping".*first-ping\.ts.*second-pong\.ts/s)
  })

  it('reloads a changed module when given a new generation', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'loader-generation-'))
    const file = path.join(dir, 'command.mjs')
    try {
      await writeFile(file, "export default { name: 'before', category: 'tools', description: 'd', run: async () => {} }\n")
      const before = await loadCommands(dir, { extension: '.mjs', generation: 'one' })
      await writeFile(file, "export default { name: 'after', category: 'tools', description: 'd', run: async () => {} }\n")
      const after = await loadCommands(dir, { extension: '.mjs', generation: 'two' })

      expect(before.get('before')?.name).toBe('before')
      expect(after.get('after')?.name).toBe('after')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('ignores files that do not match the configured extension', async () => {
    const registry = await loadCommands(fixtureDir('good'), { extension: '.mjs' })

    expect(registry.list()).toEqual([])
  })

  // Production memuat hasil compile; default extension harus bekerja atas .js nyata.
  it('loads compiled .js modules with the default extension', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'loader-js-'))
    await mkdir(path.join(dir, 'fun'), { recursive: true })
    await writeFile(
      path.join(dir, 'fun', 'dice.js'),
      "export default { name: 'dice', category: 'games', description: 'd', run: async () => {} }\n",
    )
    await writeFile(
      path.join(dir, 'notes.txt'),
      'bukan module\n',
    )

    try {
      const registry = await loadCommands(dir)
      expect(registry.list().map((command) => command.name)).toEqual(['dice'])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

const projects: string[] = []
const command = (name: string): string =>
  `export default { name: '${name}', category: 'tools', description: '${name}', run: async () => {} }\n`

async function project(): Promise<{ root: string; plugins: string; output: string }> {
  const root = await mkdtemp(path.join(tmpdir(), 'runtime-plugin-build-'))
  projects.push(root)
  const plugins = path.join(root, 'plugins')
  const output = path.join(root, '.runtime', 'plugins')
  await mkdir(plugins, { recursive: true })
  await writeFile(path.join(root, 'tsconfig.json'), JSON.stringify({
    compilerOptions: { target: 'ES2023', module: 'NodeNext', moduleResolution: 'NodeNext', rootDir: '.', outDir: 'dist', strict: true, types: [] },
    include: ['plugins/**/*.ts'],
  }))
  await writeFile(path.join(root, 'package.json'), '{"type":"module"}\n')
  return { root, plugins, output }
}

afterEach(async () => {
  await Promise.all(projects.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

async function generatedFile(output: string, file: string): Promise<string> {
  const generations = (await readdir(output, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()
  const generation = generations.at(-1)
  if (generation === undefined) throw new Error('missing generation')
  return path.join(output, generation, file)
}

describe('buildPluginRegistry', () => {
  it('publishes unique immutable generations and serializes concurrent builds', async () => {
    const { root, plugins, output } = await project()
    await writeFile(path.join(plugins, 'one.ts'), command('one'))
    const options = { cwd: root, configPath: path.join(root, 'tsconfig.json'), outputDir: output }
    const [first, second] = await Promise.all([buildPluginRegistry(options), buildPluginRegistry(options)])
    expect(first.get('one')?.name).toBe('one')
    expect(second.get('one')?.name).toBe('one')
    const generations = (await readdir(output, { withFileTypes: true })).filter((entry) => entry.isDirectory())
    expect(generations).toHaveLength(2)
    expect(generations[0]?.name).not.toBe(generations[1]?.name)
  })

  it('loads registry from the immutable published generation and preserves it on load failure', async () => {
    const { root, plugins, output } = await project()
    await writeFile(path.join(plugins, 'one.ts'), command('one'))
    const options = { cwd: root, configPath: path.join(root, 'tsconfig.json'), outputDir: output }
    const active = await buildPluginRegistry(options)
    const [activeGeneration] = await readdir(output)
    await writeFile(path.join(plugins, 'one.ts'), command('same'))
    await writeFile(path.join(plugins, 'two.ts'), command('same'))

    await expect(buildPluginRegistry(options)).rejects.toThrow(/\.runtime[/\\]plugins[/\\].*two\.js/)
    expect(active.get('one')?.name).toBe('one')
    expect(await readdir(output)).toEqual([activeGeneration])
    await expect(access(path.join(output, activeGeneration ?? '', 'plugins', 'one.js'))).resolves.toBeUndefined()
  })

  it('retains only three newest generations after successful publication', async () => {
    const { root, plugins, output } = await project()
    await writeFile(path.join(plugins, 'one.ts'), command('one'))
    const options = { cwd: root, configPath: path.join(root, 'tsconfig.json'), outputDir: output }
    for (let build = 0; build < 5; build += 1) await buildPluginRegistry(options)

    const generations = (await readdir(output, { withFileTypes: true })).filter((entry) => entry.isDirectory())
    expect(generations).toHaveLength(3)
  }, 15_000)

  it('keeps exactly three generations including active and removes malformed future-sorting directories', async () => {
    const { root, plugins, output } = await project()
    await writeFile(path.join(plugins, 'one.ts'), command('one'))
    const options = { cwd: root, configPath: path.join(root, 'tsconfig.json'), outputDir: output }
    await buildPluginRegistry(options)
    for (const name of ['z-future-1', 'z-future-2', 'z-future-3']) {
      await mkdir(path.join(output, name))
      await writeFile(path.join(output, name, 'sentinel'), 'malformed')
    }

    const registry = await buildPluginRegistry(options)
    const generations = (await readdir(output, { withFileTypes: true })).filter((entry) => entry.isDirectory())

    expect(registry.get('one')?.name).toBe('one')
    expect(generations).toHaveLength(2)
    expect(generations.every((entry) => /^\d+-\d+-[0-9a-f-]{36}$/.test(entry.name))).toBe(true)
  })

  it('serializes builders across processes with a filesystem lock', async () => {
    const { root, plugins, output } = await project()
    await writeFile(path.join(plugins, 'one.ts'), command('one'))
    const runner = path.join(root, 'build.mts')
    const modulePath = path.resolve('lib/commands/runtime-plugin-build.ts')
    await writeFile(runner, `import { buildPluginRegistry } from ${JSON.stringify(modulePath)}; await buildPluginRegistry(${JSON.stringify({ cwd: root, configPath: path.join(root, 'tsconfig.json'), outputDir: output })})`)
    const tsx = path.resolve('node_modules/tsx/dist/cli.mjs')

    await Promise.all([
      execFileAsync(process.execPath, [tsx, runner], { cwd: path.resolve('.') }),
      execFileAsync(process.execPath, [tsx, runner], { cwd: path.resolve('.') }),
    ])

    const generations = (await readdir(output, { withFileTypes: true })).filter((entry) => entry.isDirectory())
    expect(generations).toHaveLength(2)
    await expect(access(path.join(root, '.runtime', 'plugins.lock'))).rejects.toThrow()
  })

  it('recovers a lock owned by a dead process without waiting for the timeout', async () => {
    const { root, plugins, output } = await project()
    await writeFile(path.join(plugins, 'one.ts'), command('one'))
    const lock = path.join(root, '.runtime', 'plugins.lock')
    await mkdir(lock, { recursive: true })
    await writeFile(path.join(lock, 'owner.json'), JSON.stringify({ pid: 2_147_483_647, createdAt: Date.now() - 60_000 }))

    const started = Date.now()
    const registry = await buildPluginRegistry({ cwd: root, configPath: path.join(root, 'tsconfig.json'), outputDir: output })

    expect(registry.get('one')?.name).toBe('one')
    expect(Date.now() - started).toBeLessThan(3_000)
    await expect(access(lock)).rejects.toThrow()
  })

  it('rejects output path escape and symlink without touching a sentinel', async () => {
    const { root, plugins } = await project()
    await writeFile(path.join(plugins, 'one.ts'), command('one'))
    const outside = await mkdtemp(path.join(tmpdir(), 'runtime-output-outside-'))
    projects.push(outside)
    const sentinel = path.join(outside, 'sentinel')
    await writeFile(sentinel, 'safe')
    await expect(buildPluginRegistry({ cwd: root, configPath: path.join(root, 'tsconfig.json'), outputDir: outside })).rejects.toThrow(/output/i)
    expect(await readFile(sentinel, 'utf8')).toBe('safe')
    await mkdir(path.join(root, '.runtime'), { recursive: true })
    await symlink(outside, path.join(root, '.runtime', 'plugins'))
    await expect(buildPluginRegistry({ cwd: root, configPath: path.join(root, 'tsconfig.json'), outputDir: path.join(root, '.runtime', 'plugins') })).rejects.toThrow(/symlink/i)
    expect(await readFile(sentinel, 'utf8')).toBe('safe')
  })

  it('removes compiled output and command after a source unlink', async () => {
    const { root, plugins, output } = await project()
    const source = path.join(plugins, 'old.ts')
    await writeFile(source, command('old'))
    await writeFile(path.join(plugins, 'kept.ts'), command('kept'))
    await buildPluginRegistry({ cwd: root, configPath: path.join(root, 'tsconfig.json'), outputDir: output })
    await rm(source)

    const registry = await buildPluginRegistry({ cwd: root, configPath: path.join(root, 'tsconfig.json'), outputDir: output })

    expect(registry.get('old')).toBeUndefined()
    await expect(access(await generatedFile(output, 'plugins/old.js'))).rejects.toThrow()
  })

  it('replaces compiled output and command after a source rename', async () => {
    const { root, plugins, output } = await project()
    const oldSource = path.join(plugins, 'old.ts')
    const newSource = path.join(plugins, 'new.ts')
    await writeFile(oldSource, command('old'))
    await buildPluginRegistry({ cwd: root, configPath: path.join(root, 'tsconfig.json'), outputDir: output })
    await rename(oldSource, newSource)
    await writeFile(newSource, command('new'))

    const registry = await buildPluginRegistry({ cwd: root, configPath: path.join(root, 'tsconfig.json'), outputDir: output })

    expect(registry.get('old')).toBeUndefined()
    expect(registry.get('new')?.name).toBe('new')
    await expect(access(await generatedFile(output, 'plugins/old.js'))).rejects.toThrow()
  })

  it('retains live output when static policy rejects a candidate', async () => {
    const { root, plugins, output } = await project()
    const source = path.join(plugins, 'old.ts')
    await writeFile(source, command('old'))
    const options = { cwd: root, configPath: path.join(root, 'tsconfig.json'), outputDir: output }
    await buildPluginRegistry(options)
    const live = await readFile(await generatedFile(output, 'plugins/old.js'), 'utf8')
    await writeFile(source, "export default { name: 'bad', category: 'tools', description: 'bad', run: async () => eval('1') }\n")

    await expect(buildPluginRegistry(options)).rejects.toThrow('eval ditolak: old.ts')
    expect(await readFile(await generatedFile(output, 'plugins/old.js'), 'utf8')).toBe(live)
  })

  it('retains live output when the isolated import probe fails', async () => {
    const { root, plugins, output } = await project()
    const source = path.join(plugins, 'old.ts')
    await writeFile(source, command('old'))
    const options = { cwd: root, configPath: path.join(root, 'tsconfig.json'), outputDir: output }
    await buildPluginRegistry(options)
    const live = await readFile(await generatedFile(output, 'plugins/old.js'), 'utf8')
    await writeFile(source, "throw new Error('probe exploded')\nexport default { name: 'bad', category: 'tools', description: 'bad', run: async () => {} }\n")

    await expect(buildPluginRegistry(options)).rejects.toThrow(/Top-level side effect ditolak|probe exploded/)
    expect(await readFile(await generatedFile(output, 'plugins/old.js'), 'utf8')).toBe(live)
  })

  it('publishes lib/ alongside plugins/ so plugin imports resolve under the generation', async () => {
    const { root, plugins, output } = await project()
    const lib = path.join(root, 'lib')
    await mkdir(lib, { recursive: true })
    await writeFile(path.join(lib, 'helper.ts'), "export const helper: string = 'ok'\n")
    await writeFile(
      path.join(plugins, 'greet.ts'),
      `import { helper } from '../lib/helper.js'\nexport default {\n  name: 'greet',\n  category: 'tools',\n  description: helper,\n  run: async () => {},\n}\n`,
    )
    await writeFile(
      path.join(root, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: { target: 'ES2023', module: 'NodeNext', moduleResolution: 'NodeNext', rootDir: '.', outDir: 'dist', strict: true, types: [] },
        include: ['plugins/**/*.ts', 'lib/**/*.ts'],
      }),
    )
    const options = { cwd: root, configPath: path.join(root, 'tsconfig.json'), outputDir: output }

    const registry = await buildPluginRegistry(options)

    expect(registry.get('greet')?.name).toBe('greet')
    const [generation] = await readdir(output)
    expect(generation).toBeDefined()
    await expect(access(path.join(output, generation ?? '', 'lib', 'helper.js'))).resolves.toBeUndefined()
    await expect(access(path.join(output, generation ?? '', 'plugins', 'greet.js'))).resolves.toBeUndefined()
  })

  it('retains live output and the old registry when the candidate build fails', async () => {
    const { root, plugins, output } = await project()
    const source = path.join(plugins, 'old.ts')
    await writeFile(source, command('old'))
    const options = { cwd: root, configPath: path.join(root, 'tsconfig.json'), outputDir: output }
    const registry = createReloadableRegistry(await buildPluginRegistry(options), () => buildPluginRegistry(options))
    const live = await readFile(await generatedFile(output, 'plugins/old.js'), 'utf8')
    await writeFile(source, 'not valid TypeScript }')

    await expect(registry.reload()).rejects.toThrow()

    expect(registry.get('old')?.name).toBe('old')
    expect(await readFile(await generatedFile(output, 'plugins/old.js'), 'utf8')).toBe(live)
  })
})
