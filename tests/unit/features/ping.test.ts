import { describe, expect, it } from 'vitest'

import type { CommandContext } from '../../../lib/commands/command.js'
import type { RichReplyContent } from '../../../lib/messages/rich.js'
import type { MenuMediaService } from '../../../lib/messages/menu-media.js'
import ping from '../../../plugins/tools/ping.js'
import { fakeContext } from '../../fixtures/context.js'

const THUMBNAIL = { bytes: new Uint8Array([0xff, 0xd8, 0xff, 0x21]), width: 240, height: 201 }

function mediaService(thumbnail: typeof THUMBNAIL | undefined): MenuMediaService {
  return {
    header: () => Promise.resolve(undefined),
    compact: () => Promise.resolve(thumbnail),
  }
}

function makeContext(
  receivedAtMs: number,
  nowMs: number,
  menuMedia?: MenuMediaService,
): {
  ctx: CommandContext
  replies: string[]
  cards: RichReplyContent[]
} {
  const replies: string[] = []
  const cards: RichReplyContent[] = []
  const ctx = fakeContext({
    receivedAtMs,
    now: () => nowMs,
    reply: (content) => {
      replies.push(content)
      return Promise.resolve()
    },
    replyContent: (content) => {
      cards.push(content)
      return Promise.resolve()
    },
    ...(menuMedia === undefined ? {} : { menuMedia }),
  })
  return { ctx, replies, cards }
}

describe('ping command', () => {
  it('declares ping metadata with the p alias', () => {
    expect(ping.name).toBe('ping')
    expect(ping.aliases).toEqual(['p'])
    expect(ping.category).toBe('tools')
  })

  it('reports alive plus processing latency from now() - receivedAtMs', async () => {
    const { ctx, replies } = makeContext(1_000, 1_042)

    await ping.run(ctx)

    expect(replies).toEqual(['Pong! Bot aktif. Waktu proses: 42 ms.'])
  })

  it('never claims WhatsApp network latency', async () => {
    const { ctx, replies } = makeContext(0, 7)

    await ping.run(ctx)

    expect(replies[0]).toBe('Pong! Bot aktif. Waktu proses: 7 ms.')
    expect(replies[0]).not.toMatch(/jaringan|network|WhatsApp/i)
  })

  it('never reports negative latency when the clock goes backwards', async () => {
    const { ctx, replies } = makeContext(500, 400)

    await ping.run(ctx)

    expect(replies).toEqual(['Pong! Bot aktif. Waktu proses: 0 ms.'])
  })

  it('sends a small inline card when a thumbnail is installed', async () => {
    const { ctx, replies, cards } = makeContext(1_000, 1_005, mediaService(THUMBNAIL))

    await ping.run(ctx)

    expect(replies).toEqual([])
    const card = cards[0]
    expect(card).toBeDefined()
    if (card !== undefined && 'extendedTextMessage' in card) {
      expect(card.extendedTextMessage.text).toContain('Pong! Bot aktif. Waktu proses: 5 ms.')
      expect(card.extendedTextMessage.jpegThumbnail).toEqual(THUMBNAIL.bytes)
      expect(card.extendedTextMessage.title).toBe('YZF-BotWA')
      // The HQ upload fields are what force the tall card.
      expect(card.extendedTextMessage).not.toHaveProperty('thumbnailDirectPath')
    }
  })

  it('falls back to plain text when no thumbnail is installed', async () => {
    const { ctx, replies, cards } = makeContext(1_000, 1_005, mediaService(undefined))

    await ping.run(ctx)

    expect(cards).toEqual([])
    expect(replies).toEqual(['Pong! Bot aktif. Waktu proses: 5 ms.'])
  })
})
