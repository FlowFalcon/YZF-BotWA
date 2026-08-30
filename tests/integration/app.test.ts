import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { WaIncomingMessageEvent } from 'zapo-js'

import { createApp } from '../../src/app.js'
import { loadConfig } from '../../src/config.js'
import type { BotConfig } from '../../src/config.js'
import { loadCommands } from '../../src/commands/loader.js'
import type { CommandRegistry } from '../../src/commands/registry.js'
import { setMenuSource } from '../../src/features/general/menu.js'
import {
  buildIncomingMessageEvent,
  OWNER_PN_JID,
  textMessage,
} from '../fixtures/messages.js'

const FEATURES_DIR = path.resolve(import.meta.dirname, '../../src/features')

interface SentMessage {
  readonly to: string
  readonly content: unknown
}

/**
 * Fake WaClient surface: only what app.ts is allowed to touch. `logout` throws
 * because unlinking the device would be irreversible for the user — a graceful
 * stop must never reach it.
 */
class FakeClient {
  readonly sent: SentMessage[] = []
  readonly listeners = new Map<string, number>()
  connectCalls = 0
  disconnectCalls = 0

  readonly message = {
    send: (to: string, content: unknown): Promise<void> => {
      this.sent.push({ to, content })
      return Promise.resolve()
    },
  }

  readonly auth = {
    requestPairingCode: (): Promise<string> => Promise.resolve('ABCD1234'),
  }

  private readonly handlers = new Map<string, Set<(payload: never) => void>>()

  on(event: string, listener: (payload: never) => void): this {
    this.listeners.set(event, (this.listeners.get(event) ?? 0) + 1)
    const set = this.handlers.get(event) ?? new Set()
    set.add(listener)
    this.handlers.set(event, set)
    return this
  }

  off(event: string, listener: (payload: never) => void): this {
    this.handlers.get(event)?.delete(listener)
    return this
  }

  connect(): Promise<void> {
    this.connectCalls += 1
    return Promise.resolve()
  }

  disconnect(): Promise<void> {
    this.disconnectCalls += 1
    return Promise.resolve()
  }

  logout(): Promise<void> {
    throw new Error('logout() must never be called by a graceful stop')
  }

  emit(event: string, payload: unknown): Promise<void> {
    const results = [...(this.handlers.get(event) ?? [])].map((listener) =>
      (listener as (value: unknown) => unknown)(payload),
    )
    return Promise.all(results).then(() => undefined)
  }
}

class FakeStore {
  destroyCalls = 0

  destroy(): Promise<void> {
    this.destroyCalls += 1
    return Promise.resolve()
  }
}

function textEvent(body: string, remoteJid: string = OWNER_PN_JID): WaIncomingMessageEvent {
  return buildIncomingMessageEvent({ remoteJid, message: textMessage(body) })
}

describe('createApp', () => {
  let storePath: string
  let config: BotConfig
  let registry: CommandRegistry
  let client: FakeClient
  let store: FakeStore

  beforeEach(async () => {
    storePath = await mkdtemp(path.join(tmpdir(), 'zapo-app-'))
    config = loadConfig({
      BOT_PREFIXES: '.',
      BOT_OWNER_NUMBER: OWNER_PN_JID.split('@')[0],
      BOT_STORE_PATH: path.join(storePath, 'state.sqlite'),
    })
    // Loaded through the real loader so the ESM module instance app.ts injects
    // the menu source into is the same one the loader imported.
    registry = await loadCommands(FEATURES_DIR, { extension: '.ts' })
    client = new FakeClient()
    store = new FakeStore()
  })

  afterEach(async () => {
    setMenuSource(undefined)
    await rm(storePath, { recursive: true, force: true })
  })

  function build(): ReturnType<typeof createApp> {
    return createApp({
      config,
      logger: { info: () => {}, warn: () => {}, error: () => {} },
      store,
      client,
      registry,
      allowlist: { has: () => true, list: () => [], add: () => Promise.resolve(), remove: () => Promise.resolve() },
    })
  }

  it('attaches exactly one message listener', async () => {
    const app = build()
    await app.start()

    expect(client.listeners.get('message')).toBe(1)
  })

  it('routes a command from the loaded registry to a reply', async () => {
    const app = build()
    await app.start()

    await client.emit('message', textEvent('.ping'))

    expect(client.sent).toHaveLength(1)
    expect(JSON.stringify(client.sent[0]?.content)).toContain('Pong')
  })

  it('wires the loaded registry into the menu command', async () => {
    const app = build()
    await app.start()

    await client.emit('message', textEvent('.menu'))

    const reply = JSON.stringify(client.sent[0]?.content)
    expect(reply).not.toContain('Menu belum siap')
    expect(reply).toContain('.ping')
    expect(reply).toContain('.dice')
  })

  it('disconnects and destroys the store on stop', async () => {
    const app = build()
    await app.start()
    await app.stop()

    expect(client.disconnectCalls).toBe(1)
    expect(store.destroyCalls).toBe(1)
  })

  it('is idempotent on stop', async () => {
    const app = build()
    await app.start()
    await app.stop()
    await app.stop()

    expect(client.disconnectCalls).toBe(1)
    expect(store.destroyCalls).toBe(1)
  })

  it('ignores messages after stop', async () => {
    const app = build()
    await app.start()
    await app.stop()

    await client.emit('message', textEvent('.ping'))

    expect(client.sent).toHaveLength(0)
  })
})
