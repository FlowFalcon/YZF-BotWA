import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { loadCommands } from '../../src/commands/loader.js'

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
      "export default { name: 'dice', category: 'fun', description: 'd', run: async () => {} }\n",
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
