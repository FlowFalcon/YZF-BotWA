import type { Command } from '../../commands/command.js'

const command = {
  name: 'coinflip',
  aliases: ['coin', 'koin'],
  category: 'fun',
  description: 'Melempar koin: kepala atau ekor.',
  cooldownMs: 3_000,
  async run(ctx) {
    const side = ctx.random() < 0.5 ? 'Kepala' : 'Ekor'
    await ctx.reply(`🪙 Hasilnya: ${side}.`)
  },
} satisfies Command

export default command
