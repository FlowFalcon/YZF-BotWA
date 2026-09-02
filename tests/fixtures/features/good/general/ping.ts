import type { Command } from '../../../../../lib/commands/command.js'

const command = {
  name: 'ping',
  aliases: ['p'],
  category: 'tools',
  description: 'Membalas pong.',
  async run(ctx) {
    await ctx.reply('pong')
  },
} satisfies Command

export default command
