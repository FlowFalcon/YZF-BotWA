import type { Command } from '../../../../../src/commands/command.js'

const command = {
  name: 'ping',
  aliases: ['p'],
  category: 'general',
  description: 'Membalas pong.',
  async run(ctx) {
    await ctx.reply('pong')
  },
} satisfies Command

export default command
