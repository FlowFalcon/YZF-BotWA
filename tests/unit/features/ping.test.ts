import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import type { CommandContext } from '../../../lib/commands/command.js'
import type { RichReplyContent } from '../../../lib/messages/rich.js'
import ping from '../../../plugins/tools/ping.js'

function makeContext(
  receivedAtMs: number,
  nowMs: number,
  menuThumbnailPath = path.join(tmpdir(), 'yzf-absent-thumbnail.jpg'),
): {
  ctx: CommandContext
  replies: string[]
  cards: RichReplyContent[]
} {
  const replies: string[] = []
  const cards: RichReplyContent[] = []
  const ctx: CommandContext = {
    chatJid: 'chat@s.whatsapp.net',
    senderJid: 'sender@s.whatsapp.net',
    isGroup: false,
    isOwner: false,
    prefix: '.',
    commandName: 'ping',
    args: [],
    text: '',
    receivedAtMs,
    now: () => nowMs,
    random: () => 0,
    reply: (content) => {
      replies.push(content)
      return Promise.resolve()
    },
    replyContent: (content) => {
      cards.push(content)
      return Promise.resolve()
    },
    replyMedia: async () => {},
    replyAIRich: async () => {},
    settings: { getMode: () => 'owner-only' },
    commands: { list: () => [] },
    menuThumbnailPath,
    react: async () => {},
  }
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

  it('attaches the branding card when a thumbnail is installed', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'yzf-ping-'))
    const thumbnailPath = path.join(directory, 'menu-thumbnail.jpg')
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0x21])
    await writeFile(thumbnailPath, bytes)

    try {
      const { ctx, replies, cards } = makeContext(1_000, 1_005, thumbnailPath)

      await ping.run(ctx)

      expect(replies).toEqual([])
      expect(cards).toEqual([
        {
          type: 'text',
          text: 'Pong! Bot aktif. Waktu proses: 5 ms.',
          contextInfo: {
            raw: {
              externalAdReply: {
                title: 'YZF-BotWA',
                body: 'Bot aktif',
                thumbnail: bytes,
                mediaType: 1,
                renderLargerThumbnail: false,
                showAdAttribution: false,
              },
            },
          },
        },
      ])
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
