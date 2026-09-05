import type { Command } from '../../lib/commands/command.js'
import { requireGroupAdmin } from '../../lib/group/guard.js'

const group = {
  name: 'group',
  category: 'group',
  description: 'Membuka atau menutup grup untuk peserta biasa.',
  usage: 'group open | group close',
  cooldownMs: 2_000,
  async run(context) {
    // Argumen dibaca lebih dulu: menutup grup karena salah tulis lebih mahal
    // daripada satu query metadata tambahan.
    const [mode] = context.args
    if (mode !== 'open' && mode !== 'close') {
      await context.reply(`Gunakan: ${context.prefix}group open | ${context.prefix}group close`)
      return
    }

    const guard = await requireGroupAdmin(context)
    if (!guard.ok) return

    await guard.group.setAnnounce(context.chatJid, mode === 'close')
    await context.reply(
      mode === 'close'
        ? 'Grup ditutup: hanya admin yang bisa mengirim pesan.'
        : 'Grup dibuka: semua peserta bisa mengirim pesan.',
    )
  },
} satisfies Command

export default group
