import type { Command } from '../../lib/commands/command.js'
import { requireGroupAdmin } from '../../lib/group/guard.js'

const linkgroup = {
  name: 'linkgroup',
  aliases: ['linkgc'],
  category: 'group',
  description: 'Menampilkan link undangan grup, atau menggantinya dengan argumen reset.',
  usage: 'linkgroup [reset]',
  cooldownMs: 5_000,
  async run(context) {
    const guard = await requireGroupAdmin(context)
    if (!guard.ok) return

    const [action] = context.args
    // Rotasi link memutus semua undangan lama, jadi hanya jalan bila diminta eksplisit.
    if (action === 'reset') {
      const rotated = await guard.group.revokeInvite(context.chatJid)
      await context.reply(
        `Link grup diganti. Link lama tidak berlaku lagi.\nhttps://chat.whatsapp.com/${rotated}`,
      )
      return
    }

    const code = await guard.group.inviteCode(context.chatJid)
    await context.reply(`*${guard.metadata.subject}*\nhttps://chat.whatsapp.com/${code}`)
  },
} satisfies Command

export default linkgroup
