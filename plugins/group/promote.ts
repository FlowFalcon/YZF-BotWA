import type { Command } from '../../lib/commands/command.js'
import { requireGroupAdmin } from '../../lib/group/guard.js'
import { formatParticipantReport } from '../../lib/group/report.js'
import { resolveTargets } from '../../lib/group/roles.js'

const promote = {
  name: 'promote',
  category: 'group',
  description: 'Menjadikan peserta sebagai admin grup.',
  usage: 'promote @user',
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
      await context.reply(`Tandai atau balas orang yang ingin dijadikan admin. Contoh: ${context.prefix}promote @user`)
      return
    }

    const results = await guard.group.promote(context.chatJid, targets)
    await context.reply(formatParticipantReport('Promote', results))
  },
} satisfies Command

export default promote
