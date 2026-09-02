import { describe, expect, it, vi } from 'vitest'
import { Readable } from 'node:stream'
import { createStickerCommand } from '../../plugins/sticker/sticker.js'
import { encodeSticker } from '../../lib/media/ffmpeg.js'
import type { CommandContext } from '../../lib/commands/command.js'
import type { MediaReply } from '../../lib/media/types.js'
import { sampleMp4, samplePng } from '../support/media-fixtures.js'

const png = await samplePng()
const mp4 = await sampleMp4()

/**
 * Full path with the real ffmpeg: downloaded bytes become a sticker payload a
 * WhatsApp client would accept. Only the CDN download is substituted.
 */
describe('sticker end to end (real ffmpeg)', () => {
  const run = async (bytes: Uint8Array, message: Record<string, unknown>): Promise<MediaReply> => {
    const sent: MediaReply[] = []

    const sticker = createStickerCommand({
      download: () => Promise.resolve(Readable.from([Buffer.from(bytes)])),
      encode: encodeSticker,
      packAuthor: 'zapo-fun-bot',
    })

    await sticker.run({
      prefix: '.',
      pushName: 'Fathur',
      message,
      reply: (text: string) => {
        throw new Error(`unexpected reply: ${text}`)
      },
      react: () => Promise.resolve(),
      replyMedia: (content: MediaReply) => {
        sent.push(content)
        return Promise.resolve()
      },
    } as unknown as CommandContext)

    const result = sent[0]
    if (result === undefined) throw new Error('no sticker was sent')
    return result
  }

  it('turns a photo into a valid WebP sticker carrying the pack name', async () => {
    const sent = await run(png, { imageMessage: { mimetype: 'image/png' } })

    expect(sent.mimetype).toBe('image/webp')
    const text = new TextDecoder('latin1').decode(sent.media)
    expect(text.startsWith('RIFF')).toBe(true)
    expect(text.slice(8, 12)).toBe('WEBP')
    expect(text).toContain('EXIF')
    expect(text).toContain('"sticker-pack-name":"Fathur"')
  }, 30000)

  it('turns a video into an animated WebP sticker', async () => {
    const sent = await run(mp4, { videoMessage: { mimetype: 'video/mp4' } })

    const text = new TextDecoder('latin1').decode(sent.media)
    expect(text.slice(8, 12)).toBe('WEBP')
    // ANIM/ANMF chunks exist only in animated WebP.
    expect(text).toContain('ANIM')
    expect(text).toContain('"sticker-pack-name":"Fathur"')
  }, 60000)

  it('works when the media is quoted rather than attached', async () => {
    const sent = await run(png, {
      extendedTextMessage: {
        text: '.sticker',
        contextInfo: { quotedMessage: { imageMessage: { mimetype: 'image/png' } } },
      },
    })
    expect(new TextDecoder('latin1').decode(sent.media).slice(8, 12)).toBe('WEBP')
  }, 30000)

  it('reports a failure instead of sending garbage when ffmpeg cannot decode', async () => {
    const reply = vi.fn((text: string) => {
      void text
      return Promise.resolve()
    })
    const replyMedia = vi.fn((content: MediaReply) => {
      void content
      return Promise.resolve()
    })

    const sticker = createStickerCommand({
      download: () => Promise.resolve(Readable.from([Buffer.from('definitely not media')])),
      encode: encodeSticker,
      packAuthor: 'zapo-fun-bot',
    })

    await sticker.run({
      prefix: '.',
      pushName: 'Fathur',
      message: { imageMessage: { mimetype: 'image/png' } },
      reply,
      react: () => Promise.resolve(),
      replyMedia,
    } as unknown as CommandContext)

    expect(replyMedia).not.toHaveBeenCalled()
    expect(reply.mock.calls[0]?.[0]).toBe('Gagal membuat sticker dari media ini.')
  }, 30000)
})
