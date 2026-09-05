import type { Command } from '../../lib/commands/command.js'
import { requireGroupAdmin } from '../../lib/group/guard.js'
import { formatParticipantReport } from '../../lib/group/report.js'
import { resolveTargets } from '../../lib/group/roles.js'

const demote = {
  name: 'demote',
  category: 'group',
  description: 'Menurunkan admin grup menjadi peserta biasa.',
  usage: 'demote @user',
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
      await context.reply(`Tandai atau balas admin yang ingin diturunkan. Contoh: ${context.prefix}demote @user`)
      return
    }

    const results = await guard.group.demote(context.chatJid, targets)
    await context.reply(formatParticipantReport('Demote', results))
  },
} satisfies Command

export default demote
