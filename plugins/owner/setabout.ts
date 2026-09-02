import type { Command } from '../../lib/commands/command.js'
import { runProfileAction } from '../../lib/profile/command.js'

const setabout = {
  name: 'setabout',
  category: 'owner',
  description: 'Mengubah About profil bot.',
  usage: 'setabout <teks>',
  permission: 'owner',
  async run(context) {
    await runProfileAction(
      context,
      (service) => service.setAbout(context.text),
      'About profil berhasil diubah.',
    )
  },
} satisfies Command

export default setabout
