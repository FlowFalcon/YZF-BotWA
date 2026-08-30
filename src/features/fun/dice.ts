import type { Command } from '../../commands/command.js'

const command = {
  name: 'dice',
  aliases: ['dadu'],
  category: 'fun',
  description: 'Melempar satu dadu enam sisi.',
  cooldownMs: 3_000,
  async run(ctx) {
    const face = Math.floor(ctx.random() * 6) + 1
    await ctx.reply(`🎲 Dadu menunjukkan ${face}.`)
  },
} satisfies Command

export default command
