import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FakeWaServer, parsePairingQrString } from '@zapo-js/fake-server'
import type { WaFakeConnectionPipeline } from '@zapo-js/fake-server'
import { createStore, WaClient } from 'zapo-js'

import { createApp } from '../../src/app.js'
import { loadCommands } from '../../src/commands/loader.js'
import { loadConfig } from '../../src/config.js'
import { setMenuSource } from '../../src/features/general/menu.js'

const FEATURES_DIR = path.resolve(import.meta.dirname, '../../src/features')
const PEER_JID = '5511999999999@s.whatsapp.net'
const DEVICE_JID = '6281234567890.0:1@s.whatsapp.net'

/** Silences protocol logging so a failing assertion stays readable. */
const silentLogger = {
  level: 'error' as const,
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => silentLogger,
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

describe('bot end-to-end over the fake WhatsApp wire', () => {
  let server: FakeWaServer
  let app: { start(): Promise<void>; stop(): Promise<void> } | undefined
  let tmp: string

  beforeEach(async () => {
    tmp = await mkdtemp(path.join(tmpdir(), 'zapo-e2e-'))
    server = await FakeWaServer.start()
  })

  afterEach(async () => {
    setMenuSource(undefined)
    if (app !== undefined) await app.stop()
    await server.stop()
    await rm(tmp, { recursive: true, force: true })
  })

  it('replies to .ping sent by a real peer over the wire', async () => {
    const config = loadConfig({
      BOT_PREFIXES: '.',
      BOT_SESSION_ID: 'e2e',
      BOT_STORE_PATH: path.join(tmp, 'state.sqlite'),
      BOT_LOG_LEVEL: 'error',
    })

    // Memory store: this test proves routing over the wire, not SQLite
    // persistence (covered by tests/unit/store.test.ts).
    const client = new WaClient(
      {
        store: createStore(),
        sessionId: config.sessionId,
        chatSocketUrls: [server.url],
        testHooks: { noiseRootCa: server.noiseRootCa },
        history: { enabled: false },
      },
      silentLogger,
    )

    // The server plays the primary device: it needs the adv secret and identity
    // key the client advertises in its QR payload, so the pairing driver waits
    // for the real auth_qr event instead of using placeholder keys.
    const qr = deferred<string>()
    client.on('auth_qr', (event) => {
      qr.resolve(event.qr)
    })

    const loginPipeline = deferred<WaFakeConnectionPipeline>()
    let pairingStarted = false
    server.onAuthenticatedPipeline(async (pipeline) => {
      if (pipeline.clientPayload?.kind === 'login') {
        loginPipeline.resolve(pipeline)
        return
      }
      if (pipeline.clientPayload?.kind !== 'registration' || pairingStarted) return
      pairingStarted = true
      await server.runPairing(pipeline, { deviceJid: DEVICE_JID }, async () => {
        const parsed = parsePairingQrString((await qr.promise).trim())
        return {
          advSecretKey: parsed.advSecretKey,
          identityPublicKey: parsed.identityPublicKey,
        }
      })
    })

    const registry = await loadCommands(FEATURES_DIR, { extension: '.ts' })
    app = createApp({
      config,
      logger: { info: () => {}, warn: () => {}, error: () => {} },
      store: { destroy: () => Promise.resolve() },
      client,
      registry,
    })

    await app.start()

    // After pair-success the client reconnects and logs in; the connection
    // manager drives that reconnect (zapo-js never auto-reconnects).
    const pipeline = await loginPipeline.promise

    const peer = await server.createFakePeer({ jid: PEER_JID }, pipeline)
    await peer.sendConversation('.ping')

    const outbound = await peer.expectMessage({ timeoutMs: 20_000 })

    expect(outbound.message?.conversation ?? '').toContain('Pong')
  }, 90_000)
})
