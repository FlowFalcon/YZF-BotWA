import type { Command } from '../../commands/command.js'

export function normalizeRateInput(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function utcDateKey(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10)
}

/**
 * FNV-1a 32-bit: pure, tanpa state, tanpa seed runtime, sehingga nilai sama
 * di proses mana pun. `>>> 0` menjaga hasil unsigned setelah aritmetika 32-bit.
 */
function fnv1a32(input: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash
}

export function rateScore(text: string, nowMs: number): number {
  return fnv1a32(`${normalizeRateInput(text)}|${utcDateKey(nowMs)}`) % 101
}

const command = {
  name: 'rate',
  aliases: ['nilai'],
  category: 'fun',
  description: 'Memberi nilai 0-100 untuk sesuatu, tetap sama sepanjang hari.',
  usage: 'rate <sesuatu>',
  cooldownMs: 3_000,
  async run(ctx) {
    const subject = normalizeRateInput(ctx.text)
    if (subject === '') {
      await ctx.reply(`Tulis yang mau dinilai. Contoh: ${ctx.prefix}rate kopi susu`)
      return
    }

    const score = rateScore(ctx.text, ctx.now())
    await ctx.reply(`${subject} dapat nilai ${score}/100 hari ini.`)
  },
} satisfies Command

export default command
