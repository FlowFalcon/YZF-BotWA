import type { WaIncomingMessageEvent } from 'zapo-js'

import type { BotConfig } from './config.js'
import { createAuthController } from './auth/auth-controller.js'
import type {
  AuthPairedEvent,
  AuthPairingRequiredEvent,
  AuthPasskeyRequiredEvent,
  AuthQrEvent,
} from './auth/auth-controller.js'
import { createConnectionManager } from './client/connection-manager.js'
import type { ConnectionEvent } from './client/connection-manager.js'
import type { CommandRegistry } from './commands/registry.js'
import { createCooldownGate } from './commands/middleware/cooldown.js'
import { createFloodGate } from './commands/middleware/flood.js'
import { setMenuSource } from './features/general/menu.js'
import { setPanelSource } from './features/general/panel.js'
import { setAccessAllowlist } from './features/general/access.js'
import type { GroupAllowlist } from './access/group-allowlist.js'
import { createMessageRouter } from './messages/router.js'
import type { MessageSender } from './messages/context.js'
import type { RouterReporter } from './messages/router.js'
import { commandLogFields } from './shared/logger.js'
import { systemClock } from './shared/clock.js'
import { systemRandom } from './shared/random.js'

/** Pipeline limits. Not configurable until a real deployment needs different numbers. */
const FLOOD_LIMIT = 5
const FLOOD_WINDOW_MS = 10_000
const DEFAULT_COOLDOWN_MS = 3_000

/**
 * Structural logger contract. Declared here instead of importing pino's `Logger`
 * so tests can pass a recorder without constructing a real logger.
 */
export interface AppLogger {
  info(fields: object, message: string): void
  warn(fields: object, message: string): void
  error(fields: object, message: string): void
}

/** The store surface a graceful shutdown needs. */
export interface AppStore {
  destroy(): Promise<void>
}

/**
 * The client surface app.ts touches, written as explicit overloads: the auth
 * controller and the connection manager each demand their own `on`/`off`
 * signature, and a single-event declaration would not satisfy either.
 */
export interface AppClient extends MessageSender {
  on(event: 'message', listener: (event: WaIncomingMessageEvent) => void): unknown
  on(event: 'connection', listener: (payload: ConnectionEvent) => void): unknown
  on(event: 'auth_qr', listener: (event: AuthQrEvent) => void): unknown
  on(event: 'auth_pairing_required', listener: (event: AuthPairingRequiredEvent) => void): unknown
  on(event: 'auth_paired', listener: (event: AuthPairedEvent) => void): unknown
  on(event: 'auth_passkey_required', listener: (event: AuthPasskeyRequiredEvent) => void): unknown
  off(event: 'message', listener: (event: WaIncomingMessageEvent) => void): unknown
  off(event: 'auth_qr', listener: (event: AuthQrEvent) => void): unknown
  off(event: 'auth_pairing_required', listener: (event: AuthPairingRequiredEvent) => void): unknown
  off(event: 'auth_paired', listener: (event: AuthPairedEvent) => void): unknown
  off(event: 'auth_passkey_required', listener: (event: AuthPasskeyRequiredEvent) => void): unknown
  connect(): Promise<void>
  disconnect(): Promise<void>
  readonly auth: { requestPairingCode(phoneNumber: string): Promise<string> }
}

export interface AppDependencies {
  readonly config: BotConfig
  readonly logger: AppLogger
  readonly store: AppStore
  readonly client: AppClient
  readonly registry: CommandRegistry
  readonly allowlist: GroupAllowlist
}

export interface App {
  start(): Promise<void>
  stop(): Promise<void>
}

/**
 * Composition root. Pure wiring: no `process.env`, no signal handlers and no
 * connect at import time — `index.ts` owns those so this stays testable.
 */
export function createApp(deps: AppDependencies): App {
  const { config, logger, store, client, registry, allowlist } = deps

  const reporter: RouterReporter = {
    command: (report) => {
      logger.info(commandLogFields(report), 'command')
    },
    error: (report) => {
      logger.error({ stage: report.stage, command: report.command, err: report.error }, 'command')
    },
  }

  const router = createMessageRouter({
    registry,
    prefixes: config.prefixes,
    sender: client,
    clock: systemClock,
    random: systemRandom,
    flood: createFloodGate({ clock: systemClock, limit: FLOOD_LIMIT, windowMs: FLOOD_WINDOW_MS }),
    cooldown: createCooldownGate({ clock: systemClock, defaultCooldownMs: DEFAULT_COOLDOWN_MS }),
    reporter,
    access: allowlist,
    ...(config.ownerNumber === undefined ? {} : { ownerNumber: config.ownerNumber }),
  })

  const auth = createAuthController({
    client,
    config: {
      authMethod: config.authMethod,
      ...(config.pairingNumber === undefined ? {} : { pairingNumber: config.pairingNumber }),
    },
    onNotice: (notice) => {
      logger.info({ notice: notice.kind }, 'auth')
    },
    onError: (error) => {
      logger.error({ err: error }, 'auth')
    },
  })

  const connection = createConnectionManager({
    client,
    onError: (error) => {
      logger.error({ err: error }, 'connection')
    },
  })

  let running = false
  let stopped = false

  const onMessage = (event: WaIncomingMessageEvent): void => {
    // Events already in flight when stop() runs must not produce replies.
    if (!running) return
    void router(event).catch((error: unknown) => {
      logger.error({ err: error }, 'router')
    })
  }

  return {
    start(): Promise<void> {
      if (running || stopped) return Promise.resolve()
      running = true

      // The menu command receives the registry through its module setter because
      // the loader only reads `default`; this is the same module instance the
      // loader imported, so the injection is visible to the loaded command.
      setMenuSource(registry)
      setPanelSource(registry)
      setAccessAllowlist(allowlist)
      auth.attach()
      client.on('message', onMessage)
      connection.start()
      logger.info({ sessionId: config.sessionId }, 'started')
      return Promise.resolve()
    },

    async stop(): Promise<void> {
      if (stopped) return
      stopped = true
      running = false

      client.off('message', onMessage)
      auth.detach()
      setMenuSource(undefined)
      setPanelSource(undefined)
      setAccessAllowlist(undefined)

      // disconnect(), never logout(): logout unlinks the device and would force
      // the user to pair again.
      await connection.stop()
      await store.destroy()
      logger.info({}, 'stopped')
    },
  }
}
