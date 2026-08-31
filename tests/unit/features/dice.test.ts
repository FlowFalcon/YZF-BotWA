import { describe, expect, it } from 'vitest'

import type { CommandContext } from '../../../src/commands/command.js'
import dice from '../../../src/features/fun/dice.js'

function makeContext(randomValue: number): { ctx: CommandContext; replies: string[] } {
  const replies: string[] = []
  const ctx: CommandContext = {
    chatJid: 'chat@s.whatsapp.net',
    senderJid: 'sender@s.whatsapp.net',
    isGroup: false,
    isOwner: false,
    prefix: '.',
    commandName: 'dice',
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

describe('dice command', () => {
  it('declares dice metadata with the dadu alias', () => {
    expect(dice.name).toBe('dice')
    expect(dice.aliases).toEqual(['dadu'])
    expect(dice.category).toBe('fun')
  })

  it('rolls 1 at the lower random boundary', async () => {
    const { ctx, replies } = makeContext(0)

    await dice.run(ctx)

    expect(replies).toEqual(['🎲 Dadu menunjukkan 1.'])
  })

  it('rolls 6 at the upper random boundary', async () => {
    const { ctx, replies } = makeContext(0.999_999)

    await dice.run(ctx)

    expect(replies).toEqual(['🎲 Dadu menunjukkan 6.'])
  })

  it('maps mid-range random values to the expected face', async () => {
    for (const [value, face] of [
      [0.166, 1],
      [0.2, 2],
      [0.5, 4],
      [0.834, 6],
    ] as const) {
      const { ctx, replies } = makeContext(value)
      await dice.run(ctx)
      expect(replies).toEqual([`🎲 Dadu menunjukkan ${face}.`])
    }
  })
})
