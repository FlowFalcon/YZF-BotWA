import type { Command } from '../../lib/commands/command.js'
import { resolveTargets } from '../../lib/group/roles.js'

const ban = {
  name: 'ban',
  aliases: ['banuser'],
  category: 'owner',
  description: 'Memblokir user dari semua perintah bot.',
  usage: 'ban @user',
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
      await context.reply(`Tandai, balas, atau tulis nomornya. Contoh: ${context.prefix}ban @user`)
      return
    }
    // Owner memblokir dirinya sendiri berarti kehilangan akses ke bot.
    if (target === context.senderJid) {
      await context.reply('Bot tidak memblokir owner.')
      return
    }

    await users.banUser(target)
    const [number] = target.split('@')
    await context.reply(`${number ?? target} diblokir dari semua perintah.`)
  },
} satisfies Command

export default ban
