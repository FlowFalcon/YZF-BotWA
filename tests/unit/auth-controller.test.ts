import { describe, expect, it } from 'vitest'

import {
  createAuthController,
  type AuthClient,
  type AuthEvents,
  type AuthNotice,
  type AuthPairedCredentials,
} from '../../lib/auth/auth-controller.js'

type Listener = AuthEvents[keyof AuthEvents]

interface FakeClient extends AuthClient {
  readonly pairingRequests: readonly string[]
  readonly listenerCount: number
  emitQr(qr: string, ttlMs?: number): void
  emitPairingRequired(forceManual?: boolean): void
  emitPaired(credentials: AuthPairedCredentials & Record<string, unknown>): void
  emitPasskeyRequired(hasSigner: boolean): void
  settle(): Promise<void>
}

function createFakeClient(): FakeClient {
  const listeners = new Map<keyof AuthEvents, Listener[]>()
  const pairingRequests: string[] = []
  const pending: Array<Promise<unknown>> = []

  const emit = <K extends keyof AuthEvents>(
    event: K,
    payload: Parameters<AuthEvents[K]>[0],
  ): void => {
    for (const listener of [...(listeners.get(event) ?? [])]) {
      ;(listener as (value: Parameters<AuthEvents[K]>[0]) => void)(payload)
    }
  }

  return {
    on(event, listener) {
      const current = listeners.get(event) ?? []
      current.push(listener)
      listeners.set(event, current)
      return this
    },
    off(event, listener) {
      const current = listeners.get(event) ?? []
      listeners.set(
        event,
        current.filter((candidate) => candidate !== listener),
      )
      return this
    },
    auth: {
      requestPairingCode(phoneNumber) {
        pairingRequests.push(phoneNumber)
        const result = Promise.resolve('ABCD1234')
        pending.push(result)
        return result
      },
    },
    get pairingRequests() {
      return pairingRequests
    },
    get listenerCount() {
      return [...listeners.values()].reduce((total, entry) => total + entry.length, 0)
    },
    emitQr(qr, ttlMs = 20_000) {
      emit('auth_qr', { qr, ttlMs })
    },
    emitPairingRequired(forceManual = false) {
      emit('auth_pairing_required', { forceManual })
    },
    emitPaired(credentials) {
      emit('auth_paired', { credentials })
    },
    emitPasskeyRequired(hasSigner) {
      emit('auth_passkey_required', { hasSigner })
    },
    async settle() {
      await Promise.all(pending)
      await Promise.resolve()
    },
  }
}

