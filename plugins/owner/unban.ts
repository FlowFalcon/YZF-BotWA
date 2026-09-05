import type { Command } from '../../lib/commands/command.js'
import { resolveTargets } from '../../lib/group/roles.js'

const unban = {
  name: 'unban',
  aliases: ['unbanuser'],
  category: 'owner',
  description: 'Mencabut blokir user.',
  usage: 'unban @user',
  permission: 'owner',
  cooldownMs: 1_000,
  async run(context) {
    const { users } = context
    if (users === undefined) {
      await context.reply('Penyimpanan user belum siap.')
      return
    }

    const targets = resolveTargets({
      mentionedJids: context.mentionedJids,
      ...(context.quoted?.participant === undefined
        ? {}
        : { quotedParticipant: context.quoted.participant }),
      args: context.args,
    })
    const [target] = targets
    if (target === undefined) {
      await context.reply(`Tandai, balas, atau tulis nomornya. Contoh: ${context.prefix}unban @user`)
      return
    }

    const [number] = target.split('@')
    if (!users.isBannedUser(target)) {
      await context.reply(`${number ?? target} tidak ada di daftar blokir.`)
      return
    }

    await users.unbanUser(target)
    await context.reply(`Blokir ${number ?? target} dicabut.`)
  },
} satisfies Command

export default unban
