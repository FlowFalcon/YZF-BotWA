import type { Command } from '../../lib/commands/command.js'
import { runProfileAction } from '../../lib/profile/command.js'

const setpp = {
  name: 'setpp',
  category: 'owner',
  description: 'Mengubah foto profil bot.',
  usage: 'setpp (kirim atau reply gambar)',
  permission: 'owner',
  async run(context) {
    await runProfileAction(
      context,
      (service) => service.setProfilePicture(context.message),
      'Foto profil berhasil diubah.',
    )
  },
} satisfies Command

export default setpp
