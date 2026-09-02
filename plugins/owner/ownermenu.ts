import type { Command } from '../../lib/commands/command.js'
import { brandingCard } from '../../lib/messages/branding.js'
import { richButtons } from '../../lib/messages/rich.js'

const ownermenu = {
  name: 'ownermenu',
  category: 'owner',
  description: 'Membuka kontrol khusus owner.',
  permission: 'owner',
  cooldownMs: 2_000,
  async run(context) {
    const prefix = context.prefix
    const text = [
      '*Owner Menu*',
      '',
      `\`${prefix}setname <nama>\` — ubah nama profil`,
      `\`${prefix}setabout <teks>\` — ubah About`,
      `\`${prefix}setpp\` — kirim/reply gambar profil`,
      `\`${prefix}delpp\` — hapus foto profil`,
      `\`${prefix}setthumbnail\` — kirim/reply thumbnail menu`,
      `\`${prefix}delthumbnail\` — hapus thumbnail menu`,
      '',
      'Command di atas butuh teks atau media, jadi tidak dibuat sebagai button.',
    ].join('\n')

    const card = brandingCard(context.menuThumbnailPath, 'Owner Control', { large: true })

    await context.replyContent(
      richButtons({
        text,
        footer: 'YZF-BotWA',
        ...(card === undefined ? {} : { externalAdReply: card }),
        buttons: [
          { text: 'Bot Mode', id: `${prefix}botmode` },
          { text: 'Main Menu', id: `${prefix}menu` },
        ],
      }),
    )
  },
} satisfies Command

export default ownermenu
