import { randomUUID } from 'node:crypto'
import type { Command, CommandContext } from '../../commands/command.js'
import { htmlPrimitiveMessage } from '../../messages/ai-rich.js'
import { richButtons } from '../../messages/rich.js'
import { DINO_HTML } from '../../games/dino-html.js'
import { renderLane, startRun, step, type DinoAction, type DinoState } from '../../games/dino-engine.js'

export interface DinoOptions {
  /**
   * `BOT_HTML_GAMES=1`. Sends the canvas version alongside the button card.
   * Default off: no client has been shown to render the HTML primitive.
   */
  readonly htmlEnabled: boolean
}

/**
 * One run per player, keyed by sender so two people in the same chat do not
 * share a dino. Runs live in memory only — a restart drops them, which is the
 * right trade for a game nobody resumes hours later.
 *
 * Owned per command instance rather than module-wide, so tests get isolation
 * for free.
 *
 * ponytail: unbounded map; add an idle sweep if this ever runs in busy groups.
 */
const ACTIONS: Record<string, DinoAction> = { jump: 'jump', lompat: 'jump', run: 'run', lari: 'run' }

const board = (state: DinoState, prefix: string): string => {
  const lane = renderLane(state)
  if (state.over) {
    return `${lane}\n\n💥 Kena kaktus!\nSkor: ${state.score}  •  Terbaik: ${state.best}\nTekan Main Lagi untuk ronde baru.`
  }
  return `${lane}\n\nSkor: ${state.score}  •  Terbaik: ${state.best}\nTekan Lompat sebelum kaktus sampai, atau Lari untuk maju.\n${prefix}dino`
}

const card = (state: DinoState, prefix: string) =>
  richButtons({
    text: board(state, prefix),
    footer: 'Dino Run',
    buttons: state.over
      ? [{ text: '🔁 Main Lagi', id: `${prefix}dino` }]
      : [
          { text: '⬆️ Lompat', id: `${prefix}dino jump` },
          { text: '➡️ Lari', id: `${prefix}dino run` },
        ],
  })

export function createDinoCommand(options: DinoOptions): Command {
  const runs = new Map<string, DinoState>()

  return {
    name: 'dino',
    aliases: ['dinorun'],
    category: 'fun',
    description: 'Game dino runner: lompati kaktus, kumpulkan skor',
    usage: '.dino  •  lalu tekan tombol',
    cooldownMs: 1_000,
    run: async (context: CommandContext): Promise<void> => {
      const key = `${context.chatJid}:${context.senderJid}`
      const action = ACTIONS[(context.args[0] ?? '').toLowerCase()]
      const existing = runs.get(key)

      // A move only continues a live run; anything else opens a fresh one.
      const state =
        action !== undefined && existing !== undefined && !existing.over
          ? step(existing, action, () => context.random())
          : startRun(existing?.best ?? 0)

      runs.set(key, state)
      await context.replyContent(card(state, context.prefix))

      // The canvas version is a bonus on top of the card that already works,
      // never a replacement — if it fails to render the player still has a game.
      // Groups are allowed: only owner-allowlisted groups reach this code at all.
      if (options.htmlEnabled && state.score === 0 && !state.over) {
        await context.replyRaw(
          htmlPrimitiveMessage({
            html: DINO_HTML,
            caption: 'Dino Run',
            responseId: `dino-${randomUUID()}`,
          }),
        )
      }
    },
  }
}

const dino = createDinoCommand({ htmlEnabled: process.env['BOT_HTML_GAMES'] === '1' })

export default dino
