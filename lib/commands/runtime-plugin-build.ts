import { execFile } from 'node:child_process'
import { lstat, mkdir, mkdtemp, readFile, realpath, readdir, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { promisify } from 'node:util'

import { loadCommands } from './loader.js'
import { validatePluginSources } from './plugin-policy.js'
import type { CommandRegistry } from './registry.js'

const importProbe = path.resolve('scripts/plugin-import-probe.mjs')
const execFileAsync = promisify(execFile)
const require = createRequire(import.meta.url)
const tsc = require.resolve('typescript/bin/tsc')
const builds = new Map<string, Promise<void>>()
const RETAINED_GENERATIONS = 3
const LOCK_RETRY_MS = 20
const LOCK_TIMEOUT_MS = 30_000
const LOCK_OWNER_GRACE_MS = 1_000
const GENERATION_NAME = /^\d+-\d+-[0-9a-f-]{36}$/
export const PLUGIN_PROBE_TIMEOUT_MS = 2_000

export interface RuntimePluginBuildOptions {
  readonly cwd: string
  readonly configPath: string
  readonly outputDir: string
}

async function safeOutputRoot(cwd: string, outputDir: string): Promise<string> {
  const project = await realpath(cwd)
  const expected = path.join(project, '.runtime', 'plugins')
  if (path.resolve(outputDir) !== expected) throw new Error('Plugin output harus <project>/.runtime/plugins.')
  await mkdir(path.dirname(expected), { recursive: true, mode: 0o700 })
  try {
    const stat = await lstat(expected)
    if (stat.isSymbolicLink()) throw new Error('Symlink plugin output ditolak.')
    if (!stat.isDirectory()) throw new Error('Plugin output harus directory.')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    await mkdir(expected, { recursive: true, mode: 0o700 })
  }
  if (await realpath(expected) !== expected) throw new Error('Symlink plugin output ditolak.')
  return expected
}

async function serialized<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const previous = builds.get(key) ?? Promise.resolve()
  let release!: () => void
  const turn = new Promise<void>((resolve) => { release = resolve })
  const queued = previous.catch(() => {}).then(() => turn)
  builds.set(key, queued)
  await previous.catch(() => {})
  try {
    return await operation()
  } finally {
    release()
    if (builds.get(key) === queued) builds.delete(key)
  }
}

const pause = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => { setTimeout(resolve, milliseconds) })

async function withFilesystemLock<T>(outputRoot: string, operation: () => Promise<T>): Promise<T> {
  const lock = `${outputRoot}.lock`
  const deadline = Date.now() + LOCK_TIMEOUT_MS
  while (true) {
    try {
      await mkdir(lock)
      await writeFile(path.join(lock, 'owner.json'), JSON.stringify({ pid: process.pid, createdAt: Date.now() }), { flag: 'wx', mode: 0o600 })
      break
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      let dead = false
      try {
        const owner = JSON.parse(await readFile(path.join(lock, 'owner.json'), 'utf8')) as { pid?: unknown }
        if (!Number.isInteger(owner.pid) || Number(owner.pid) <= 0) dead = true
        else try { process.kill(Number(owner.pid), 0) } catch (killError) {
          if ((killError as NodeJS.ErrnoException).code === 'ESRCH') dead = true
        }
      } catch (ownerError) {
        const age = Date.now() - (await lstat(lock)).mtimeMs
        if ((ownerError as NodeJS.ErrnoException).code !== 'ENOENT' || age >= LOCK_OWNER_GRACE_MS) dead = true
      }
      if (dead) {
        const abandoned = `${lock}.abandoned-${crypto.randomUUID()}`
        try {
          await rename(lock, abandoned)
          await rm(abandoned, { recursive: true, force: true })
          continue
        } catch (recoveryError) {
          if ((recoveryError as NodeJS.ErrnoException).code !== 'ENOENT') throw recoveryError
        }
      }
      if (Date.now() >= deadline) throw new Error('Timeout menunggu lock build plugin.')
      await pause(LOCK_RETRY_MS)
    }
  }
  try {
    return await operation()
  } finally {
    await rm(lock, { recursive: true, force: true })
  }
}

async function cleanGenerations(outputRoot: string, active: string): Promise<void> {
  const generations = (await readdir(outputRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
  const valid = generations.filter((generation) => GENERATION_NAME.test(generation)).sort()
  const keep = new Set([active, ...valid.filter((generation) => generation !== active).slice(-(RETAINED_GENERATIONS - 1))])
  await Promise.all(generations.filter((generation) => !keep.has(generation)).map(
    (generation) => rm(path.join(outputRoot, generation), { recursive: true, force: true }),
  ))
}

export async function buildPluginRegistry(options: RuntimePluginBuildOptions): Promise<CommandRegistry> {
  const outputRoot = await safeOutputRoot(options.cwd, options.outputDir)
  return serialized(outputRoot, () => withFilesystemLock(outputRoot, async () => {
    const generation = `${Date.now()}-${process.pid}-${crypto.randomUUID()}`
    const candidateRoot = await mkdtemp(path.join(path.dirname(outputRoot), '.plugins-candidate-'))
    const published = path.join(outputRoot, generation)
    try {
      await validatePluginSources(path.join(options.cwd, 'plugins'), options.cwd)
      await execFileAsync(process.execPath, [tsc, '-p', options.configPath, '--outDir', candidateRoot], {
        cwd: options.cwd,
        env: { PATH: process.env['PATH'] ?? '', NODE_ENV: 'production' },
      })
      await execFileAsync(process.execPath, [importProbe, candidateRoot], {
        cwd: options.cwd,
        env: { PATH: process.env['PATH'] ?? '', NODE_ENV: 'production' },
        timeout: PLUGIN_PROBE_TIMEOUT_MS,
        killSignal: 'SIGKILL',
      })
      // Publish the entire candidate root so plugins resolve relative imports
      // against the compiled `lib/` siblings under the immutable generation.
      await rename(candidateRoot, published)
      try {
        const registry = await loadCommands(path.join(published, 'plugins'), { generation })
        await cleanGenerations(outputRoot, generation)
        return registry
      } catch (error) {
        await rm(published, { recursive: true, force: true })
        throw error
      }
    } finally {
      // candidateRoot was already renamed on the happy path; nothing left to clean.
      try {
        await rm(candidateRoot, { recursive: true, force: true })
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      }
    }
  }))
}
