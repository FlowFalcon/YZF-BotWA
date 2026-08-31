import {
  normalizePairingNumber,
  renderPairingCodeToTerminal,
  requestPairingCode,
  type PairingCodeRenderer,
  type PairingRequester,
} from './pairing.js'
import { renderQrToTerminal, type QrRenderer } from './qr.js'

export interface AuthQrEvent {
  readonly qr: string
  readonly ttlMs: number
}

export interface AuthPairingRequiredEvent {
  readonly forceManual: boolean
}

/**
 * Safe subset of zapo's `WaAuthCredentials`. The real object carries private key
 * material (`noiseKeyPair`, `advSecretKey`, ...) — only identity fields are read
 * here so nothing sensitive can reach a reporter (SECURITY.md §1).
 */
export interface AuthPairedCredentials {
  readonly meJid?: string
  readonly meDisplayName?: string
}

export interface AuthPairedEvent {
  readonly credentials: AuthPairedCredentials
}

export interface AuthPasskeyRequiredEvent {
  readonly hasSigner: boolean
}

/** Structural view of zapo's `WaClientEventMap` auth events; only what this controller uses. */
export interface AuthEvents {
  readonly auth_qr: (event: AuthQrEvent) => void
  readonly auth_pairing_required: (event: AuthPairingRequiredEvent) => void
  readonly auth_paired: (event: AuthPairedEvent) => void
  readonly auth_passkey_required: (event: AuthPasskeyRequiredEvent) => void
}

/**
 * Structural client contract. Declared as per-event overloads rather than a
 * generic over `AuthEvents` so a real `WaClient` (generic over the much larger
 * `WaClientEventMap`) stays assignable to it.
 */
export interface AuthClient {
  on(event: 'auth_qr', listener: (event: AuthQrEvent) => void): unknown
  on(event: 'auth_pairing_required', listener: (event: AuthPairingRequiredEvent) => void): unknown
  on(event: 'auth_paired', listener: (event: AuthPairedEvent) => void): unknown
  on(event: 'auth_passkey_required', listener: (event: AuthPasskeyRequiredEvent) => void): unknown
  off(event: 'auth_qr', listener: (event: AuthQrEvent) => void): unknown
  off(event: 'auth_pairing_required', listener: (event: AuthPairingRequiredEvent) => void): unknown
  off(event: 'auth_paired', listener: (event: AuthPairedEvent) => void): unknown
  off(event: 'auth_passkey_required', listener: (event: AuthPasskeyRequiredEvent) => void): unknown
  readonly auth: PairingRequester
}

export type EffectiveAuthMethod = 'qr' | 'pairing'

/** Operator-facing notices; deliberately free of credential material. */
export type AuthNotice =
  | { readonly kind: 'pairing-code'; readonly code: string }
  | { readonly kind: 'paired'; readonly meJid?: string; readonly meDisplayName?: string }
  | {
      readonly kind: 'passkey-required'
      readonly canProceed: boolean
      readonly message: string
    }

export interface AuthControllerConfig {
  readonly authMethod: 'auto' | 'qr' | 'pairing'
  readonly pairingNumber?: string
}

export interface AuthControllerOptions {
  readonly client: AuthClient
  readonly config: AuthControllerConfig
  /** Defaults to terminal rendering; injected in tests to keep stdout clean. */
  readonly renderQr?: QrRenderer
  readonly renderPairingCode?: PairingCodeRenderer
  readonly onNotice?: (notice: AuthNotice) => void
  readonly onError?: (error: unknown) => void
}

export interface AuthController {
  readonly method: EffectiveAuthMethod
  readonly latestQr: string | undefined
  attach(): void
  detach(): void
}

export function createAuthController(options: AuthControllerOptions): AuthController {
  const {
    client,
    config,
    renderQr = renderQrToTerminal,
    renderPairingCode = renderPairingCodeToTerminal,
    onNotice,
    onError,
  } = options
  // 'auto' prefers the link-code flow only when a target number is configured.
  const method: EffectiveAuthMethod =
    config.authMethod === 'pairing' ||
    (config.authMethod === 'auto' && config.pairingNumber !== undefined)
      ? 'pairing'
      : 'qr'

  // Config does not enforce this pairing: the auth layer owns the mode/number coupling.
  // Validate before connect so a bad number fails at startup, not mid-handshake.
  let pairingNumber: string | undefined
  if (method === 'pairing') {
    if (config.pairingNumber === undefined) {
      throw new Error(
        'auth method "pairing" requires BOT_PAIRING_NUMBER; set it or use BOT_AUTH_METHOD=qr',
      )
    }
    pairingNumber = normalizePairingNumber(config.pairingNumber)
  }

  let latestQr: string | undefined

  const handleQr = (event: AuthQrEvent): void => {
    latestQr = event.qr
    // zapo emits auth_qr on every rotation regardless of the chosen method.
    // Rendering it in pairing mode showed the operator a QR they never asked
    // for and hid the link code they were waiting on.
    if (method === 'qr') renderQr(event.qr)
  }

  // requestPairingCode needs a live connection, so it can only run from this event.
  const handlePairingRequired = (): void => {
    if (pairingNumber === undefined) return
    requestPairingCode(client.auth, pairingNumber).then(
      ({ code }) => {
        renderPairingCode(code)
        onNotice?.({ kind: 'pairing-code', code })
      },
      (error: unknown) => {
        onError?.(error)
      },
    )
  }

  const handlePaired = (event: AuthPairedEvent): void => {
    const { meJid, meDisplayName } = event.credentials
    // Field-by-field pick: the credentials object itself must never leave this scope.
    onNotice?.({
      kind: 'paired',
      ...(meJid === undefined ? {} : { meJid }),
      ...(meDisplayName === undefined ? {} : { meDisplayName }),
    })
  }

  const handlePasskeyRequired = (event: AuthPasskeyRequiredEvent): void => {
    // No headless bypass exists: without a signer the server-forced passkey link
    // cannot complete, so this is reported as an operational condition only.
    onNotice?.({
      kind: 'passkey-required',
      canProceed: event.hasSigner,
      message: event.hasSigner
        ? 'WhatsApp requires a passkey to link this device; the configured signer is handling the assertion.'
        : 'WhatsApp requires a passkey to link this device and no signer is configured; the link cannot complete headless. Approve the link on the account owner authenticator.',
    })
  }

  let attached = false

  return {
    method,
    get latestQr() {
      return latestQr
    },
    attach(): void {
      if (attached) return
      attached = true
      client.on('auth_qr', handleQr)
      client.on('auth_pairing_required', handlePairingRequired)
      client.on('auth_paired', handlePaired)
      client.on('auth_passkey_required', handlePasskeyRequired)
    },
    detach(): void {
      if (!attached) return
      attached = false
      client.off('auth_qr', handleQr)
      client.off('auth_pairing_required', handlePairingRequired)
      client.off('auth_paired', handlePaired)
      client.off('auth_passkey_required', handlePasskeyRequired)
    },
  }
}
