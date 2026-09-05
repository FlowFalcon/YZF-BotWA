import type { Command } from '../../lib/commands/command.js'

const unbanchat = {
  name: 'unbanchat',
  category: 'owner',
  description: 'Mencabut blokir chat atau grup ini.',
  permission: 'owner',
  cooldownMs: 1_000,
  async run(context) {
    const { users } = context
    if (users === undefined) {
      await context.reply('Penyimpanan user belum siap.')
      return
    }

    await users.unbanChat(context.chatJid)
    await context.reply('Blokir chat ini dicabut.')
  },
} satisfies Command

export default unbanchat
