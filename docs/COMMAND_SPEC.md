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
- Output: `reply` (teks), `replyContent` (native flow atau kartu `externalAdReply`), `replyMedia` (sticker), `replyAIRich` (AIRich HTML), `react`.
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

Registry berisi tepat 12 command: `botmode`, `delpp`, `delthumbnail`, `dino`, `menu`, `ownermenu`, `ping`, `setabout`, `setname`, `setpp`, `setthumbnail`, `sticker`.

### `menu`

- Alias: `help`.
- Menampilkan branding `YZF-BotWA` dan command canonical yang boleh dilihat caller.
- Header memuat nama, nomor, peran, jenis chat, mode aktif, prefix, dan uptime.
- Tombol native hanya menjadi shortcut tindakan yang sudah bermakna: Ping dan Dino Run, ditambah Owner Menu khusus owner.
- Command yang membutuhkan teks atau media tidak dijadikan tombol; keduanya tetap muncul sebagai daftar.
- Thumbnail dikirim sebagai kartu `externalAdReply`, bukan header interactive (D-019).
- Menggunakan prefix aktif dari context dan registry read-only.

### `ping`

- Alias: `p`.
- Menghitung latency dari `now() - receivedAtMs`.
- Output tidak mengklaim network latency WhatsApp.
- Membawa kartu `externalAdReply` kecil bila thumbnail terpasang; tanpa thumbnail menjadi teks biasa.

### `sticker`

- Mengubah foto/video/GIF yang didukung menjadi sticker.
- Tetap menjadi fitur inti.

### `dino`

- Alias: `dinorun`.
- Mengirim renderer HTML AIRich; renderer lane emoji lama tidak tersedia.

### `ownermenu`

- Owner-only.
- Mendaftar command profil/branding beserta usage-nya sebagai teks, karena semuanya butuh input.
- Tombol hanya `Bot Mode` dan `Main Menu` — dua aksi yang selesai dengan satu tap.

### `botmode`

- Owner-only dan selalu menjadi jalur kontrol darurat owner.
- Tanpa argumen menampilkan mode aktif, penjelasan tiap mode, tombol untuk mode yang belum aktif, dan tombol `Owner Menu`. Mode yang sedang aktif tidak dijadikan tombol karena tap-nya tidak mengubah apa pun.
- Argumen valid disimpan atomik dan langsung berlaku tanpa restart.
- Argumen invalid tidak mengubah settings.

### Profil dan branding owner

- `.setname <nama>` mengubah push name; nama wajib 1–25 karakter tanpa karakter kontrol.
- `.setpp` memakai gambar langsung/reply JPEG, PNG, atau WebP maksimal 8 MiB; gambar di-center-crop menjadi JPEG 640×640 sebelum dikirim ke profile coordinator.
- `.delpp` hanya menghapus foto profil WhatsApp.
- `.setabout <teks>` mengubah About; teks wajib 1–139 karakter tanpa karakter kontrol.
- `.setthumbnail` memakai batas media yang sama dan menyimpan JPEG menu secara atomik di `assets/menu-thumbnail.jpg` di samping `BOT_STORE_PATH`, dengan direktori `0700` dan file `0600`.
- `.delthumbnail` hanya menghapus thumbnail khusus sehingga menu kembali ke aset default.
- Keenam command bersifat owner-only. Foto profil WhatsApp dan thumbnail menu tidak saling mengubah.

Command `.raw`, `.v4`, filler lama, `.panel`, dan `.access` tidak terdaftar.

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
