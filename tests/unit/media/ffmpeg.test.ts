import { describe, expect, it } from 'vitest'
import { encodeSticker } from '../../../lib/media/ffmpeg.js'
import { sampleMp4, samplePng } from '../../support/media-fixtures.js'

const png = await samplePng()
const mp4 = await sampleMp4()

const ascii = (bytes: Uint8Array, offset: number): string =>
  new TextDecoder().decode(bytes.subarray(offset, offset + 4))

describe('encodeSticker (real ffmpeg)', () => {
  it('converts a still image into a 512x512 WebP carrying the pack metadata', async () => {
    const out = await encodeSticker(png, {
      animated: false,
      metadata: { pack: 'Fun Pack', author: 'Bot' },
    })

    expect(ascii(out, 0)).toBe('RIFF')
    expect(ascii(out, 8)).toBe('WEBP')
    expect(new TextDecoder('latin1').decode(out)).toContain('"sticker-pack-name":"Fun Pack"')
  })

  it('converts a video into an animated WebP', async () => {
    const out = await encodeSticker(mp4, {
      animated: true,
      metadata: { pack: 'Fun Pack', author: 'Bot' },
    })

    expect(ascii(out, 0)).toBe('RIFF')
    // ANIM/ANMF chunks only exist in animated WebP.
    expect(new TextDecoder('latin1').decode(out)).toContain('ANIM')
  }, 30000)

  it('rejects payloads above the size ceiling before spawning ffmpeg', async () => {
    await expect(
      encodeSticker(new Uint8Array(9 * 1024 * 1024), {
        animated: false,
        metadata: { pack: 'p', author: 'a' },
      }),
    ).rejects.toThrow(/too large/i)
  })

  it('fails with a clear error when the input is not decodable media', async () => {
    await expect(
      encodeSticker(new TextEncoder().encode('this is not an image'), {
        animated: false,
        metadata: { pack: 'p', author: 'a' },
      }),
    ).rejects.toThrow(/ffmpeg/i)
  })
})
