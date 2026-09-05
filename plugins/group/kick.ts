import type { Command } from '../../lib/commands/command.js'
import { requireGroupAdmin } from '../../lib/group/guard.js'
import { formatParticipantReport } from '../../lib/group/report.js'
import { resolveTargets } from '../../lib/group/roles.js'

const kick = {
  name: 'kick',
  category: 'group',
  description: 'Mengeluarkan peserta dari grup.',
  usage: 'kick @user',
  cooldownMs: 2_000,
  async run(context) {
    const guard = await requireGroupAdmin(context)
    if (!guard.ok) return

    const targets = resolveTargets({
      mentionedJids: context.mentionedJids,
      ...(context.quoted?.participant === undefined
        ? {}
        : { quotedParticipant: context.quoted.participant }),
      args: context.args,
    })
    if (targets.length === 0) {
      await context.reply(`Tandai atau balas orang yang ingin dikeluarkan. Contoh: ${context.prefix}kick @user`)
      return
    }
    if (targets.some((jid) => context.botJids.includes(jid))) {
      await context.reply('Bot tidak mengeluarkan bot sendiri.')
      return
    }

    const results = await guard.group.remove(context.chatJid, targets)
    await context.reply(formatParticipantReport('Kick', results))
  },
} satisfies Command

export default kick
