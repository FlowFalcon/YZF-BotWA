import type { Command } from '../../../../../../src/commands/command.js'

const command = {
  name: 'dice',
  aliases: ['dadu'],
  category: 'fun',
  description: 'Melempar satu dadu enam sisi.',
  async run(ctx) {
    await ctx.reply(`dadu ${String(Math.floor(ctx.random() * 6) + 1)}`)
  },
} satisfies Command

export default command
