import type { Command, CommandContext } from '../../commands/command.js'
import type { CommandRegistry } from '../../commands/registry.js'
import { richList } from '../../messages/rich.js'
import type { RichInteractiveContent } from '../../messages/rich.js'

/**
 * Tappable version of `.menu`. Rows carry the prefixed command text, so a tap
 * re-enters the router exactly like a typed message and every access gate,
 * permission check, flood and cooldown rule still applies.
 */
let source: CommandRegistry | undefined

export function setPanelSource(registry: CommandRegistry | undefined): void {
  source = registry
}

const CATEGORY_TITLES: Record<string, string> = { general: 'Umum', fun: 'Hiburan' }

export function buildPanel(
  commands: readonly Command[],
  prefix: string,
): RichInteractiveContent {
  const byCategory = new Map<string, Command[]>()
  for (const command of commands) {
    // The panel is for everyone; owner-only entries would only advertise
    // commands the tapper cannot run.
    if ((command.permission ?? 'everyone') === 'owner') continue
    const bucket = byCategory.get(command.category)
    if (bucket === undefined) byCategory.set(command.category, [command])
    else bucket.push(command)
  }

  const sections = [...byCategory].map(([category, entries]) => ({
    title: CATEGORY_TITLES[category] ?? category,
    rows: entries.map((command) => ({
      title: `${prefix}${command.name}`,
      description: command.description,
      id: `${prefix}${command.name}`,
    })),
  }))

  return richList({
    text: 'Pilih command dari daftar.',
    footer: 'fun-bot',
    title: 'Daftar command',
    buttonText: 'Buka daftar',
    sections,
  })
}

const panel: Command = {
  name: 'panel',
  aliases: ['menutombol'],
  category: 'general',
  description: 'Menu command berbentuk daftar yang bisa ditekan',
  cooldownMs: 3000,
  run: async (context: CommandContext): Promise<void> => {
    if (source === undefined) {
      await context.reply('Panel belum siap.')
      return
    }
    await context.replyContent(buildPanel(source.list(), context.prefix))
  },
}

export default panel
