import type { Command } from '../../lib/commands/command.js'
import { requireGroupAdmin } from '../../lib/group/guard.js'

/** Batas subject grup di WhatsApp. */
const MAX_SUBJECT = 100

const gcname = {
  name: 'gcname',
  aliases: ['setname-gc'],
  category: 'group',
  description: 'Mengubah nama grup.',
  usage: 'gcname <nama baru>',
  cooldownMs: 5_000,
  async run(context) {
    const subject = context.text.trim()
    if (subject === '') {
      await context.reply(`Tulis nama barunya. Contoh: ${context.prefix}gcname Grup Baru`)
      return
    }
    if (subject.length > MAX_SUBJECT) {
      await context.reply(`Nama grup maksimum ${String(MAX_SUBJECT)} karakter.`)
      return
    }

    const guard = await requireGroupAdmin(context)
    if (!guard.ok) return

    await guard.group.setSubject(context.chatJid, subject)
    await context.reply(`Nama grup diubah menjadi: ${subject}`)
  },
} satisfies Command

export default gcname
