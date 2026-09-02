import type { Command } from '../../lib/commands/command.js'
import { runProfileAction } from '../../lib/profile/command.js'

const delthumbnail = {
  name: 'delthumbnail',
  category: 'owner',
  description: 'Menghapus thumbnail menu khusus.',
  permission: 'owner',
  async run(context) {
    await runProfileAction(
      context,
      (service) => service.deleteThumbnail(),
      'Thumbnail menu dikembalikan ke aset default.',
    )
  },
} satisfies Command

export default delthumbnail
