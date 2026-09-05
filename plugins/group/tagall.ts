import type { Command } from '../../lib/commands/command.js'
import { requireGroupAdmin } from '../../lib/group/guard.js'

const tagall = {
  name: 'tagall',
  category: 'group',
  description: 'Memanggil semua peserta grup dengan daftar tag terlihat.',
  usage: 'tagall [pesan]',
  cooldownMs: 10_000,
  async run(context) {
    const guard = await requireGroupAdmin(context, { requireBotAdmin: false })
    if (!guard.ok) return

    const mentions = guard.metadata.participants.map((participant) => participant.jid)
    const body = context.text.trim()
    const lines = [
      `*${guard.metadata.subject}* — ${String(mentions.length)} peserta`,
      ...(body === '' ? [] : ['', body]),
      '',
      ...mentions.map((jid) => {
        const [number] = jid.split('@')
        return `• @${number ?? jid}`
      }),
    ]
    await context.reply(lines.join('\n'), { mentions })
  },
} satisfies Command

export default tagall
