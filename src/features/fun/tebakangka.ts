import type { Command, CommandContext } from '../../commands/command.js'
import { richButtons } from '../../messages/rich.js'

const MIN = 1
const MAX = 5

export type GuessResult = 'hit' | 'higher' | 'lower'

/** Direction is advice for the player: 'higher' means the secret is above the guess. */
export function evaluateGuess(guess: number, secret: number): GuessResult {
  if (guess === secret) return 'hit'
  return guess < secret ? 'higher' : 'lower'
}

const tebakangka: Command = {
  name: 'tebakangka',
  aliases: ['tebak'],
  category: 'fun',
  description: `Tebak angka rahasia ${String(MIN)}-${String(MAX)}`,
  usage: `.tebakangka [${String(MIN)}-${String(MAX)}]`,
  cooldownMs: 2000,
  run: async (context: CommandContext): Promise<void> => {
    const raw = context.args[0]

    if (raw === undefined) {
      const range = Array.from({ length: MAX - MIN + 1 }, (_, index) => MIN + index)
      await context.replyContent(
        richButtons({
          text: `Aku menyimpan satu angka ${String(MIN)}-${String(MAX)}. Tebak yang mana.`,
          footer: 'satu tebakan per ronde',
          buttons: range.map((value) => ({
            text: String(value),
            id: `${context.prefix}tebakangka ${String(value)}`,
          })),
        }),
      )
      return
    }

    const guess = Number(raw)
    if (!Number.isInteger(guess) || guess < MIN || guess > MAX) {
      await context.reply(`Tebakan harus angka bulat ${String(MIN)} sampai ${String(MAX)}.`)
      return
    }

    // Each invocation is its own round: no cross-message state to persist or leak.
    const secret = MIN + Math.floor(context.random() * (MAX - MIN + 1))
    const result = evaluateGuess(guess, secret)
    if (result === 'hit') {
      await context.reply(`Tepat! Angkanya ${String(secret)}.`)
      return
    }
    await context.reply(
      result === 'higher'
        ? `Tebakanmu terlalu kecil. Angkanya ${String(secret)}.`
        : `Tebakanmu terlalu besar. Angkanya ${String(secret)}.`,
    )
  },
}

export default tebakangka
