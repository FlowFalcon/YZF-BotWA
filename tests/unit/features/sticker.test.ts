import { describe, expect, it, vi } from 'vitest'
import { Readable } from 'node:stream'
import { createStickerCommand } from '../../../plugins/sticker/sticker.js'
import type { CommandContext } from '../../../lib/commands/command.js'
import type { EncodeStickerOptions } from '../../../lib/media/ffmpeg.js'
import type { MediaReply } from '../../../lib/media/types.js'

const replyFn = () =>
  vi.fn((text: string) => {
    void text
    return Promise.resolve()
  })

const mediaFn = () =>
  vi.fn((content: MediaReply) => {
    void content
    return Promise.resolve()
  })

const encodeFn = (result: Uint8Array = new Uint8Array([9, 9])) =>
  vi.fn((input: Uint8Array, options: EncodeStickerOptions) => {
    void input
    void options
    return Promise.resolve(result)
  })

const stream = (): Readable => Readable.from([Buffer.from([1, 2, 3])])

const context = (parts: Record<string, unknown>): CommandContext =>
  ({
    prefix: '.',
    pushName: 'Fathur',
    reply: replyFn(),
    settings: { getMode: () => 'owner-only' },
    commands: { list: () => [] },
    react: vi.fn(() => Promise.resolve()),
    replyMedia: mediaFn(),
    ...parts,
  }) as unknown as CommandContext

describe('sticker command', () => {
  it('downloads the media, encodes it, and sends a sticker', async () => {
    const download = vi.fn(() => Promise.resolve(stream()))
    const encode = encodeFn()
    const sticker = createStickerCommand({ download, encode, packAuthor: 'Bot' })

    const replyMedia = mediaFn()
    const react = vi.fn(() => Promise.resolve())
    await sticker.run(
      context({ message: { imageMessage: { mimetype: 'image/jpeg' } }, replyMedia, react }),
    )

    expect(download).toHaveBeenCalledOnce()
    expect(encode.mock.calls[0]?.[1]).toMatchObject({ animated: false })
    expect(replyMedia).toHaveBeenCalledWith({
      type: 'sticker',
      media: new Uint8Array([9, 9]),
      mimetype: 'image/webp',
    })
    // Reacts to show progress, because encoding a video takes seconds.
    expect(react).toHaveBeenCalled()
  })

  it('marks a video source as animated', async () => {
    const encode = encodeFn(new Uint8Array([1]))
    const sticker = createStickerCommand({
      download: () => Promise.resolve(stream()),
      encode,
      packAuthor: 'Bot',
    })

    await sticker.run(context({ message: { videoMessage: { mimetype: 'video/mp4' } } }))
    expect(encode.mock.calls[0]?.[1]).toMatchObject({ animated: true })
  })

  it('uses the sender push name as the pack name', async () => {
    const encode = encodeFn(new Uint8Array([1]))
    const sticker = createStickerCommand({
      download: () => Promise.resolve(stream()),
      encode,
      packAuthor: 'Bot',
    })

    await sticker.run(context({ message: { imageMessage: {} }, pushName: 'Fathur' }))
    expect(encode.mock.calls[0]?.[1]).toMatchObject({ metadata: { pack: 'Fathur', author: 'Bot' } })
  })

  it('falls back to a generic pack name when the sender has no push name', async () => {
    const encode = encodeFn(new Uint8Array([1]))
    const sticker = createStickerCommand({
      download: () => Promise.resolve(stream()),
      encode,
      packAuthor: 'Bot',
    })

    await sticker.run(context({ message: { imageMessage: {} }, pushName: undefined }))
    expect(encode.mock.calls[0]?.[1]).toMatchObject({ metadata: { pack: 'Sticker' } })
  })

  it('explains what to do when no media is attached, without downloading', async () => {
    const download = vi.fn(() => Promise.resolve(stream()))
    const sticker = createStickerCommand({
      download,
      encode: encodeFn(),
      packAuthor: 'Bot',
    })

    const reply = replyFn()
    await sticker.run(context({ message: { conversation: '.sticker' }, reply }))

    expect(download).not.toHaveBeenCalled()
    expect(reply.mock.calls[0]?.[0]).toContain('.sticker')
  })

  it('reports a friendly error when encoding fails, and does not send media', async () => {
    const replyMedia = mediaFn()
    const reply = replyFn()
    const sticker = createStickerCommand({
      download: () => Promise.resolve(stream()),
      encode: () => Promise.reject(new Error('ffmpeg exited with code 1: bad input')),
      packAuthor: 'Bot',
    })

    await sticker.run(context({ message: { imageMessage: {} }, reply, replyMedia }))

    expect(replyMedia).not.toHaveBeenCalled()
    expect(reply).toHaveBeenCalled()
    // The raw ffmpeg stderr must not be echoed to the chat.
    expect(reply.mock.calls[0]?.[0]).not.toContain('ffmpeg')
  })

  it('rejects media above the byte ceiling while streaming, before encoding', async () => {
    const encode = encodeFn(new Uint8Array([1]))
    const sticker = createStickerCommand({
      download: () => Promise.resolve(Readable.from([Buffer.alloc(9 * 1024 * 1024)])),
      encode,
      packAuthor: 'Bot',
      maxBytes: 1024,
    })

    const reply = replyFn()
    await sticker.run(context({ message: { imageMessage: {} }, reply }))

    expect(encode).not.toHaveBeenCalled()
    expect(reply.mock.calls[0]?.[0]).toMatch(/besar/i)
  })
})
