import { describe, expect, it, vi } from 'vitest'

import { createPluginWatcher, type PluginFileWatcher } from '../../lib/commands/plugin-watcher.js'

class FakeWatcher implements PluginFileWatcher {
  readonly handlers = new Map<string, () => void>()
  closeCalls = 0

  on(event: 'add' | 'change' | 'unlink', handler: () => void): this {
    this.handlers.set(event, handler)
    return this
  }

  close(): Promise<void> {
    this.closeCalls += 1
    return Promise.resolve()
  }

  emit(event: 'add' | 'change' | 'unlink'): void {
    this.handlers.get(event)?.()
  }
}

function deferred(): { readonly promise: Promise<void>; resolve(): void } {
  let resolve!: () => void
  return { promise: new Promise<void>((done) => { resolve = done }), resolve }
}

describe('createPluginWatcher', () => {
  it.each(['add', 'change', 'unlink'] as const)('reloads after a debounced %s event', async (event) => {
    vi.useFakeTimers()
    const fileWatcher = new FakeWatcher()
    const reload = vi.fn(() => Promise.resolve())
    const watcher = createPluginWatcher({ fileWatcher, reload, debounceMs: 400 })

    fileWatcher.emit(event)
    await vi.advanceTimersByTimeAsync(399)
    expect(reload).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(reload).toHaveBeenCalledOnce()

    await watcher.close()
    vi.useRealTimers()
  })

  it('coalesces save bursts', async () => {
    vi.useFakeTimers()
    const fileWatcher = new FakeWatcher()
    const reload = vi.fn(() => Promise.resolve())
    const watcher = createPluginWatcher({ fileWatcher, reload, debounceMs: 400 })

    fileWatcher.emit('change')
    await vi.advanceTimersByTimeAsync(200)
    fileWatcher.emit('change')
    await vi.advanceTimersByTimeAsync(400)
    expect(reload).toHaveBeenCalledOnce()

    await watcher.close()
    vi.useRealTimers()
  })

  it('serializes reloads and coalesces events received while one is running', async () => {
    vi.useFakeTimers()
    const fileWatcher = new FakeWatcher()
    const first = deferred()
    const reload = vi.fn().mockImplementationOnce(() => first.promise).mockResolvedValue(undefined)
    const watcher = createPluginWatcher({ fileWatcher, reload, debounceMs: 400 })

    fileWatcher.emit('change')
    await vi.advanceTimersByTimeAsync(400)
    fileWatcher.emit('add')
    fileWatcher.emit('unlink')
    await vi.advanceTimersByTimeAsync(400)
    expect(reload).toHaveBeenCalledOnce()

    first.resolve()
    await vi.runAllTimersAsync()
    expect(reload).toHaveBeenCalledTimes(2)

    await watcher.close()
    vi.useRealTimers()
  })

  it('closes the filesystem watcher and waits for an active reload', async () => {
    vi.useFakeTimers()
    const fileWatcher = new FakeWatcher()
    const active = deferred()
    const watcher = createPluginWatcher({ fileWatcher, reload: () => active.promise, debounceMs: 400 })

    fileWatcher.emit('change')
    await vi.advanceTimersByTimeAsync(400)
    let closed = false
    const closing = watcher.close().then(() => { closed = true })
    await Promise.resolve()
    expect(fileWatcher.closeCalls).toBe(1)
    expect(closed).toBe(false)

    active.resolve()
    await closing
    expect(closed).toBe(true)
    vi.useRealTimers()
  })
})
