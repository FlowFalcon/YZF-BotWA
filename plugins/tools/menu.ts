import { COMMAND_CATEGORIES, type Command, type CommandCategory } from '../../lib/commands/command.js'
import { brandingCard } from '../../lib/messages/branding.js'
import { richButtons } from '../../lib/messages/rich.js'

/**
 * Switch rather than a keyed record because the plugin policy rejects computed
 * member access (SECURITY.md §7). Exhaustive over `CommandCategory`.
 */
function categoryTitle(category: CommandCategory): string {
  switch (category) {
    case 'sticker': return '🎨 STICKER'
    case 'tools': return '🛠️ TOOLS'
    case 'games': return '🎮 GAMES'
    case 'group': return '👥 GROUP'
    case 'downloader': return '📥 DOWNLOADER'
    case 'owner': return '👑 OWNER'
  }
}

function formatUptime(): string {
  // `performance.now()` counts from this process's `timeOrigin`, so it is the
  // process uptime; `process` itself is rejected by the plugin policy.
  const seconds = Math.floor(performance.now() / 1_000)
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const parts: string[] = []
  if (d > 0) parts.push(`${String(d)}d`)
  if (h > 0) parts.push(`${String(h)}h`)
  if (m > 0) parts.push(`${String(m)}m`)
  parts.push(`${String(s)}s`)
  return parts.join(' ')
}

const command = {
  name: 'menu',
  aliases: ['help'],
  category: 'tools',
  description: 'Membuka navigasi fitur YZF-BotWA.',
  cooldownMs: 3_000,
  async run(context) {
    const visible = context.commands
      .list()
      .filter((entry) => context.isOwner || (entry.permission ?? 'everyone') === 'everyone')
      .sort((left, right) => left.name.localeCompare(right.name))

    // Destructured rather than indexed: the plugin policy rejects computed
    // member access (SECURITY.md §7).
    const [jidUser] = context.senderJid.split('@')
    const userNumber = context.senderNumber ?? jidUser ?? '-'
    const userName = context.pushName ?? userNumber

    const lines = [
      '*YZF-BotWA*',
      `${userName} · +${userNumber} · ${context.isOwner ? 'Owner' : 'User'}`,
      `${context.isGroup ? 'Group' : 'Private'} · mode \`${context.settings.getMode()}\` · prefix \`${context.prefix}\``,
      `Uptime ${formatUptime()}`,
    ]

    for (const category of COMMAND_CATEGORIES) {
      if (category === 'owner' && !context.isOwner) continue
      const entries = visible.filter((entry) => entry.category === category)
      if (entries.length === 0) continue
      lines.push('', `*${categoryTitle(category)}*`)
      for (const entry of entries) {
        lines.push(`\`${context.prefix}${entry.name}\` — ${entry.description}`)
      }
    }

    // Branding card instead of the native interactive header: the header path
    // renders no image for a normal (non-business) account (DECISIONS D-019).
    const card = brandingCard(
      context.menuThumbnailPath,
      'WhatsApp bot modular · TypeScript + zapo-js',
      { large: true },
    )

    // Buttons are limited to commands a single tap can complete: `.sticker`
    // needs an attachment and the owner setters need text, so they stay as
    // listed commands only.
    await context.replyContent(
      richButtons({
        text: lines.join('\n'),
        footer: 'YZF-BotWA',
        ...(card === undefined ? {} : { externalAdReply: card }),
        buttons: [
          ...(context.isOwner ? [{ text: 'Owner Menu', id: `${context.prefix}ownermenu` }] : []),
          { text: 'Ping', id: `${context.prefix}ping` },
          { text: 'Dino Run', id: `${context.prefix}dino` },
        ],
      }),
    )
  },
} satisfies Command

export default command
