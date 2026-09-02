import type { Command } from '../../lib/commands/command.js'
import { runProfileAction } from '../../lib/profile/command.js'

const delpp = {
  name: 'delpp',
  category: 'owner',
  description: 'Menghapus foto profil bot.',
  permission: 'owner',
  async run(context) {
    await runProfileAction(
      context,
      (service) => service.deleteProfilePicture(),
      'Foto profil berhasil dihapus.',
    )
  },
} satisfies Command

export default delpp
