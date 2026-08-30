import type { Command } from '../../commands/command.js'

const command = {
  name: 'ping',
  aliases: ['p'],
  category: 'general',
  description: 'Memeriksa bot aktif dan waktu proses pesan.',
  cooldownMs: 3_000,
  async run(ctx) {
    // Clamp: clock non-monotonic bisa membuat selisih negatif.
    const elapsedMs = Math.max(0, ctx.now() - ctx.receivedAtMs)
    await ctx.reply(`Pong! Bot aktif. Waktu proses: ${elapsedMs} ms.`)
  },
} satisfies Command

export default command
