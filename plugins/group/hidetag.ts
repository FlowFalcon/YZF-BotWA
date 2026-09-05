import type { Command } from '../../lib/commands/command.js'
import { requireGroupAdmin } from '../../lib/group/guard.js'

const hidetag = {
  name: 'hidetag',
  aliases: ['ht'],
  category: 'group',
  description: 'Mengirim pesan yang memanggil semua peserta tanpa menampilkan tag.',
  usage: 'hidetag <pesan>',
  cooldownMs: 5_000,
  async run(context) {
    // Bot tidak perlu admin untuk mengirim pesan bertag.
    const guard = await requireGroupAdmin(context, { requireBotAdmin: false })
    if (!guard.ok) return

    const mentions = guard.metadata.participants.map((participant) => participant.jid)
    const body = context.text.trim()
    await context.reply(body === '' ? '📢' : body, { mentions })
  },
} satisfies Command

export default hidetag
