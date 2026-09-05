import { COMMAND_CATEGORIES, type Command, type CommandCategory } from '../commands/command.js'

/**
 * Teks menu berkategori. Tanpa button: satu blok teks yang bisa dibaca dan
 * disalin di klien mana pun, dikirim lewat kartu HQ (`ctx.Reply`).
 *
 * Switch, bukan record berkunci: plugin policy menolak computed member access
 * (SECURITY.md §7), dan switch di sini exhaustive atas `CommandCategory`.
 */
export function categoryTitle(category: CommandCategory): string {
  switch (category) {
    case 'sticker': return '🎨 STICKER'
    case 'tools': return '🛠️ TOOLS'
    case 'games': return '🎮 GAMES'
    case 'group': return '👥 GROUP'
    case 'downloader': return '📥 DOWNLOADER'
    case 'owner': return '👑 OWNER'
  }
}

/**
 * `performance.now()` dihitung dari `timeOrigin` proses ini, jadi nilainya
 * adalah uptime proses; `process` sendiri ditolak plugin policy.
 */
export function formatUptime(): string {
  const seconds = Math.floor(performance.now() / 1_000)
  const days = Math.floor(seconds / 86_400)
  const hours = Math.floor((seconds % 86_400) / 3_600)
  const minutes = Math.floor((seconds % 3_600) / 60)
  const parts: string[] = []
  if (days > 0) parts.push(`${String(days)}d`)
  if (hours > 0) parts.push(`${String(hours)}h`)
  if (minutes > 0) parts.push(`${String(minutes)}m`)
  parts.push(`${String(seconds % 60)}s`)
  return parts.join(' ')
}

export interface CommandLine {
  readonly name: string
  readonly usage?: string
  readonly description: string
}

/** Satu baris per command: pemakaian di depan, penjelasan di belakang. */
export function commandLine(prefix: string, entry: CommandLine): string {
  return `\`${prefix}${entry.usage ?? entry.name}\` — ${entry.description}`
}

export interface MenuSection {
  readonly title: string
  readonly entries: readonly CommandLine[]
}

/** Daftar berkategori dari registry, urut sesuai `COMMAND_CATEGORIES`. */
export function menuSections(
  commands: readonly Command[],
  options: { readonly includeOwner: boolean },
): readonly MenuSection[] {
  const sections: MenuSection[] = []
  for (const category of COMMAND_CATEGORIES) {
    if (category === 'owner' && !options.includeOwner) continue
    const entries = commands
      .filter((command) => command.category === category)
      .filter((command) => options.includeOwner || (command.permission ?? 'everyone') === 'everyone')
      .sort((left, right) => left.name.localeCompare(right.name))
    if (entries.length === 0) continue
    sections.push({ title: categoryTitle(category), entries })
  }
  return sections
}

export function renderSections(prefix: string, sections: readonly MenuSection[]): readonly string[] {
  const lines: string[] = []
  for (const section of sections) {
    lines.push('', `*${section.title}*`)
    for (const entry of section.entries) lines.push(commandLine(prefix, entry))
  }
  return lines
}
