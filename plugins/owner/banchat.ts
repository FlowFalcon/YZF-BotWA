import type { Command } from '../../lib/commands/command.js'

const banchat = {
  name: 'banchat',
  category: 'owner',
  description: 'Memblokir chat atau grup ini dari semua perintah bot.',
  permission: 'owner',
  cooldownMs: 1_000,
  async run(context) {
    const { users } = context
    if (users === undefined) {
      await context.reply('Penyimpanan user belum siap.')
      return
    }

    await users.banChat(context.chatJid)
    await context.reply('Chat ini diblokir. Bot tidak lagi merespons di sini.')
  },
} satisfies Command

export default banchat
