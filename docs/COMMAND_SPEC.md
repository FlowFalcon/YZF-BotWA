# Command Specification

Dokumen ini menjadi kontrak semua command YZF-BotWA.

## 1. Metadata wajib

```ts
interface Command {
  name: string
  aliases?: readonly string[]
  category: 'owner' | 'group' | 'tools' | 'downloader' | 'sticker' | 'games'
  description: string
  usage?: string
  permission?: 'everyone' | 'owner'
  cooldownMs?: number
  run(context: CommandContext): Promise<void>
}
```

Aturan:

- `name` hanya lowercase ASCII, digit, dan `-`; harus diawali huruf/digit.
- Alias mengikuti aturan yang sama.
- Nama dan alias unik secara global.
- `description` satu kalimat pendek untuk menu.
- `usage` tidak menyertakan prefix hardcoded.
- Default `permission` adalah `everyone`.
- Default cooldown ditentukan config/pipeline.
- `run` menyelesaikan reply sendiri dan tidak mengembalikan payload khusus.
- File plugin diletakkan di `plugins/<category>/`, sesuai `category`-nya (D-020).

## 2. Context

Command hanya menggunakan API yang disediakan `CommandContext`. Definisi lengkapnya ada di
`lib/commands/command.ts`; dokumen ini tidak menduplikasi field agar tidak pernah basi.

Yang perlu diketahui saat menulis command:

- Identitas: `chatJid`, `senderJid`, `senderNumber`, `pushName`, `isGroup`, `isOwner`.
- Input: `prefix`, `commandName`, `args`, `text`, dan `message` untuk lampiran.
- Waktu dan acak: `receivedAtMs`, `now()`, `random()` — jangan pakai `Date.now()` atau `Math.random()` langsung agar test tetap deterministik.
- Output: `reply` (teks), `Reply` (kartu link-preview), `replyContent` (native flow), `replyMedia` (sticker), `replyImage` (gambar), `replyAIRich` (AIRich HTML), `react`.
- Read-only: `settings` untuk mode aktif, `commands` untuk daftar command, `menuThumbnailPath` untuk aset branding.

Command tidak menerima raw event: normalisasi identitas dan pemilihan target reply dilakukan sekali di `lib/messages/context.ts`.

## 3. Parsing

Contoh input dengan prefix `.`:

| Input | Hasil |
|---|---|
| `.ping` | command `ping`, args `[]`, text `''` |
| `.PING` | command `ping` |
| `.botmode group-only` | command `botmode`, args `['group-only']`, text `group-only` |
| `.  ping` | command `ping` jika whitespace setelah prefix diizinkan parser |
| `ping` | bukan command |
| `.` | bukan command |
| `.unknown` | lookup miss, tidak dibalas |

Keputusan final: whitespace setelah prefix boleh ada dan dinormalisasi. Whitespace di dalam `text` dipangkas pada tepi; `args` dipecah dengan `/\s+/`.

## 4. Registry

- Loader menemukan `plugins/**/*.ts` pada source dan output `dist/plugins/**/*.js` saat runtime.
- Loader memvalidasi seluruh module sebelum publish.
- Duplicate trigger menghasilkan error yang menyebut trigger dan kedua file.
- Registry menyimpan canonical command sekali; alias hanya index.
- Menu membaca canonical commands, sehingga alias tidak tampil sebagai command terpisah.
- Urutan menu: category lalu name, keduanya ascending.
- Watcher selalu aktif, didebounce 400 ms, dan hanya mempublikasikan registry kandidat yang lengkap dan valid.

## 5. Middleware order

1. Ignore own messages/newsletter/broadcast yang tidak didukung.
2. Build context.
3. Parse command.
4. Check mode access melalui `SettingsView`.
5. Resolve command.
6. Check permission.
7. Check flood limit.
8. Check cooldown.
9. Execute command.
10. Handle/log error.

Tidak boleh mengubah urutan ini tanpa memperbarui PRD, arsitektur, test, dan decision log.

## 6. Reply policy

- Respons singkat dan berbahasa Indonesia.
- Error internal tidak memuat stack trace ke WhatsApp.
- Input invalid dibalas dengan usage yang actionable.
- Permission failure boleh dibalas; unknown command diabaikan.
- Reply di grup dikirim ke group JID.
- Feature tidak melakukan retry sendiri.

## 7. Surface command v0.0.1

Registry berisi command berikut:

- Tools: `menu`, `ping`, `qrcode`, `ssweb`, `hd`.
- Sticker: `sticker`.
- Games: `dino`.
- Group: `groupmenu`, `add`, `kick`, `promote`, `demote`, `hidetag`, `tagall`, `gcname`, `gcdesc`, `linkgroup`, `group`.
- Owner: `ownermenu`, `botmode`, `ban`, `unban`, `banchat`, `unbanchat`, `banlist`, `setname`, `setabout`, `setpp`, `delpp`, `setthumbnail`, `delthumbnail`.

`menu`, `groupmenu`, dan `ownermenu` dikirim sebagai teks berkategori tanpa button.
`ctx.reply` mengirim teks polos; `ctx.Reply` mengirim kartu link-preview dan fallback
ke teks bila media tidak tersedia. Command yang memerlukan teks atau media tidak
diwakili button kosong.

Command grup memerlukan admin pengirim dan admin bot. Ban diperiksa sebelum access
mode dan registry lookup; owner dikecualikan agar tidak dapat mengunci dirinya.

Command `.raw`, `.v4`, `.premium`, dan eksekusi source dari chat tidak tersedia.

## 8. Contoh module

File: `plugins/tools/hello.ts`

```ts
import type { Command } from '../../lib/commands/command.js'

const command = {
  name: 'hello',
  aliases: ['hi'],
  category: 'tools',
  description: 'Menyapa pengirim.',
  cooldownMs: 3_000,
  async run(ctx) {
    await ctx.reply(`Halo, ${ctx.pushName ?? 'kawan'}!`)
  },
} satisfies Command

export default command
```

`satisfies Command` menjaga metadata tetap sesuai kontrak tanpa melebarkan type hasil, dan default export adalah satu-satunya bentuk yang dibaca loader.
