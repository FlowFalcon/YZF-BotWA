import { describe, expect, it } from 'vitest'

import type { CommandContext } from '../../../src/commands/command.js'
import coinflip from '../../../src/features/fun/coinflip.js'

function makeContext(randomValue: number): { ctx: CommandContext; replies: string[] } {
  const replies: string[] = []
  const ctx: CommandContext = {
    chatJid: 'chat@s.whatsapp.net',
    senderJid: 'sender@s.whatsapp.net',
    isGroup: false,
    isOwner: false,
    prefix: '.',
    commandName: 'coinflip',
    args: [],
    text: '',
    receivedAtMs: 0,
    now: () => 0,
    random: () => randomValue,
    reply: (content) => {
      replies.push(content)
      return Promise.resolve()
    },
    replyContent: async () => {},
    replyMedia: async () => {},
    react: async () => {},
  }
  return { ctx, replies }
}

describe('coinflip command', () => {
  it('declares coinflip metadata with the coin and koin aliases', () => {
    expect(coinflip.name).toBe('coinflip')
    expect(coinflip.aliases).toEqual(['coin', 'koin'])
    expect(coinflip.category).toBe('fun')
  })

  it('gives Kepala below 0.5', async () => {
    for (const value of [0, 0.25, 0.499_999]) {
      const { ctx, replies } = makeContext(value)
      await coinflip.run(ctx)
      expect(replies).toEqual(['🪙 Hasilnya: Kepala.'])
    }
  })

  it('gives Ekor at and above 0.5', async () => {
    for (const value of [0.5, 0.75, 0.999_999]) {
      const { ctx, replies } = makeContext(value)
      await coinflip.run(ctx)
      expect(replies).toEqual(['🪙 Hasilnya: Ekor.'])
    }
  })
})
