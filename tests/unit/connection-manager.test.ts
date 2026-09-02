import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

import {
  createConnectionManager,
  type ConnectionClient,
  type ConnectionEvent,
} from '../../lib/client/connection-manager.js'

interface FakeClient extends ConnectionClient {
  readonly connectCalls: number
  readonly disconnectCalls: number
  readonly connectionListeners: number
  emit(event: ConnectionEvent): void
  failNextConnect(error: Error): void
  failNextDisconnect(error: Error): void
}

function createFakeClient(): FakeClient {
  const listeners: Array<(event: ConnectionEvent) => void> = []
  let connectCalls = 0
  let disconnectCalls = 0
  let pendingFailure: Error | undefined
  let pendingDisconnectFailure: Error | undefined

  return {
    get connectCalls() {
      return connectCalls
    },
    get disconnectCalls() {
      return disconnectCalls
    },
    get connectionListeners() {
      return listeners.length
    },
    on(event, listener) {
      expect(event).toBe('connection')
      listeners.push(listener)
      return this
    },
    connect() {
      connectCalls += 1
      if (pendingFailure !== undefined) {
        const error = pendingFailure
        pendingFailure = undefined
        return Promise.reject(error)
      }
      return Promise.resolve()
    },
    disconnect() {
      disconnectCalls += 1
      if (pendingDisconnectFailure !== undefined) {
        const error = pendingDisconnectFailure
        pendingDisconnectFailure = undefined
        return Promise.reject(error)
      }
      return Promise.resolve()
    },
    emit(event) {
      for (const listener of [...listeners]) {
        listener(event)
      }
    },
    failNextConnect(error) {
      pendingFailure = error
    },
    failNextDisconnect(error) {
      pendingDisconnectFailure = error
    },
  }
}

const OPEN: ConnectionEvent = { status: 'open' }
const TRANSIENT_CLOSE: ConnectionEvent = { status: 'close', isLogout: false }
const LOGOUT_CLOSE: ConnectionEvent = { status: 'close', isLogout: true }

