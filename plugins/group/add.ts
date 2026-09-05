import type { Command } from '../../lib/commands/command.js'
import { requireGroupAdmin } from '../../lib/group/guard.js'
import { formatParticipantReport } from '../../lib/group/report.js'
import { resolveTargets } from '../../lib/group/roles.js'

const add = {
  name: 'add',
  category: 'group',
  description: 'Menambahkan nomor ke dalam grup.',
  usage: 'add 628xxx',
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
      await context.reply(`Tulis nomor yang ingin ditambahkan. Contoh: ${context.prefix}add 628123456789`)
      return
    }

    const results = await guard.group.add(context.chatJid, targets)
    await context.reply(formatParticipantReport('Add', results))
  },
} satisfies Command

export default add
