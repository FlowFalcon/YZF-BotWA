import type { Command } from '../../commands/command.js'

/** Sisi read-only registry yang dibutuhkan menu; registry penuh sengaja tidak diimpor. */
export interface MenuSource {
  list(): readonly Command[]
}

// Loader hanya membaca `default`, jadi dependency disuntikkan lewat setter modul
// saat komposisi app (bukan import sibling feature, bukan global).
let source: MenuSource | undefined

export function setMenuSource(next: MenuSource | undefined): void {
  source = next
}

export function renderMenu(commands: readonly Command[], prefix: string): string {
  const sorted = [...commands].sort(
    (left, right) =>
      left.category.localeCompare(right.category) || left.name.localeCompare(right.name),
  )

  const lines: string[] = ['*Daftar Command*']
  let currentCategory: string | undefined

  for (const command of sorted) {
    if (command.category !== currentCategory) {
      currentCategory = command.category
      lines.push('', `*${command.category}*`)
    }
    lines.push(`• ${prefix}${command.name} — ${command.description}`)
  }

  return lines.join('\n')
}

const command = {
  name: 'menu',
  aliases: ['help'],
  category: 'general',
  description: 'Menampilkan daftar command yang tersedia.',
  cooldownMs: 5_000,
  async run(ctx) {
    if (source === undefined) {
      await ctx.reply('Menu belum siap.')
      return
    }
    await ctx.reply(renderMenu(source.list(), ctx.prefix))
  },
} satisfies Command

export default command
