const RIFF = 'RIFF'
const WEBP = 'WEBP'
const EXIF = 'EXIF'

const ascii = (bytes: Uint8Array, offset: number): string =>
  new TextDecoder().decode(bytes.subarray(offset, offset + 4))

/**
 * Appends an `EXIF` chunk to a WebP file and fixes the RIFF size field.
 *
 * ffmpeg cannot write this chunk, and the WhatsApp client reads the sticker's
 * pack name from it, so the container is edited directly rather than pulling in
 * a WebP muxer dependency. Chunks are word-aligned per the RIFF spec: an
 * odd-sized payload gets a trailing pad byte that is not counted in the
 * chunk's own size field.
 */
export function attachExifChunk(webp: Uint8Array, exif: Uint8Array): Uint8Array {
  if (webp.byteLength < 12 || ascii(webp, 0) !== RIFF || ascii(webp, 8) !== WEBP) {
    throw new Error('sticker payload is not a WEBP container')
  }

  const pad = exif.byteLength % 2
  const out = new Uint8Array(webp.byteLength + 8 + exif.byteLength + pad)
  out.set(webp, 0)

  const view = new DataView(out.buffer)
  out.set(new TextEncoder().encode(EXIF), webp.byteLength)
  view.setUint32(webp.byteLength + 4, exif.byteLength, true)
  out.set(exif, webp.byteLength + 8)

  // RIFF size counts everything after the size field itself.
  view.setUint32(4, out.byteLength - 8, true)
  return out
}
