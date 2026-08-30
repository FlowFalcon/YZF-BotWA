import { systemClock, type CancelScheduled, type Clock } from '../shared/clock.js'

/**
 * Narrow structural view of the zapo `connection` event payload
 * (`WaConnectionEvent` in zapo-js/dist/client/types.d.ts): a discriminated
 * union on `status` where a close carries `isLogout`. Only the members the
 * policy reads are declared so a real `WaConnectionEvent` is assignable.
 */
export type ConnectionEvent =
  | { readonly status: 'open' }
  | { readonly status: 'close'; readonly isLogout: boolean }

/**
 * Minimal structural client contract. `WaClient.on('connection', listener)`
 * satisfies it; the manager never touches anything else so tests can supply a
 * fake. `WaClient` does not auto-reconnect — this manager owns that policy.
 */
export interface ConnectionClient {
  on(event: 'connection', listener: (payload: ConnectionEvent) => void): unknown
  connect(): Promise<void>
  disconnect(): Promise<void>
}

export type ConnectionState =
  | 'idle'
  | 'connecting'
  | 'open'
  | 'waiting-backoff'
  | 'logged-out'
  | 'stopping'
  | 'stopped'
  | 'exhausted'

export interface ConnectionManagerOptions {
  readonly client: ConnectionClient
  readonly clock?: Clock
  readonly baseDelayMs?: number
  readonly maxDelayMs?: number
  readonly maxAttempts?: number
  /** Reports connect() rejections and give-up transitions; errors are never swallowed. */
  readonly onError?: (error: unknown) => void
}

export interface ConnectionManager {
  readonly state: ConnectionState
  readonly attempts: number
  start(): void
  stop(): Promise<void>
}

const DEFAULT_BASE_DELAY_MS = 1000
const DEFAULT_MAX_DELAY_MS = 30_000
const DEFAULT_MAX_ATTEMPTS = 10

export function createConnectionManager(options: ConnectionManagerOptions): ConnectionManager {
  const {
    client,
    clock = systemClock,
    baseDelayMs = DEFAULT_BASE_DELAY_MS,
    maxDelayMs = DEFAULT_MAX_DELAY_MS,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    onError,
  } = options

  let state: ConnectionState = 'idle'
  let attempts = 0
  let cancelTimer: CancelScheduled | undefined
  let connectInFlight = false

  const report = (error: unknown): void => {
    onError?.(error)
  }

  const clearTimer = (): void => {
    if (cancelTimer !== undefined) {
      cancelTimer()
      cancelTimer = undefined
    }
  }

  const attemptConnect = (): void => {
    if (connectInFlight) {
      return
    }
    connectInFlight = true
    state = 'connecting'
    client.connect().then(
      () => {
        connectInFlight = false
      },
      (error: unknown) => {
        connectInFlight = false
        report(error)
        // A rejected connect() is the same failure class as a transient close.
        scheduleReconnect()
      },
    )
  }

  const scheduleReconnect = (): void => {
    if (state === 'stopping' || state === 'stopped' || state === 'logged-out') {
      return
    }
    // At most one pending timer; extra close events must not fan out.
    if (cancelTimer !== undefined) {
      return
    }
    if (attempts >= maxAttempts) {
      state = 'exhausted'
      report(new Error(`connection retry limit reached after ${String(attempts)} attempts`))
      return
    }
    const delayMs = Math.min(baseDelayMs * 2 ** attempts, maxDelayMs)
    attempts += 1
    state = 'waiting-backoff'
    cancelTimer = clock.schedule(delayMs, () => {
      cancelTimer = undefined
      attemptConnect()
    })
  }

  const handleConnectionEvent = (payload: ConnectionEvent): void => {
    if (payload.status === 'open') {
      connectInFlight = false
      attempts = 0
      clearTimer()
      if (state !== 'stopping' && state !== 'stopped') {
        state = 'open'
      }
      return
    }

    connectInFlight = false
    if (payload.isLogout) {
      // Credentials are gone; reconnecting cannot succeed until re-pairing.
      clearTimer()
      state = 'logged-out'
      return
    }
    scheduleReconnect()
  }

  return {
    get state() {
      return state
    },
    get attempts() {
      return attempts
    },
    // Only reachable from 'idle', so the connection listener is attached exactly once.
    start(): void {
      if (state !== 'idle') {
        return
      }
      client.on('connection', handleConnectionEvent)
      attemptConnect()
    },
    async stop(): Promise<void> {
      if (state === 'stopping' || state === 'stopped') {
        return
      }
      clearTimer()
      state = 'stopping'
      try {
        // disconnect() keeps credentials; logout() would unlink the device.
        await client.disconnect()
      } finally {
        state = 'stopped'
      }
    },
  }
}
