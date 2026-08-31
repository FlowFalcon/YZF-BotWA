import { describe, expect, it } from 'vitest'
import { resolveStickerSource } from '../../../src/media/source.js'

describe('resolveStickerSource', () => {
  it('picks a directly attached image', () => {
    const source = resolveStickerSource({ imageMessage: { mimetype: 'image/jpeg' } })
    expect(source?.animated).toBe(false)
  })

  it('treats video and gif attachments as animated', () => {
    expect(resolveStickerSource({ videoMessage: { mimetype: 'video/mp4' } })?.animated).toBe(true)
    expect(
      resolveStickerSource({ videoMessage: { mimetype: 'video/mp4', gifPlayback: true } })
        ?.animated,
    ).toBe(true)
  })

  it('falls back to the quoted message, so replying to a photo works', () => {
    const source = resolveStickerSource({
      extendedTextMessage: {
        text: '.sticker',
        contextInfo: { quotedMessage: { imageMessage: { mimetype: 'image/jpeg' } } },
      },
    })
    expect(source?.animated).toBe(false)
    expect(source?.message.imageMessage).toBeDefined()
  })

  it('prefers a direct attachment over a quoted one', () => {
    const source = resolveStickerSource({
      videoMessage: {
        mimetype: 'video/mp4',
        contextInfo: { quotedMessage: { imageMessage: { mimetype: 'image/jpeg' } } },
      },
    })
    expect(source?.animated).toBe(true)
  })

  it('reads a quoted message hanging off any media caption', () => {
    const source = resolveStickerSource({
      imageMessage: {
        mimetype: 'image/jpeg',
        contextInfo: { quotedMessage: { videoMessage: { mimetype: 'video/mp4' } } },
      },
    })
    // The direct image wins; the quoted video is only a fallback.
    expect(source?.animated).toBe(false)
  })

  it('returns undefined when there is no convertible media anywhere', () => {
    expect(resolveStickerSource({ conversation: '.sticker' })).toBeUndefined()
    expect(resolveStickerSource({})).toBeUndefined()
    expect(resolveStickerSource(null)).toBeUndefined()
    expect(
      resolveStickerSource({
        extendedTextMessage: { text: '.sticker', contextInfo: { quotedMessage: {} } },
      }),
    ).toBeUndefined()
  })

  it('ignores a document even when it claims an image mimetype', () => {
    // Documents are not decoded as media by the client; refuse rather than
    // hand ffmpeg something the CDN will not return as an image.
    expect(resolveStickerSource({ documentMessage: { mimetype: 'image/png' } })).toBeUndefined()
  })
})
