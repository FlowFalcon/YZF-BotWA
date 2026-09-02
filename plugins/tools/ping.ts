import type { Command } from '../../lib/commands/command.js'
import { brandingCard } from '../../lib/messages/branding.js'
import { externalAdReplyText } from '../../lib/messages/rich.js'

const command = {
  name: 'ping',
  aliases: ['p'],
  category: 'tools',
  description: 'Memeriksa bot aktif dan waktu proses pesan.',
  cooldownMs: 3_000,
  async run(ctx) {
    // Clamp: clock non-monotonic bisa membuat selisih negatif.
    const elapsedMs = Math.max(0, ctx.now() - ctx.receivedAtMs)
    const text = `Pong! Bot aktif. Waktu proses: ${String(elapsedMs)} ms.`
    const card = brandingCard(ctx.menuThumbnailPath, 'Bot aktif')
    if (card === undefined) {
      await ctx.reply(text)
      return
    }
    await ctx.replyContent(externalAdReplyText({ ...card, text }))
  },
} satisfies Command

export default command