describe('createConnectionManager', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('connects exactly once on start', async () => {
    const client = createFakeClient()
    const manager = createConnectionManager({ client })

    manager.start()
    await vi.advanceTimersByTimeAsync(0)

    expect(client.connectCalls).toBe(1)
    expect(manager.state).toBe('connecting')
  })

  it('resets the attempt counter when the connection opens', async () => {
    const client = createFakeClient()
    const manager = createConnectionManager({ client })

    manager.start()
    client.emit(TRANSIENT_CLOSE)
    expect(manager.attempts).toBe(1)

    await vi.advanceTimersByTimeAsync(1000)
    client.emit(OPEN)

    expect(manager.state).toBe('open')
    expect(manager.attempts).toBe(0)
  })

  it('reconnects with 1s, 2s then 4s backoff', async () => {
    const client = createFakeClient()
    const manager = createConnectionManager({ client })

    manager.start()
    expect(client.connectCalls).toBe(1)

    client.emit(TRANSIENT_CLOSE)
    expect(manager.state).toBe('waiting-backoff')
    await vi.advanceTimersByTimeAsync(999)
    expect(client.connectCalls).toBe(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(client.connectCalls).toBe(2)

    client.emit(TRANSIENT_CLOSE)
    await vi.advanceTimersByTimeAsync(1999)
    expect(client.connectCalls).toBe(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(client.connectCalls).toBe(3)

    client.emit(TRANSIENT_CLOSE)
    await vi.advanceTimersByTimeAsync(3999)
    expect(client.connectCalls).toBe(3)
    await vi.advanceTimersByTimeAsync(1)
    expect(client.connectCalls).toBe(4)
  })

  it('caps the backoff delay at 30s', async () => {
    const client = createFakeClient()
    const manager = createConnectionManager({ client, maxAttempts: 20 })

    manager.start()
    for (let attempt = 0; attempt < 10; attempt += 1) {
      client.emit(TRANSIENT_CLOSE)
      await vi.advanceTimersByTimeAsync(30_000)
    }

    expect(client.connectCalls).toBe(11)

    client.emit(TRANSIENT_CLOSE)
    await vi.advanceTimersByTimeAsync(29_999)
    expect(client.connectCalls).toBe(11)
    await vi.advanceTimersByTimeAsync(1)
    expect(client.connectCalls).toBe(12)
  })

  it('never reconnects after a logout close', async () => {
    const client = createFakeClient()
    const manager = createConnectionManager({ client })

    manager.start()
    client.emit(LOGOUT_CLOSE)

    expect(manager.state).toBe('logged-out')
    await vi.advanceTimersByTimeAsync(120_000)
    expect(client.connectCalls).toBe(1)
  })

  it('stops retrying once maxAttempts is reached', async () => {
    const errors: unknown[] = []
    const client = createFakeClient()
    const manager = createConnectionManager({
      client,
      maxAttempts: 2,
      onError: (error) => errors.push(error),
    })

    manager.start()
    for (let attempt = 0; attempt < 3; attempt += 1) {
      client.emit(TRANSIENT_CLOSE)
      await vi.advanceTimersByTimeAsync(30_000)
    }

    expect(client.connectCalls).toBe(3)
    expect(manager.state).toBe('exhausted')
    expect(errors).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(120_000)
    expect(client.connectCalls).toBe(3)
  })

  it('does not double-schedule or double-connect on repeated closes', async () => {
    const client = createFakeClient()
    const manager = createConnectionManager({ client })

    manager.start()
    client.emit(TRANSIENT_CLOSE)
    client.emit(TRANSIENT_CLOSE)
    client.emit(TRANSIENT_CLOSE)

    expect(manager.attempts).toBe(1)
    await vi.advanceTimersByTimeAsync(1000)
    expect(client.connectCalls).toBe(2)

    await vi.advanceTimersByTimeAsync(120_000)
    expect(client.connectCalls).toBe(2)
  })

  it('cancels the pending timer and disconnects exactly once on stop', async () => {
    const client = createFakeClient()
    const manager = createConnectionManager({ client })

    manager.start()
    client.emit(TRANSIENT_CLOSE)
    expect(manager.state).toBe('waiting-backoff')

    await manager.stop()
    await manager.stop()

    expect(client.disconnectCalls).toBe(1)
    expect(manager.state).toBe('stopped')
    await vi.advanceTimersByTimeAsync(120_000)
    expect(client.connectCalls).toBe(1)
  })

  it('does not reconnect when a close arrives during shutdown', async () => {
    const client = createFakeClient()
    const manager = createConnectionManager({ client })

    manager.start()
    await manager.stop()
    client.emit(TRANSIENT_CLOSE)

    expect(manager.state).toBe('stopped')
    await vi.advanceTimersByTimeAsync(120_000)
    expect(client.connectCalls).toBe(1)
  })

  it('retries disconnect after a failed stop', async () => {
    const client = createFakeClient()
    const manager = createConnectionManager({ client })
    client.failNextDisconnect(new Error('disconnect failed'))

    manager.start()
    await expect(manager.stop()).rejects.toThrow('disconnect failed')
    expect(manager.state).not.toBe('stopped')

    await manager.stop()

    expect(client.disconnectCalls).toBe(2)
    expect(manager.state).toBe('stopped')
  })

  it('applies the retry policy to a rejected connect', async () => {
    const errors: unknown[] = []
    const client = createFakeClient()
    const manager = createConnectionManager({ client, onError: (error) => errors.push(error) })

    client.failNextConnect(new Error('handshake failed'))
    manager.start()
    await vi.advanceTimersByTimeAsync(0)

    expect(errors).toHaveLength(1)
    expect(manager.state).toBe('waiting-backoff')

    await vi.advanceTimersByTimeAsync(1000)
    expect(client.connectCalls).toBe(2)
  })

  it('attaches the connection listener once across reconnects', async () => {
    const client = createFakeClient()
    const manager = createConnectionManager({ client })

    manager.start()
    manager.start()
    client.emit(TRANSIENT_CLOSE)
    await vi.advanceTimersByTimeAsync(1000)
    client.emit(OPEN)

    expect(client.connectionListeners).toBe(1)
    expect(client.connectCalls).toBe(2)
  })
})
