/**
 * Parses a raw `Proto.IMessage` payload pasted into chat.
 *
 * `JSON.parse`, never `eval` or `Function`: SECURITY.md §2 forbids executing
 * source from a message, and the payloads this exists for (interactiveMessage,
 * botForwardedMessage, locationMessage…) are pure data anyway — they need no
 * execution to be useful.
 */

/** Big enough for an inline HTML payload, small enough to stay a message. */
export const MAX_RAW_BYTES = 131_072

/** A message nested deeper than this is an attack, not content. */
const MAX_DEPTH = 24

/**
 * Marker for protobuf bytes fields (`unifiedResponse.data`, `signature`,
 * `certificateChain`). JSON has no byte type, and a bare base64 string would be
 * double-encoded on the wire.
 */
const BYTES_KEY = '__bytes'

/** Keys that would walk the prototype chain instead of setting a field. */
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/

export type RawParseResult =
  | { readonly ok: true; readonly value: Record<string, unknown>; readonly fields: readonly string[] }
  | { readonly ok: false; readonly error: string }

export function parseRawPayload(input: string): RawParseResult {
  if (Buffer.byteLength(input, 'utf8') > MAX_RAW_BYTES) {
    return { ok: false, error: `Payload terlalu besar (maks ${MAX_RAW_BYTES} byte).` }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(input)
  } catch (error) {
    return { ok: false, error: `JSON tidak valid: ${(error as Error).message}` }
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: 'Payload harus objek JSON, misal {"conversation":"hi"}.' }
  }

  if (Object.keys(parsed).length === 0) {
    return { ok: false, error: 'Payload kosong, tidak ada yang bisa dikirim.' }
  }

  try {
    const value = revive(parsed, 0) as Record<string, unknown>
    return { ok: true, value, fields: Object.keys(value) }
  } catch (error) {
    return { ok: false, error: (error as Error).message }
  }
}

/** Walks the tree converting `__bytes` wrappers and rejecting unsafe keys. */
function revive(node: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH) {
    throw new Error(`Payload bersarang terlalu dalam (maks ${MAX_DEPTH} tingkat).`)
  }

  if (Array.isArray(node)) {
    return node.map((item) => revive(item, depth + 1))
  }

  if (typeof node !== 'object' || node === null) {
    return node
  }

  const entries = Object.entries(node)

  const bytes = entries.find(([key]) => key === BYTES_KEY)
  if (bytes !== undefined) {
    if (entries.length !== 1) {
      throw new Error(`Objek ${BYTES_KEY} tidak boleh punya kunci lain.`)
    }
    return decodeBytes(bytes[1])
  }

  const result: Record<string, unknown> = {}
  for (const [key, child] of entries) {
    if (FORBIDDEN_KEYS.has(key)) {
      throw new Error(`Kunci "${key}" tidak diizinkan.`)
    }
    result[key] = revive(child, depth + 1)
  }
  return result
}

function decodeBytes(value: unknown): Uint8Array {
  if (typeof value !== 'string' || !BASE64_PATTERN.test(value)) {
    throw new Error(`${BYTES_KEY} harus string base64.`)
  }
  return new Uint8Array(Buffer.from(value, 'base64'))
}
