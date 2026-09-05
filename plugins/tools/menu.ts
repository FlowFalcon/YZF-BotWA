import type { Command } from '../../lib/commands/command.js'
import { formatUptime, menuSections, renderSections } from '../../lib/messages/menu-text.js'

const menu = {
  name: 'menu',
  aliases: ['help'],
  category: 'tools',
  description: 'Menampilkan seluruh daftar fitur.',
  cooldownMs: 3_000,
  async run(context) {
    // Destructured, bukan indexed: plugin policy menolak computed member access.
    const [jidUser] = context.senderJid.split('@')
    const userNumber = context.senderNumber ?? jidUser ?? '-'

    const sections = menuSections(context.commands.list(), { includeOwner: context.isOwner })
    const total = sections.reduce((sum, section) => sum + section.entries.length, 0)

    const lines = [
      '*YZF-BotWA*',
      `${context.pushName ?? userNumber} · +${userNumber} · ${context.isOwner ? 'Owner' : 'User'}`,
      `${context.isGroup ? 'Group' : 'Private'} · mode \`${context.settings.getMode()}\` · prefix \`${context.prefix}\``,
      `Uptime ${formatUptime()} · ${String(total)} fitur`,
      ...renderSections(context.prefix, sections),
      '',
      `Menu grup lengkap: \`${context.prefix}groupmenu\``,
      ...(context.isOwner ? [`Menu owner: \`${context.prefix}ownermenu\``] : []),
    ]

    await context.Reply(lines.join('\n'), { description: `${String(total)} fitur aktif` })
  },
} satisfies Command

export default menu
