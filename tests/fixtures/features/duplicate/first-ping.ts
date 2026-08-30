import type { Command } from '../../../../src/commands/command.js'

const command = {
  name: 'ping',
  category: 'general',
  description: 'Fixture pertama pemilik trigger "ping".',
  async run(ctx) {
    await ctx.reply('pong')
  },
} satisfies Command

export default command
