import { describe, expect, it } from 'vitest'

import { replyCard, HIDDEN_URL_PADDING } from '../../lib/messages/reply-card.js'

const thumbnail = { bytes: new Uint8Array([1, 2, 3]), width: 720, height: 405 }

describe('replyCard', () => {
  it('builds a typed text message with a link-preview override the client renders as a large HQ card', () => {
    const content = replyCard({
      text: 'Pong!',
      url: 'https://github.com/FlowFalcon/YZF-BotWA',
      title: 'YZF-BotWA',
      description: 'Bot aktif',
      thumbnail,
    })

    expect(content.type).toBe('text')
    // The client drops the card when matchedText is absent from the body, so the
    // URL stays in the text but is pushed off-screen by zero-width padding.
    expect(content.text.startsWith('https://github.com/FlowFalcon/YZF-BotWA')).toBe(true)
    expect(content.text).toContain(HIDDEN_URL_PADDING)
    expect(content.text.endsWith('Pong!')).toBe(true)
    expect(content.linkPreview).toEqual({
      matchedText: 'https://github.com/FlowFalcon/YZF-BotWA',
      title: 'YZF-BotWA',
      description: 'Bot aktif',
      previewType: 0,
      thumbnail: { bytes: thumbnail.bytes, width: 720, height: 405 },
    })
  })

  it('omits description when not given', () => {
    const content = replyCard({ text: 'x', url: 'https://a.b/', title: 't', thumbnail })
    expect(content.linkPreview).not.toHaveProperty('description')
  })

  it('carries mentions through contextInfo', () => {
    const content = replyCard({
      text: 'hi @628',
      url: 'https://a.b/',
      title: 't',
      thumbnail,
      mentions: ['628@s.whatsapp.net'],
    })
    expect(content.contextInfo).toEqual({ mentionedJids: ['628@s.whatsapp.net'] })
  })
})
