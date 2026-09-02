import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createNoopLogger, WaClient, type WaStore } from 'zapo-js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { BotConfig } from '../../lib/config.js'
import type { ConnectionClient } from '../../lib/client/connection-manager.js'
import { createProtocolStore } from '../../lib/client/store.js'
import { createClient } from '../../lib/client/create-client.js'

let workDir: string
let store: WaStore

function createConfig(overrides: Partial<BotConfig> = {}): BotConfig {
  return {
    prefixes: ['.'],
    ownerNumber: '628123456789',
    authMethod: 'auto',
    sessionId: 'test-session',
    storePath: join(workDir, 'state.sqlite'),
    menuThumbnailPath: join(workDir, 'assets', 'menu-thumbnail.jpg'),
    logLevel: 'info',
    nodeEnv: 'test',
    isProduction: false,
    ...overrides,
  }
}

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'zapo-client-test-'))
  store = createProtocolStore({ path: join(workDir, 'state.sqlite') })
})

afterEach(async () => {
  await store.destroy()
  rmSync(workDir, { recursive: true, force: true })
})

describe('createClient', () => {
  it('returns a client usable as a ConnectionClient', () => {
    const client = createClient(createConfig(), store, createNoopLogger())

    // Compile-time proof that the WaClient satisfies the manager's contract.
    const asConnectionClient: ConnectionClient = client

    expect(typeof asConnectionClient.connect).toBe('function')
    expect(typeof asConnectionClient.disconnect).toBe('function')
    expect(typeof asConnectionClient.on).toBe('function')
  })

  it('neither connects nor attaches listeners of its own at construction', () => {
    const config = createConfig()
    // WaClient wires its own internal 'connection'/'message_protocol' handlers, so the
    // baseline is a bare client — the factory must not add anything beyond it.
    const baseline = new WaClient({ store, sessionId: 'baseline-session' }, createNoopLogger())

    const client = createClient(config, store, createNoopLogger())

    expect(client.getState()).toEqual({
      connected: false,
      registered: false,
      hasQr: false,
      hasPairingCode: false,
    })
    expect(client.eventNames()).toEqual(baseline.eventNames())
    expect(client.listenerCount('connection')).toBe(baseline.listenerCount('connection'))
  })

  it('forwards test-only transport overrides without touching the normal path', () => {
    const client = createClient(createConfig(), store, createNoopLogger(), {
      chatSocketUrls: ['ws://127.0.0.1:1/ws/chat'],
    })

    expect(client.getState().connected).toBe(false)
  })
})
