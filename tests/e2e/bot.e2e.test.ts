import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FakeWaServer, parsePairingQrString } from '@zapo-js/fake-server'
import type { WaFakeConnectionPipeline } from '@zapo-js/fake-server'
import { createStore, WaClient } from 'zapo-js'

import { createApp } from '../../lib/app.js'
import { loadCommands } from '../../lib/commands/loader.js'
import { loadConfig } from '../../lib/config.js'
import { createSettingsStore } from '../../lib/settings.js'
import type { SettingsStore } from '../../lib/settings.js'

const PLUGINS_DIR = path.resolve(import.meta.dirname, '../../plugins')
const OWNER_JID = '5511999999999@s.whatsapp.net'
const PEER_JID = '5511888888888@s.whatsapp.net'
const DEVICE_JID = '6281234567890.0:1@s.whatsapp.net'
const GROUP_JID = '120363000000000000@g.us'

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

/** Lets an inbound message finish routing; the absence of a reply needs a wait. */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 3_000))
}


describe('bot end-to-end over the fake WhatsApp wire', () => {
  let server: FakeWaServer
  let app: { start(): Promise<void>; stop(): Promise<void> } | undefined
  let tmp: string
  let settings: SettingsStore

  beforeEach(async () => {
    tmp = await mkdtemp(path.join(tmpdir(), 'zapo-e2e-'))
    server = await FakeWaServer.start()
    settings = await createSettingsStore(path.join(tmp, 'settings.json'))
  })

  afterEach(async () => {
        if (app !== undefined) await app.stop()
    await server.stop()
    await rm(tmp, { recursive: true, force: true })
  })

  /**
   * Pairs the bot against the fake primary device and returns the logged-in
   * pipeline plus a peer that plays the owner's phone.
   */
  async function pairedBot(): Promise<{
    peer: Awaited<ReturnType<FakeWaServer['createFakePeer']>>
    pipeline: WaFakeConnectionPipeline
  }> {
    const config = loadConfig({
      BOT_PREFIXES: '.',
      BOT_SESSION_ID: 'e2e',
      // Private mode: only the owner is answered in a private chat, so the peer
      // driving this test is the owner.
      BOT_OWNER_NUMBER: '5511999999999',
      BOT_STORE_PATH: path.join(tmp, 'state.sqlite'),
      BOT_LOG_LEVEL: 'error',
    })

    // Memory store: these tests prove routing over the wire, not SQLite
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

    const registry = await loadCommands(PLUGINS_DIR, { extension: '.ts' })
    app = createApp({
      config,
      logger: { info: () => {}, warn: () => {}, error: () => {} },
      store: { destroy: () => Promise.resolve() },
      client,
      registry,
      settings,
    })

    await app.start()

    // After pair-success the client reconnects and logs in; the connection
    // manager drives that reconnect (zapo-js never auto-reconnects).
    const pipeline = await loginPipeline.promise
    const peer = await server.createFakePeer({ jid: OWNER_JID }, pipeline)
    return { peer, pipeline }
  }

  it('replies to .ping sent by the owner in a private chat', async () => {
    const { peer } = await pairedBot()

    await peer.sendConversation('.ping')
    const outbound = await peer.expectMessage({ timeoutMs: 20_000 })

    expect(outbound.message?.conversation ?? '').toContain('Pong')
  }, 90_000)


  it('applies a runtime mode change to group routing without restart', async () => {
    const { peer, pipeline } = await pairedBot()
    const nonOwner = await server.createFakePeer({ jid: PEER_JID }, pipeline)

    // The group must exist server-side, otherwise the outbound stanza has no
    // participant list to fan out to.
    server.createFakeGroup({
      groupJid: GROUP_JID,
      subject: 'Komunitas',
      participants: [peer, nonOwner],
    })

    // Assert on captured stanzas rather than peer decryption: a group reply is
    // fanned out with sender-key distribution the fake peer does not bootstrap,
    // so expectGroupMessage() times out even when the bot did answer. The
    // stanza address is the real wire evidence of whether a reply was sent.
    const groupReplies: string[] = []
    server.onCapturedStanza((stanza) => {
      if (stanza.tag === 'message' && stanza.attrs?.['to'] === GROUP_JID) {
        groupReplies.push(GROUP_JID)
      }
    })

    await nonOwner.sendGroupConversation(GROUP_JID, '.ping')
    await settle()
    expect(groupReplies).toEqual([])

    await settings.setMode('group-only')

    await nonOwner.sendGroupConversation(GROUP_JID, '.ping')
    await settle()
    expect(groupReplies).toEqual([GROUP_JID])
  }, 90_000)
})
