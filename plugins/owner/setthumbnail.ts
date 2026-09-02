import type { Command } from '../../lib/commands/command.js'
import { runProfileAction } from '../../lib/profile/command.js'

const setthumbnail = {
  name: 'setthumbnail',
  category: 'owner',
  description: 'Mengubah thumbnail menu bot.',
  usage: 'setthumbnail (kirim atau reply gambar)',
  permission: 'owner',
  async run(context) {
    await runProfileAction(
      context,
      (service) => service.setThumbnail(context.message),
      'Thumbnail menu berhasil diubah.',
    )
  },
} satisfies Command

export default setthumbnail
