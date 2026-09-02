import type { Command } from '../../lib/commands/command.js'
import { runProfileAction } from '../../lib/profile/command.js'

const setname = {
  name: 'setname',
  category: 'owner',
  description: 'Mengubah nama profil bot.',
  usage: 'setname <nama>',
  permission: 'owner',
  async run(context) {
    await runProfileAction(
      context,
      (service) => service.setName(context.text),
      'Nama profil berhasil diubah.',
    )
  },
} satisfies Command

export default setname
