import { randomUUID } from 'node:crypto'
import type { Command } from '../../lib/commands/command.js'
import { DINO_HTML } from '../../lib/games/dino-html.js'
import { htmlPrimitiveMessage, htmlPrimitiveSendOptions } from '../../lib/messages/ai-rich.js'

export function createDinoCommand(): Command {
  return {
    name: 'dino',
    aliases: ['dinorun'],
    category: 'games',
    description: 'Memainkan Dino Run melalui AIRich.',
    cooldownMs: 1_000,
    async run(context) {
      await context.replyAIRich(
        htmlPrimitiveMessage({
          html: DINO_HTML,
          caption: 'Dino Run',
          responseId: `dino-${randomUUID()}`,
        }),
        htmlPrimitiveSendOptions(),
      )
    },
  }
}

// Constructed at import time so the loader picks the command up as the default
// export; assigning through a top-level `const` would be an impure initializer
// under the plugin policy (SECURITY.md §7).
export default createDinoCommand()
