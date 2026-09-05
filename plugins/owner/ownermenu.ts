import type { Command } from '../../lib/commands/command.js'
import { commandLine } from '../../lib/messages/menu-text.js'

/**
 * Owner menu ditulis tangan, bukan dari registry: perintah owner butuh contoh
 * pemakaian (teks/media/nomor) yang tidak tertampung di `description`.
 *
 * Tidak ada tier premium — batas akses bot ini hanya owner vs bukan owner.
 */
const ENTRIES = [
  { name: 'botmode', usage: 'botmode [public|group-only|owner-only]', description: 'lihat atau ubah mode akses' },
  { name: 'ban', usage: 'ban @user', description: 'blokir user dari semua perintah' },
  { name: 'unban', usage: 'unban @user', description: 'cabut blokir user' },
  { name: 'banchat', usage: 'banchat', description: 'blokir chat/grup ini' },
  { name: 'unbanchat', usage: 'unbanchat', description: 'cabut blokir chat ini' },
  { name: 'banlist', usage: 'banlist', description: 'daftar user dan chat terblokir' },
  { name: 'setname', usage: 'setname <nama>', description: 'ubah nama profil bot' },
  { name: 'setabout', usage: 'setabout <teks>', description: 'ubah About bot' },
  { name: 'setpp', usage: 'setpp (kirim/reply gambar)', description: 'ubah foto profil' },
  { name: 'delpp', usage: 'delpp', description: 'hapus foto profil' },
  { name: 'setthumbnail', usage: 'setthumbnail (kirim/reply gambar)', description: 'ubah thumbnail kartu' },
  { name: 'delthumbnail', usage: 'delthumbnail', description: 'hapus thumbnail kartu' },
] as const

const ownermenu = {
  name: 'ownermenu',
  category: 'owner',
  description: 'Menampilkan kontrol khusus owner.',
  permission: 'owner',
  cooldownMs: 2_000,
  async run(context) {
    const lines = [
      '*Owner Menu*',
      'Hanya owner yang bisa menjalankan perintah di bawah.',
      '',
      ...ENTRIES.map((entry) => commandLine(context.prefix, entry)),
    ]
    await context.Reply(lines.join('\n'), { description: 'Owner control' })
  },
} satisfies Command

export default ownermenu
