/** Client surface needed for the link-code flow; requires an already-running connect(). */
export interface PairingRequester {
  requestPairingCode(phoneNumber: string): Promise<string>
}

/**
 * Digits only, country code included. WhatsApp rejects local-format numbers, and
 * a leading `0` is a national trunk prefix rather than a country code.
 */
export function normalizePairingNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits === '') {
    throw new Error('pairing number must contain digits in international format, e.g. 6281234567890')
  }
  if (digits.startsWith('0')) {
    throw new Error(
      'pairing number must start with a country code, not 0; use 6281234567890 instead of 081234567890',
    )
  }
  if (digits.length < 8) {
    throw new Error(`pairing number is too short (${String(digits.length)} digits) to include a country code`)
  }
  return digits
}

/** 4-4 grouping matches how WhatsApp renders the 8-character link code on the phone. */
export function formatPairingCode(code: string): string {
  const compact = code.trim()
  if (compact.length !== 8) return compact
  return `${compact.slice(0, 4)} ${compact.slice(4)}`
}

export async function requestPairingCode(
  requester: PairingRequester,
  rawNumber: string,
): Promise<{ readonly number: string; readonly code: string }> {
  const number = normalizePairingNumber(rawNumber)
  const code = await requester.requestPairingCode(number)
  return { number, code: formatPairingCode(code) }
}
