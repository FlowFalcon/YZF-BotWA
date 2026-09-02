import type { Command } from '../../../../../../lib/commands/command.js'

const command = {
  name: 'dice',
  aliases: ['dadu'],
  category: 'games',
  description: 'Melempar satu dadu enam sisi.',
  async run(ctx) {
    await ctx.reply(`dadu ${String(Math.floor(ctx.random() * 6) + 1)}`)
  },
} satisfies Command

export default command