describe('createAuthController', () => {
  it('renders the latest QR when auth_qr rotates', () => {
    const client = createFakeClient()
    const rendered: string[] = []
    const controller = createAuthController({
      client,
      config: { authMethod: 'qr' },
      renderQr: (qr) => rendered.push(qr),
    })

    controller.attach()
    client.emitQr('qr-one')
    client.emitQr('qr-two')

    expect(rendered).toEqual(['qr-one', 'qr-two'])
    expect(controller.latestQr).toBe('qr-two')
  })

  it('never requests a pairing code in qr mode', async () => {
    const client = createFakeClient()
    const controller = createAuthController({
      client,
      config: { authMethod: 'qr', pairingNumber: '6281234567890' },
      renderQr: () => undefined,
    })

    controller.attach()
    client.emitQr('qr-one')
    client.emitPairingRequired(false)
    await client.settle()

    expect(controller.method).toBe('qr')
    expect(client.pairingRequests).toEqual([])
  })

  it('requests the pairing code only after auth_pairing_required', async () => {
    const client = createFakeClient()
    const notices: AuthNotice[] = []
    const controller = createAuthController({
      client,
      config: { authMethod: 'pairing', pairingNumber: '+62 812-3456-7890' },
      renderQr: () => undefined,
      onNotice: (notice) => notices.push(notice),
    })

    controller.attach()
    expect(client.pairingRequests).toEqual([])

    client.emitPairingRequired(false)
    await client.settle()

    expect(client.pairingRequests).toEqual(['6281234567890'])
    expect(notices).toEqual([{ kind: 'pairing-code', code: 'ABCD 1234' }])
  })

  it('resolves auto to pairing when a number exists and to qr when it does not', () => {
    const withNumber = createAuthController({
      client: createFakeClient(),
      config: { authMethod: 'auto', pairingNumber: '6281234567890' },
      renderQr: () => undefined,
    })
    const withoutNumber = createAuthController({
      client: createFakeClient(),
      config: { authMethod: 'auto' },
      renderQr: () => undefined,
    })

    expect(withNumber.method).toBe('pairing')
    expect(withoutNumber.method).toBe('qr')
  })

  it('fails fast when pairing mode has no pairing number', () => {
    expect(() =>
      createAuthController({
        client: createFakeClient(),
        config: { authMethod: 'pairing' },
        renderQr: () => undefined,
      }),
    ).toThrow(/BOT_PAIRING_NUMBER/)
  })

  it('rejects a pairing number without digits', () => {
    expect(() =>
      createAuthController({
        client: createFakeClient(),
        config: { authMethod: 'pairing', pairingNumber: '+-- --' },
        renderQr: () => undefined,
      }),
    ).toThrow(/digits/)
  })

  it('reports safe identity on auth_paired and never the credentials object', () => {
    const client = createFakeClient()
    const notices: AuthNotice[] = []
    const controller = createAuthController({
      client,
      config: { authMethod: 'qr' },
      renderQr: () => undefined,
      onNotice: (notice) => notices.push(notice),
    })

    controller.attach()
    const secret = 'do-not-log-me'
    client.emitPaired({
      meJid: '6281234567890:12@s.whatsapp.net',
      meDisplayName: 'Test Bot',
      advSecretKey: secret,
    })

    expect(notices).toEqual([
      { kind: 'paired', meJid: '6281234567890:12@s.whatsapp.net', meDisplayName: 'Test Bot' },
    ])
    expect(JSON.stringify(notices)).not.toContain(secret)
    expect(controller.latestQr).toBeUndefined()
  })

  it('surfaces an actionable passkey message without attempting a bypass', () => {
    const client = createFakeClient()
    const notices: AuthNotice[] = []
    const controller = createAuthController({
      client,
      config: { authMethod: 'pairing', pairingNumber: '6281234567890' },
      renderQr: () => undefined,
      onNotice: (notice) => notices.push(notice),
    })

    controller.attach()
    client.emitPasskeyRequired(false)

    expect(notices).toEqual([
      {
        kind: 'passkey-required',
        canProceed: false,
        message:
          'WhatsApp requires a passkey to link this device and no signer is configured; the link cannot complete headless. Approve the link on the account owner authenticator.',
      },
    ])
    expect(client.pairingRequests).toEqual([])
  })

  it('never renders the QR in pairing mode', () => {
    const client = createFakeClient()
    const rendered: string[] = []
    const controller = createAuthController({
      client,
      config: { authMethod: 'pairing', pairingNumber: '6281234567890' },
      renderQr: (qr) => rendered.push(qr),
    })

    controller.attach()
    // zapo emits auth_qr on every rotation regardless of method; printing it in
    // pairing mode is what made the operator scan a QR they never asked for.
    client.emitQr('qr-one')

    expect(rendered).toEqual([])
    expect(controller.latestQr).toBe('qr-one')
  })

  it('renders the pairing code for the operator in pairing mode', async () => {
    const client = createFakeClient()
    const codes: string[] = []
    const controller = createAuthController({
      client,
      config: { authMethod: 'pairing', pairingNumber: '6281234567890' },
      renderQr: () => undefined,
      renderPairingCode: (code) => codes.push(code),
    })

    controller.attach()
    client.emitPairingRequired(false)
    await client.settle()

    expect(codes).toEqual(['ABCD 1234'])
  })

  it('requests the pairing code on the first QR, without waiting for auth_pairing_required', async () => {
    const client = createFakeClient()
    const codes: string[] = []
    const controller = createAuthController({
      client,
      config: { authMethod: 'pairing', pairingNumber: '6281234567890' },
      renderQr: () => undefined,
      renderPairingCode: (code) => codes.push(code),
    })

    controller.attach()
    // Live observation: WhatsApp emits auth_qr but auth_pairing_required only
    // fires once the QR refresh budget is exhausted (forceManual). Waiting for
    // it meant the code was never requested.
    client.emitQr('qr-one')
    await client.settle()

    expect(client.pairingRequests).toEqual(['6281234567890'])
    expect(codes).toEqual(['ABCD 1234'])
  })

  it('requests the pairing code once across repeated QR and pairing events', async () => {
    const client = createFakeClient()
    const controller = createAuthController({
      client,
      config: { authMethod: 'pairing', pairingNumber: '6281234567890' },
      renderQr: () => undefined,
      renderPairingCode: () => undefined,
    })

    controller.attach()
    client.emitQr('qr-one')
    client.emitQr('qr-two')
    client.emitPairingRequired(false)
    await client.settle()

    expect(client.pairingRequests).toEqual(['6281234567890'])
  })

  // forceManual means the server discarded the previous code; a fresh one is required.
  it('requests a new code when pairing is forced manual', async () => {
    const client = createFakeClient()
    const controller = createAuthController({
      client,
      config: { authMethod: 'pairing', pairingNumber: '6281234567890' },
      renderQr: () => undefined,
      renderPairingCode: () => undefined,
    })

    controller.attach()
    client.emitQr('qr-one')
    await client.settle()
    client.emitPairingRequired(true)
    await client.settle()

    expect(client.pairingRequests).toEqual(['6281234567890', '6281234567890'])
  })

  it('attaches each listener once and detaches them all', () => {
    const client = createFakeClient()
    const rendered: string[] = []
    const controller = createAuthController({
      client,
      config: { authMethod: 'qr' },
      renderQr: (qr) => rendered.push(qr),
    })

    controller.attach()
    controller.attach()
    expect(client.listenerCount).toBe(4)

    client.emitQr('qr-one')
    expect(rendered).toEqual(['qr-one'])

    controller.detach()
    expect(client.listenerCount).toBe(0)

    client.emitQr('qr-two')
    expect(rendered).toEqual(['qr-one'])
  })
})
