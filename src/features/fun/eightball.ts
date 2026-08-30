import type { Command } from '../../commands/command.js'

/** Jawaban netral tanpa penghinaan, ancaman, atau klaim faktual (COMMAND_SPEC §7). */
export const EIGHTBALL_RESPONSES: readonly string[] = Object.freeze([
  'Iya, sepertinya begitu.',
  'Tanda-tandanya positif.',
  'Coba tanya lagi nanti.',
  'Belum jelas, tunggu dulu.',
  'Kurang yakin, tapi boleh dicoba.',
  'Sepertinya tidak.',
  'Jangan terlalu berharap.',
  'Bisa jadi, tergantung usahamu.',
])

const command = {
  name: 'eightball',
  aliases: ['8ball'],
  category: 'fun',
  description: 'Menjawab pertanyaan ya/tidak secara acak.',
  usage: 'eightball <pertanyaan>',
  cooldownMs: 3_000,
  async run(ctx) {
    if (ctx.text.trim() === '') {
      await ctx.reply(`Tulis pertanyaannya. Contoh: ${ctx.prefix}eightball apakah hari ini cerah?`)
      return
    }

    const index = Math.min(
      EIGHTBALL_RESPONSES.length - 1,
      Math.floor(ctx.random() * EIGHTBALL_RESPONSES.length),
    )
    // noUncheckedIndexedAccess: index sudah di-clamp, fallback hanya untuk memuaskan type.
    const answer = EIGHTBALL_RESPONSES[index] ?? 'Coba tanya lagi nanti.'
    await ctx.reply(`🎱 ${answer}`)
  },
} satisfies Command

export default command
