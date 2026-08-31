import { randomUUID } from 'node:crypto'
import type { Command, CommandContext } from '../../commands/command.js'
import { htmlPrimitiveMessage } from '../../messages/ai-rich.js'
import { DINO_HTML } from '../../games/dino-html.js'

export interface DinoOptions {
  /** `BOT_HTML_GAMES=1`. Default off: client rendering is unverified. */
  readonly enabled: boolean
}

const DISABLED_REPLY =
  'Fitur game HTML masih mati. Nyalakan dengan BOT_HTML_GAMES=1 di .env lalu restart bot.'

const GROUP_REPLY = 'Game HTML hanya di private chat, belum diuji di grup.'

/**
 * Owner-only, private-chat-only, flag-gated.
 *
 * The `botForwardedMessage` route is documented in CREATIVE_MESSAGES.md as
 * higher risk than native flow: `needsSecretPersistence` becomes true on every
 * send and no client actually renders it yet as far as this project has proven.
 * The gates exist so an unproven payload cannot reach a community group.
 */
export function createDinoCommand(options: DinoOptions): Command {
  return {
    name: 'dino',
    aliases: ['dinorun'],
    category: 'fun',
    description: 'Game dino runner (eksperimen, owner only)',
    permission: 'owner',
    cooldownMs: 10_000,
    run: async (context: CommandContext): Promise<void> => {
      if (!options.enabled) {
        await context.reply(DISABLED_REPLY)
        return
      }
      if (context.isGroup) {
        await context.reply(GROUP_REPLY)
        return
      }

      await context.replyRaw(
        htmlPrimitiveMessage({
          html: DINO_HTML,
          caption: 'Dino Run',
          responseId: `dino-${randomUUID()}`,
        }),
      )
    },
  }
}

const dino = createDinoCommand({ enabled: process.env['BOT_HTML_GAMES'] === '1' })

export default dino
