import type { Command } from '../../lib/commands/command.js'
import { commandLine } from '../../lib/messages/menu-text.js'

/**
 * Menu grup terpisah dari `.menu` supaya perintah admin punya penjelasan
 * pemakaian sendiri; `.menu` hanya memuat satu baris per command.
 */
const ENTRIES = [
  { name: 'kick', usage: 'kick @user', description: 'keluarkan peserta' },
  { name: 'add', usage: 'add 628xxx', description: 'tambahkan nomor' },
  { name: 'promote', usage: 'promote @user', description: 'jadikan admin' },
  { name: 'demote', usage: 'demote @user', description: 'turunkan admin' },
  { name: 'group', usage: 'group open|close', description: 'buka/tutup grup' },
  { name: 'setname', usage: 'gcname <teks>', description: 'ubah nama grup' },
  { name: 'setdesc', usage: 'gcdesc <teks>', description: 'ubah deskripsi grup' },
  { name: 'linkgroup', usage: 'linkgroup [reset]', description: 'link undangan, reset untuk mengganti' },
  { name: 'hidetag', usage: 'hidetag <pesan>', description: 'panggil semua tanpa tag terlihat' },
  { name: 'tagall', usage: 'tagall [pesan]', description: 'panggil semua dengan daftar' },
] as const

const groupmenu = {
  name: 'groupmenu',
  aliases: ['gcmenu'],
  category: 'group',
  description: 'Menampilkan perintah grup beserta cara pakainya.',
  cooldownMs: 3_000,
  async run(context) {
    const lines = [
      '*Group Menu*',
      'Semua perintah di bawah butuh admin grup; sebagian juga butuh bot jadi admin.',
      '',
      ...ENTRIES.map((entry) => commandLine(context.prefix, entry)),
    ]
    await context.Reply(lines.join('\n'), { description: 'Perintah grup' })
  },
} satisfies Command

export default groupmenu
