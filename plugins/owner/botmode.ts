import type { Command } from '../../lib/commands/command.js'
import { richButtons } from '../../lib/messages/rich.js'
import { BOT_MODES } from '../../lib/settings.js'
import type { BotMode, SettingsStore } from '../../lib/settings.js'

function isBotMode(value: string | undefined): value is BotMode {
  return BOT_MODES.some((mode) => mode === value)
}

function usage(prefix: string): string {
  return `Gunakan: ${prefix}botmode public | ${prefix}botmode group-only | ${prefix}botmode owner-only`
}

const botmode = {
  name: 'botmode',
  category: 'owner',
  description: 'Melihat atau mengubah mode akses bot.',
  permission: 'owner',
  cooldownMs: 1_000,
  async run(context) {
    // Runtime selalu memasok SettingsStore; context membatasi mutasi untuk command non-owner.
    const settings = context.settings as SettingsStore

    // Destructured rather than indexed: the plugin policy rejects computed
    // member access (SECURITY.md §7).
    const [requested] = context.args
    if (requested === undefined) {
      const active = settings.getMode()
      const header = await context.menuMedia?.header('Bot Mode')
      await context.replyContent(
        richButtons({
          text: [
            `*Bot Mode*`,
            `Mode aktif: \`${active}\``,
            '',
            'public — semua chat',
            'group-only — hanya grup terdaftar',
            'owner-only — hanya owner',
          ].join('\n'),
          footer: 'YZF-BotWA • Owner Control',
          ...(header === undefined ? {} : { header }),
          // The active mode is left out: a button that changes nothing is noise.
          buttons: [
            ...BOT_MODES.filter((mode) => mode !== active).map((mode) => ({
              text: mode,
              id: `${context.prefix}botmode ${mode}`,
            })),
            { text: 'Owner Menu', id: `${context.prefix}ownermenu` },
          ],
        }),
      )
      return
    }

    if (context.args.length !== 1 || !isBotMode(requested)) {
      await context.reply(usage(context.prefix))
      return
    }

    await settings.setMode(requested)
    await context.reply(`Mode bot diubah ke ${requested}.`)
  },
} satisfies Command

export default botmode
