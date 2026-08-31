import { describe, expect, it } from 'vitest'

import type { CommandContext } from '../../../src/commands/command.js'
import eightball, { EIGHTBALL_RESPONSES } from '../../../src/features/fun/eightball.js'

function makeContext(
  text: string,
  randomValue: number,
  prefix = '.',
): { ctx: CommandContext; replies: string[] } {
  const replies: string[] = []
  const ctx: CommandContext = {
    chatJid: 'chat@s.whatsapp.net',
    senderJid: 'sender@s.whatsapp.net',
    isGroup: false,
    isOwner: false,
    prefix,
    commandName: 'eightball',
    args: text === '' ? [] : text.split(/\s+/),
    text,
    receivedAtMs: 0,
    now: () => 0,
    random: () => randomValue,
    reply: (content) => {
      replies.push(content)
      return Promise.resolve()
    },
    replyContent: async () => {},
    react: async () => {},
  }
  return { ctx, replies }
}

describe('eightball command', () => {
  it('declares eightball metadata with the 8ball alias', () => {
    expect(eightball.name).toBe('eightball')
    expect(eightball.aliases).toEqual(['8ball'])
    expect(eightball.category).toBe('fun')
  })

  it('replies with usage using the active prefix when text is empty', async () => {
    const { ctx, replies } = makeContext('   ', 0, '!')

    await eightball.run(ctx)

    expect(replies).toEqual(['Tulis pertanyaannya. Contoh: !eightball apakah hari ini cerah?'])
  })

  it('picks the first response at the lower random boundary', async () => {
    const { ctx, replies } = makeContext('apakah besok hujan?', 0)

    await eightball.run(ctx)

    expect(replies).toEqual([`🎱 ${EIGHTBALL_RESPONSES[0] ?? ''}`])
  })

  it('picks the last response at the upper random boundary', async () => {
    const { ctx, replies } = makeContext('apakah besok hujan?', 0.999_999)

    await eightball.run(ctx)

    const last = EIGHTBALL_RESPONSES[EIGHTBALL_RESPONSES.length - 1] ?? ''
    expect(replies).toEqual([`🎱 ${last}`])
  })

  it('is deterministic for a fixed random value', async () => {
    const first = makeContext('halo', 0.42)
    const second = makeContext('halo', 0.42)

    await eightball.run(first.ctx)
    await eightball.run(second.ctx)

    expect(first.replies).toEqual(second.replies)
  })

  it('keeps the response list nonempty and free of insults or threats', () => {
    expect(EIGHTBALL_RESPONSES.length).toBeGreaterThan(0)
    for (const response of EIGHTBALL_RESPONSES) {
      expect(response.trim()).not.toBe('')
      expect(response).not.toMatch(/bodoh|bego|tolol|mati|bunuh|goblok|anjing/i)
    }
  })
})
