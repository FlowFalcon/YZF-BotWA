import { describe, expect, it } from 'vitest'
import { buildStickerExif, STICKER_SIZE, stickerArgs } from '../../../src/media/sticker-codec.js'

describe('stickerArgs', () => {
  it('scales into a square canvas with transparent padding, never cropping', () => {
    const args = stickerArgs({ animated: false })
    const filter = args[args.indexOf('-vf') + 1] ?? ''
    expect(filter).toContain(`scale=${String(STICKER_SIZE)}:${String(STICKER_SIZE)}`)
    expect(filter).toContain('force_original_aspect_ratio=decrease')
    expect(filter).toContain('pad=')
    expect(filter).toContain('#00000000')
  })

  it('encodes static input with libwebp and a single frame', () => {
    const args = stickerArgs({ animated: false })
    expect(args[args.indexOf('-c:v') + 1]).toBe('libwebp')
    expect(args).toContain('-frames:v')
    expect(args[args.indexOf('-frames:v') + 1]).toBe('1')
  })

  it('encodes animated input with libwebp_anim, looping, and a duration cap', () => {
    const args = stickerArgs({ animated: true })
    expect(args[args.indexOf('-c:v') + 1]).toBe('libwebp_anim')
    expect(args[args.indexOf('-loop') + 1]).toBe('0')
    // WhatsApp drops animated stickers longer than ~10s; cap before encoding.
    expect(args).toContain('-t')
    expect(Number(args[args.indexOf('-t') + 1])).toBeLessThanOrEqual(10)
  })

  it('strips audio and reads from stdin, writes to stdout', () => {
    const args = stickerArgs({ animated: true })
    expect(args).toContain('-an')
    expect(args[args.indexOf('-i') + 1]).toBe('pipe:0')
    expect(args.at(-1)).toBe('pipe:1')
  })

  it('never interpolates caller-supplied text into the argument list', () => {
    // Guard against the SECURITY.md §3 rule: no user output as a shell argument.
    const args = stickerArgs({ animated: false })
    expect(args.every((arg) => typeof arg === 'string' && !arg.includes(';'))).toBe(true)
  })
})

describe('buildStickerExif', () => {
  it('wraps the pack metadata in the RIFF EXIF chunk WhatsApp reads', () => {
    const exif = buildStickerExif({ pack: 'Fun Pack', author: 'Bot' })
    // Little-endian TIFF header, which the WhatsApp client expects.
    expect(Array.from(exif.subarray(0, 4))).toEqual([0x49, 0x49, 0x2a, 0x00])
    const json = new TextDecoder().decode(exif)
    expect(json).toContain('"sticker-pack-name":"Fun Pack"')
    expect(json).toContain('"sticker-pack-publisher":"Bot"')
  })

  it('escapes metadata so a crafted pack name cannot break out of the JSON', () => {
    const exif = buildStickerExif({ pack: 'a"b\\c', author: 'x"y' })
    const json = new TextDecoder().decode(exif).slice(exif.indexOf(0x7b))
    const start = json.indexOf('{')
    expect(() => JSON.parse(json.slice(start)) as unknown).not.toThrow()
  })

  it('records the JSON byte length in the chunk header', () => {
    const exif = buildStickerExif({ pack: 'Fun Pack', author: 'Bot' })
    const view = new DataView(exif.buffer, exif.byteOffset, exif.byteLength)
    const declared = view.getUint32(14, true)
    const jsonStart = exif.indexOf(0x7b)
    expect(declared).toBe(exif.byteLength - jsonStart)
  })
})
