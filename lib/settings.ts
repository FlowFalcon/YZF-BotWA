import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

export const BOT_MODES = ['public', 'group-only', 'owner-only'] as const
export type BotMode = (typeof BOT_MODES)[number]

export interface SettingsView {
  getMode(): BotMode
}

export interface SettingsStore extends SettingsView {
  setMode(mode: BotMode): Promise<void>
}

export interface SettingsFileOperations {
  mkdir: typeof mkdir
  writeFile: typeof writeFile
  rename: typeof rename
  rm: typeof rm
}

const fileOperations: SettingsFileOperations = { mkdir, writeFile, rename, rm }

function isBotMode(value: unknown): value is BotMode {
  return BOT_MODES.some((mode) => mode === value)
}

async function readMode(file: string): Promise<BotMode> {
  try {
    const parsed: unknown = JSON.parse(await readFile(file, 'utf8'))
    if (typeof parsed === 'object' && parsed !== null && 'mode' in parsed) {
      const mode = (parsed as { readonly mode?: unknown }).mode
      if (isBotMode(mode)) return mode
    }
  } catch (error) {
    if (!(error instanceof SyntaxError) &&
        !(typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT')) {
      throw error
    }
  }
  return 'owner-only'
}

export async function createSettingsStore(
  file: string,
  files: SettingsFileOperations = fileOperations,
): Promise<SettingsStore> {
  let mode = await readMode(file)
  let writes = Promise.resolve()

  return {
    getMode: () => mode,
    setMode(next) {
      const persist = async (): Promise<void> => {
        await files.mkdir(path.dirname(file), { recursive: true, mode: 0o700 })
        const temporary = `${file}.${process.pid}-${randomUUID()}.tmp`
        try {
          await files.writeFile(temporary, `${JSON.stringify({ mode: next }, null, 2)}\n`, {
            encoding: 'utf8',
            mode: 0o600,
          })
          await files.rename(temporary, file)
          mode = next
        } catch (error) {
          await files.rm(temporary, { force: true })
          throw error
        }
      }
      writes = writes.then(persist, persist)
      return writes
    },
  }
}
