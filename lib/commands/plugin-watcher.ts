import { watch } from 'node:fs'

export interface PluginFileWatcher {
  on(event: 'add' | 'change' | 'unlink', handler: () => void): PluginFileWatcher
  close(): Promise<void>
}

export interface PluginWatcher {
  close(): Promise<void>
}

export interface CreatePluginWatcherOptions {
  readonly fileWatcher: PluginFileWatcher
  readonly reload: () => Promise<void>
  readonly debounceMs?: number
  readonly onError?: (error: unknown) => void
}

export function createPluginWatcher(options: CreatePluginWatcherOptions): PluginWatcher {
  const debounceMs = options.debounceMs ?? 400
  let timer: NodeJS.Timeout | undefined
  let active: Promise<void> | undefined
  let pending = false
  let closed = false

  const run = (): void => {
    if (closed) return
    if (active !== undefined) {
      pending = true
      return
    }
    active = options.reload()
      .catch((error: unknown) => { options.onError?.(error) })
      .finally(() => {
        active = undefined
        if (pending && !closed) {
          pending = false
          run()
        }
      })
  }

  const queue = (): void => {
    if (closed) return
    clearTimeout(timer)
    timer = setTimeout(run, debounceMs)
  }

  for (const event of ['add', 'change', 'unlink'] as const) options.fileWatcher.on(event, queue)

  return {
    async close(): Promise<void> {
      closed = true
      clearTimeout(timer)
      await options.fileWatcher.close()
      await active
    },
  }
}

export function watchPluginFiles(directory: string): PluginFileWatcher {
  const handlers = new Set<() => void>()
  const watcher = watch(directory, { recursive: true }, (_event, filename) => {
    if (filename?.endsWith('.ts') === true) for (const handler of handlers) handler()
  })

  return {
    on(_event, handler) {
      handlers.add(handler)
      return this
    },
    close() {
      watcher.close()
      return Promise.resolve()
    },
  }
}
