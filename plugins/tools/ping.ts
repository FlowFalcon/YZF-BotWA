import type { Command } from '../../lib/commands/command.js'
import { compactCardText } from '../../lib/messages/rich.js'

const REPO_URL = 'https://github.com/FlowFalcon/YZF-BotWA'

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

    // Kartu kecil: inline thumbnail tanpa HQ upload. Tanpa thumbnail, teks biasa.
    const thumbnail = await ctx.menuMedia?.compact()
    if (thumbnail === undefined) {
      await ctx.reply(text)
      return
    }
    await ctx.replyContent(
      compactCardText({
        text,
        url: REPO_URL,
        title: 'YZF-BotWA',
        description: 'Bot aktif',
        thumbnail,
      }),
    )
  },
} satisfies Command

export default command
