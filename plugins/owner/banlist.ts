import type { Command } from '../../lib/commands/command.js'

const banlist = {
  name: 'banlist',
  category: 'owner',
  description: 'Menampilkan daftar user dan chat yang diblokir.',
  permission: 'owner',
  cooldownMs: 2_000,
  async run(context) {
    const { users } = context
    if (users === undefined) {
      await context.reply('Penyimpanan user belum siap.')
      return
    }

    const bannedUsers = users.listBannedUsers()
    const bannedChats = users.listBannedChats()
    if (bannedUsers.length === 0 && bannedChats.length === 0) {
      await context.Reply('*Ban List*\n\nDaftar blokir kosong.')
      return
    }

    const lines = ['*Ban List*']
    if (bannedUsers.length > 0) {
      lines.push('', `*User* (${String(bannedUsers.length)})`)
      for (const jid of bannedUsers) {
        const [number] = jid.split('@')
        lines.push(`• ${number ?? jid}`)
      }
    }
    if (bannedChats.length > 0) {
      lines.push('', `*Chat* (${String(bannedChats.length)})`)
      for (const jid of bannedChats) lines.push(`• ${jid}`)
    }
    await context.Reply(lines.join('\n'), { description: 'Daftar blokir' })
  },
} satisfies Command

export default banlist
