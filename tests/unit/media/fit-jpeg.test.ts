import { describe, expect, it } from 'vitest'
import sharp from 'sharp'

import { fitJpeg } from '../../../lib/media/fit-jpeg.js'

/** Noise resists JPEG compression, so the quality ladder is actually exercised. */
async function noisePng(size: number): Promise<Uint8Array> {
  const pixels = Buffer.alloc(size * size * 3)
  for (let index = 0; index < pixels.length; index += 1) {
    pixels[index] = (index * 2_654_435_761) % 251
  }
  const png = await sharp(pixels, { raw: { width: size, height: size, channels: 3 } })
    .png()
    .toBuffer()
  return new Uint8Array(png)
}

describe('fitJpeg', () => {
  it('resizes within the longest edge and keeps aspect ratio', async () => {
    const source = await sharp({
      create: { width: 1_600, height: 900, channels: 3, background: '#204060' },
    })
      .png()
      .toBuffer()

    const fitted = await fitJpeg(new Uint8Array(source), 720, 400 * 1024)

    expect(fitted.width).toBe(720)
    expect(fitted.height).toBe(405)
    expect(await sharp(fitted.bytes).metadata()).toMatchObject({ format: 'jpeg' })
  })

  it('never enlarges an image that is already smaller', async () => {
    const source = await sharp({
      create: { width: 120, height: 80, channels: 3, background: '#ffffff' },
    })
      .png()
      .toBuffer()

    const fitted = await fitJpeg(new Uint8Array(source), 720, 400 * 1024)

    expect(fitted.width).toBe(120)
    expect(fitted.height).toBe(80)
  })

  it('steps quality down until the byte budget is met', async () => {
    const source = await noisePng(600)

    const generous = await fitJpeg(source, 600, 400 * 1024)
    const tight = await fitJpeg(source, 600, 20 * 1024)

    expect(tight.bytes.byteLength).toBeLessThanOrEqual(20 * 1024)
    expect(tight.bytes.byteLength).toBeLessThan(generous.bytes.byteLength)
  })

  it('produces bytes under the 64 KiB inline cap at 240px', async () => {
    const source = await noisePng(800)

    const fitted = await fitJpeg(source, 240, 64 * 1024)

    expect(fitted.width).toBe(240)
    expect(fitted.bytes.byteLength).toBeLessThanOrEqual(64 * 1024)
  })

  it('reports the budget it could not meet instead of shipping an oversized image', async () => {
    const source = await noisePng(900)

    // 200 bytes is unreachable even at the 96px floor and quality 40.
    await expect(fitJpeg(source, 900, 200)).rejects.toThrow(/200/)
  })

  it('shrinks dimensions when the quality ladder alone cannot meet the budget', async () => {
    const source = await noisePng(900)

    const fitted = await fitJpeg(source, 900, 6 * 1024)

    expect(fitted.bytes.byteLength).toBeLessThanOrEqual(6 * 1024)
    expect(fitted.width).toBeLessThan(900)
  })

  it('rejects bytes that are not a decodable image', async () => {
    await expect(fitJpeg(new Uint8Array([1, 2, 3, 4]), 240, 64 * 1024)).rejects.toThrow()
  })
})
