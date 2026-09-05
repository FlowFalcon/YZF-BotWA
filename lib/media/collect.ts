import type { Readable } from 'node:stream'

/**
 * Mengumpulkan stream menjadi satu buffer dengan batas byte keras.
 *
 * Diperiksa sambil membaca, bukan setelah: video 100 MB tidak boleh dibuffer
 * penuh sebelum ditolak.
 */
export async function collectStream(stream: Readable, maxBytes: number): Promise<Uint8Array> {
  const chunks: Uint8Array[] = []
  let size = 0
  for await (const chunk of stream) {
    const bytes = chunk as Uint8Array
    size += bytes.byteLength
    if (size > maxBytes) throw new RangeError('media exceeds the size ceiling')
    chunks.push(bytes)
  }

  const out = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}
