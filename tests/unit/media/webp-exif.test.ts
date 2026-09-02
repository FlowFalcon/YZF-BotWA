import { describe, expect, it } from 'vitest'
import { attachExifChunk } from '../../../lib/media/webp-exif.js'

const riff = (payload: Uint8Array): Uint8Array => {
  const out = new Uint8Array(12 + payload.byteLength)
  out.set(new TextEncoder().encode('RIFF'), 0)
  new DataView(out.buffer).setUint32(4, 4 + payload.byteLength, true)
  out.set(new TextEncoder().encode('WEBP'), 8)
  out.set(payload, 12)
  return out
}

const chunks = (webp: Uint8Array): readonly string[] => {
  const view = new DataView(webp.buffer, webp.byteOffset, webp.byteLength)
  const found: string[] = []
  let offset = 12
  while (offset + 8 <= webp.byteLength) {
    const tag = new TextDecoder().decode(webp.subarray(offset, offset + 4))
    const size = view.getUint32(offset + 4, true)
    found.push(tag)
    offset += 8 + size + (size % 2)
  }
  return found
}

describe('attachExifChunk', () => {
  const body = new Uint8Array([...new TextEncoder().encode('VP8 '), 4, 0, 0, 0, 1, 2, 3, 4])

  it('appends an EXIF chunk while keeping the original chunks intact', () => {
    const out = attachExifChunk(riff(body), new Uint8Array([9, 9, 9, 9]))
    expect(chunks(out)).toEqual(['VP8 ', 'EXIF'])
  })

  it('rewrites the RIFF size field to cover the new chunk', () => {
    const out = attachExifChunk(riff(body), new Uint8Array([9, 9, 9, 9]))
    const declared = new DataView(out.buffer, out.byteOffset, out.byteLength).getUint32(4, true)
    expect(declared).toBe(out.byteLength - 8)
  })

  it('pads an odd-sized payload to keep chunks word-aligned', () => {
    const out = attachExifChunk(riff(body), new Uint8Array([1, 2, 3]))
    expect(out.byteLength % 2).toBe(0)
    expect(chunks(out)).toEqual(['VP8 ', 'EXIF'])
  })

  it('rejects input that is not a RIFF/WEBP container', () => {
    expect(() => attachExifChunk(new Uint8Array([1, 2, 3, 4]), new Uint8Array([1]))).toThrow(
      /not a webp/i,
    )
  })
})
