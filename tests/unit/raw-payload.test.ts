import { describe, expect, it } from 'vitest'
import { MAX_RAW_BYTES, parseRawPayload } from '../../src/messages/raw-payload.js'

describe('parseRawPayload', () => {
  it('parses a proto-shaped object', () => {
    const result = parseRawPayload('{"conversation":"hi"}')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toEqual({ conversation: 'hi' })
  })

  it('decodes a __bytes wrapper into real bytes, not a base64 string', () => {
    // unifiedResponse.data and signature are bytes fields; a base64 string
    // would be double-encoded on the wire.
    const base64 = Buffer.from('hello').toString('base64')
    const result = parseRawPayload(`{"unifiedResponse":{"data":{"__bytes":"${base64}"}}}`)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const data = (result.value as { unifiedResponse: { data: unknown } }).unifiedResponse.data
    expect(data).toBeInstanceOf(Uint8Array)
    expect(new TextDecoder().decode(data as Uint8Array)).toBe('hello')
  })

  it('decodes __bytes nested inside arrays', () => {
    const base64 = Buffer.from('x').toString('base64')
    const result = parseRawPayload(`{"proofs":[{"__bytes":"${base64}"}]}`)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const proofs = (result.value as { proofs: unknown[] }).proofs
    expect(proofs[0]).toBeInstanceOf(Uint8Array)
  })

  it('rejects invalid json with the parser message, not a crash', () => {
    const result = parseRawPayload('{oops')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatch(/json/i)
  })

  it('rejects a payload that is not an object', () => {
    for (const input of ['"text"', '42', 'null', '[1,2]']) {
      const result = parseRawPayload(input)
      expect(result.ok).toBe(false)
    }
  })

  it('rejects an empty object, which would send nothing', () => {
    const result = parseRawPayload('{}')
    expect(result.ok).toBe(false)
  })

  it('rejects payloads above the size cap', () => {
    const result = parseRawPayload(`{"conversation":"${'x'.repeat(MAX_RAW_BYTES)}"}`)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatch(/besar|large/i)
  })

  it('rejects prototype-polluting keys at any depth', () => {
    for (const input of [
      '{"__proto__":{"polluted":true}}',
      '{"a":{"constructor":{"x":1}}}',
      '{"a":[{"prototype":1}]}',
    ]) {
      const result = parseRawPayload(input)
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toMatch(/kunci|key/i)
    }
  })

  it('rejects a __bytes wrapper whose value is not a base64 string', () => {
    const result = parseRawPayload('{"data":{"__bytes":123}}')
    expect(result.ok).toBe(false)
  })

  it('rejects nesting deep enough to be an attack rather than a message', () => {
    const deep = '{"a":'.repeat(200) + '1' + '}'.repeat(200)
    const result = parseRawPayload(deep)
    expect(result.ok).toBe(false)
  })

  it('leaves plain strings, numbers, and booleans untouched', () => {
    const result = parseRawPayload('{"a":"s","b":2,"c":true,"d":null}')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toEqual({ a: 's', b: 2, c: true, d: null })
  })

  it('reports only top-level field names, never the payload contents', () => {
    // The payload can carry anything the owner pasted; logging it verbatim
    // would defeat SECURITY.md's no-raw-message rule.
    const result = parseRawPayload('{"conversation":"secret text","messageContextInfo":{}}')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.fields).toEqual(['conversation', 'messageContextInfo'])
    expect(result.fields.join()).not.toContain('secret')
  })
})
