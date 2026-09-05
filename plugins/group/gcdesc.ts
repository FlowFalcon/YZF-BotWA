import type { Command } from '../../lib/commands/command.js'
import { requireGroupAdmin } from '../../lib/group/guard.js'

const gcdesc = {
  name: 'gcdesc',
  category: 'group',
  description: 'Mengubah deskripsi grup.',
  usage: 'gcdesc <deskripsi baru>',
  cooldownMs: 5_000,
  async run(context) {
    const description = context.text.trim()
    if (description === '') {
      await context.reply(`Tulis deskripsi barunya. Contoh: ${context.prefix}gcdesc Grup diskusi`)
      return
    }

    const guard = await requireGroupAdmin(context)
    if (!guard.ok) return

    await guard.group.setDescription(context.chatJid, description)
    await context.reply('Deskripsi grup diperbarui.')
  },
} satisfies Command

export default gcdesc
