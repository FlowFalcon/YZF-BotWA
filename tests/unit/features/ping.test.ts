import { describe, expect, it } from 'vitest'

import type { CommandContext } from '../../../src/commands/command.js'
import ping from '../../../src/features/general/ping.js'

function makeContext(receivedAtMs: number, nowMs: number): {
  ctx: CommandContext
  replies: string[]
} {
  const replies: string[] = []
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
    react: async () => {},
  }
  return { ctx, replies }
}

describe('ping command', () => {
  it('declares ping metadata with the p alias', () => {
    expect(ping.name).toBe('ping')
    expect(ping.aliases).toEqual(['p'])
    expect(ping.category).toBe('general')
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
})
