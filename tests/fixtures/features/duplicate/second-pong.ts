import type { Command } from '../../../../lib/commands/command.js'

/** Alias sengaja bertabrakan dengan `first-ping.ts`. */
const command = {
  name: 'pong',
  aliases: ['ping'],
  category: 'tools',
  description: 'Fixture dengan trigger duplikat.',
  async run(ctx) {
    await ctx.reply('pong')
  },
} satisfies Command

export default command
