import type { Command, CommandContext } from '../../commands/command.js'
import { richButtons } from '../../messages/rich.js'

export const SUIT_CHOICES = ['batu', 'gunting', 'kertas'] as const
export type SuitChoice = (typeof SUIT_CHOICES)[number]
export type SuitOutcome = 'win' | 'lose' | 'draw'

/** Each choice beats the next one in the ring: batu > gunting > kertas > batu. */
const BEATS: Record<SuitChoice, SuitChoice> = {
  batu: 'gunting',
  gunting: 'kertas',
  kertas: 'batu',
}

const EMOJI: Record<SuitChoice, string> = { batu: '🪨', gunting: '✂️', kertas: '📄' }

/** Outcome from the player's point of view. */
export function judge(player: SuitChoice, bot: SuitChoice): SuitOutcome {
  if (player === bot) return 'draw'
  return BEATS[player] === bot ? 'win' : 'lose'
}

const isChoice = (value: string): value is SuitChoice =>
  SUIT_CHOICES.includes(value as SuitChoice)

const VERDICT: Record<SuitOutcome, string> = {
  win: 'Kamu menang!',
  lose: 'Kamu kalah.',
  draw: 'Seri.',
}

const suit: Command = {
  name: 'suit',
  aliases: ['batugunting'],
  category: 'fun',
  description: 'Suit batu-gunting-kertas lawan bot',
  usage: '.suit [batu|gunting|kertas]',
  cooldownMs: 2000,
  run: async (context: CommandContext): Promise<void> => {
    const choice = context.args[0]?.toLowerCase()

    if (choice === undefined) {
      await context.replyContent(
        richButtons({
          text: 'Pilih jurus kamu.',
          footer: 'batu > gunting > kertas > batu',
          buttons: SUIT_CHOICES.map((value) => ({
            text: `${EMOJI[value]} ${value}`,
            id: `${context.prefix}suit ${value}`,
          })),
        }),
      )
      return
    }

    if (!isChoice(choice)) {
      await context.reply(`Pilihan tidak dikenal. Pakai: batu, gunting, kertas.`)
      return
    }

    const bot = SUIT_CHOICES[Math.floor(context.random() * SUIT_CHOICES.length)] ?? 'batu'
    const outcome = judge(choice, bot)
    await context.reply(
      `Kamu ${EMOJI[choice]} ${choice} vs ${EMOJI[bot]} ${bot} aku.\n${VERDICT[outcome]}`,
    )
  },
}

export default suit
