import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { Command } from './command.js'
import type { CommandRegistry } from './registry.js'
import { createCommandRegistry } from './registry.js'

export interface LoadCommandsOptions {
  /**
   * Ekstensi module yang dimuat. Default `.js` karena runtime production
   * mengimpor hasil compile di `dist/`; test source memakai `.ts`.
   */
  readonly extension?: string
  readonly generation?: string
}

async function collectModuleFiles(dir: string, extension: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await collectModuleFiles(full, extension)))
      continue
    }
    if (entry.name.endsWith(extension)) files.push(full)
  }

  // Urutan filesystem tidak dijamin; sort menjaga pesan error deterministik.
  return files.sort()
}

function asCommand(value: unknown): Command | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const candidate = value as Partial<Command>
  if (typeof candidate.name !== 'string') return undefined
  if (typeof candidate.description !== 'string') return undefined
  if (typeof candidate.category !== 'string') return undefined
  if (typeof candidate.run !== 'function') return undefined
  return candidate as Command
}

/**
 * Memuat seluruh command module di bawah `dir` secara rekursif dan membangun
 * registry hanya setelah semuanya valid (COMMAND_SPEC §4): satu module invalid
 * membuat load gagal tanpa registry yang dipublikasikan.
 */
export async function loadCommands(
  dir: string,
  options: LoadCommandsOptions = {},
): Promise<CommandRegistry> {
  const extension = options.extension ?? '.js'
  const files = await collectModuleFiles(dir, extension)

  const commands: Command[] = []
  const sourceByName = new Map<string, string>()

  for (const file of files) {
    const url = pathToFileURL(file)
    if (options.generation !== undefined) url.searchParams.set('generation', options.generation)
    const module: unknown = await import(url.href)
    const exported = (module as { default?: unknown }).default
    const command = asCommand(exported)
    if (command === undefined) {
      throw new Error(`Module "${file}" harus memiliki default export berupa Command.`)
    }
    commands.push(command)
    sourceByName.set(command.name, file)
  }

  try {
    return createCommandRegistry(commands)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const sources = [...sourceByName]
      .filter(([name]) => message.includes(`"${name}"`))
      .map(([name, file]) => `${name}: ${file}`)
    if (sources.length === 0) throw error
    throw new Error(`${message} Sumber: ${sources.join(', ')}.`, { cause: error })
  }
}
