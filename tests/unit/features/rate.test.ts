import { describe, expect, it } from 'vitest'

import type { CommandContext } from '../../../src/commands/command.js'
import rate, { normalizeRateInput, rateScore, utcDateKey } from '../../../src/features/fun/rate.js'

function makeContext(
  text: string,
  nowMs: number,
  prefix = '.',
): { ctx: CommandContext; replies: string[] } {
  const replies: string[] = []
  const ctx: CommandContext = {
    chatJid: 'chat@s.whatsapp.net',
    senderJid: 'sender@s.whatsapp.net',
    isGroup: false,
    isOwner: false,
    prefix,
    commandName: 'rate',
    args: text.trim() === '' ? [] : text.trim().split(/\s+/),
    text,
    receivedAtMs: nowMs,
    now: () => nowMs,
    random: () => {
      throw new Error('rate must not use ctx.random()')
    },
    reply: (content) => {
      replies.push(content)
      return Promise.resolve()
    },
    react: async () => {},
  }
  return { ctx, replies }
}

const DAY_A = Date.UTC(2026, 7, 30, 12, 0, 0)
const DAY_B = Date.UTC(2026, 7, 31, 12, 0, 0)

describe('rate command', () => {
  it('declares rate metadata with the nilai alias', () => {
    expect(rate.name).toBe('rate')
    expect(rate.aliases).toEqual(['nilai'])
    expect(rate.category).toBe('fun')
  })

  it('replies with usage using the active prefix when text is empty', async () => {
    const { ctx, replies } = makeContext('  ', DAY_A, '!')

    await rate.run(ctx)

    expect(replies).toEqual(['Tulis yang mau dinilai. Contoh: !rate kopi susu'])
  })

  it('derives the UTC date key from now(), not local time', () => {
    expect(utcDateKey(Date.UTC(2026, 0, 5, 23, 59, 59))).toBe('2026-01-05')
    expect(utcDateKey(Date.UTC(2026, 0, 6, 0, 0, 0))).toBe('2026-01-06')
  })

  it('normalizes case and whitespace before hashing', () => {
    expect(normalizeRateInput('  Kopi   SUSU ')).toBe('kopi susu')
    expect(rateScore('  Kopi   SUSU ', DAY_A)).toBe(rateScore('kopi susu', DAY_A))
  })

  it('produces a fixed, process-independent score for a known input and UTC date', () => {
    expect(rateScore('kopi susu', DAY_A)).toBe(22)
    expect(rateScore('hermes', DAY_A)).toBe(57)
  })

  it('gives the same reply twice for the same input on the same UTC day', async () => {
    const first = makeContext('kopi susu', DAY_A)
    const second = makeContext('KOPI   susu', DAY_A + 3_600_000)

    await rate.run(first.ctx)
    await rate.run(second.ctx)

    expect(first.replies).toEqual(['kopi susu dapat nilai 22/100 hari ini.'])
    expect(second.replies).toEqual(first.replies)
  })

  it('may give a different score on a different UTC day', () => {
    expect(rateScore('kopi susu', DAY_B)).toBe(18)
    expect(rateScore('kopi susu', DAY_B)).not.toBe(rateScore('kopi susu', DAY_A))
  })

  it('always stays within 0..100 inclusive', () => {
    for (let index = 0; index < 500; index += 1) {
      const score = rateScore(`kandidat-${index}`, DAY_A + index * 86_400_000)
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
      expect(Number.isInteger(score)).toBe(true)
    }
  })
})
