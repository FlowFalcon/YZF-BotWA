# Command Specification

Dokumen ini menjadi kontrak semua command Zapo Fun Bot.

## 1. Metadata wajib

```ts
interface Command {
  name: string
  aliases?: readonly string[]
  category: 'general' | 'fun'
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

## 2. Context

Command hanya menggunakan API yang disediakan `CommandContext` untuk behavior umum.

```ts
interface CommandContext {
  event: WaIncomingMessageEvent
  chatJid: string
  senderJid: string
  senderAltJid?: string
  senderPnJid?: string
  senderLidJid?: string
  senderNumber?: string
  pushName?: string
  isGroup: boolean
  isOwner: boolean
  prefix: string
  commandName: string
  args: readonly string[]
  text: string
  receivedAtMs: number
  now(): number
  random(): number
  reply(content: string): Promise<void>
  react(emoji: string): Promise<void>
}
```

`event` tersedia untuk kebutuhan quote/reaction yang typed, tetapi feature tidak boleh memodifikasinya atau melakukan normalisasi identitas sendiri.

## 3. Parsing

Contoh input dengan prefix `.`:

| Input | Hasil |
|---|---|
| `.ping` | command `ping`, args `[]`, text `''` |
| `.PING` | command `ping` |
| `.rate kopi susu` | command `rate`, args `['kopi','susu']`, text `kopi susu` |
| `.  ping` | command `ping` jika whitespace setelah prefix diizinkan parser |
| `ping` | bukan command |
| `.` | bukan command |
| `.unknown` | lookup miss, tidak dibalas |

Keputusan final: whitespace setelah prefix boleh ada dan dinormalisasi. Whitespace di dalam `text` dipangkas pada tepi; `args` dipecah dengan `/\s+/`.

## 4. Registry

- Loader menemukan `src/features/**/*.ts` pada development/source dan output ekuivalennya saat production.
- Loader memvalidasi seluruh module sebelum publish.
- Duplicate trigger menghasilkan error yang menyebut trigger dan kedua file.
- Registry menyimpan canonical command sekali; alias hanya index.
- Menu membaca canonical commands, sehingga alias tidak tampil sebagai command terpisah.
- Urutan menu: category lalu name, keduanya ascending.

## 5. Middleware order

1. Ignore own messages/newsletter/broadcast yang tidak didukung.
2. Build context.
3. Parse command.
4. Resolve command.
5. Check permission.
6. Check flood limit.
7. Check cooldown.
8. Execute command.
9. Handle/log error.

Tidak boleh mengubah urutan ini tanpa memperbarui PRD, arsitektur, test, dan decision log.

## 6. Reply policy

- Respons singkat dan berbahasa Indonesia.
- Error internal tidak memuat stack trace ke WhatsApp.
- Input invalid dibalas dengan usage yang actionable.
- Permission failure boleh dibalas; unknown command diabaikan.
- Reply di grup dikirim ke group JID.
- Feature tidak melakukan retry sendiri.

## 7. Command MVP

### `menu`

- Alias: `help`.
- Menampilkan command canonical per kategori.
- Menggunakan prefix aktif dari context.
- Tidak hardcode daftar command; membaca registry melalui read-only menu service.

### `ping`

- Alias: `p`.
- Menghitung latency dari `now() - receivedAtMs`.
- Output tidak mengklaim network latency WhatsApp.

### `dice`

- Alias: `dadu`.
- `floor(random() * 6) + 1`.
- Test mencakup boundary 1 dan 6 dengan injected random.

### `coinflip`

- Alias: `coin`, `koin`.
- Nilai `< 0.5` menghasilkan satu sisi, nilai lain sisi kedua.
- Istilah output dipilih sekali dan diuji konsisten.

### `eightball`

- Alias: `8ball`.
- Memerlukan `text` nonkosong.
- Memilih dari daftar respons immutable.
- Daftar respons tidak mengandung penghinaan, ancaman, atau klaim faktual berbahaya.

### `rate`

- Alias: `nilai`.
- Memerlukan `text` nonkosong.
- Nilai 0–100 deterministik berdasarkan normalized input dan tanggal UTC.
- Input yang sama pada tanggal UTC yang sama menghasilkan nilai sama di semua proses.
- Tidak menggunakan `Math.random()`.

## 8. Contoh module

```ts
import type { Command } from '../../commands/command.js'

const command = {
  name: 'dice',
  aliases: ['dadu'],
  category: 'fun',
  description: 'Melempar satu dadu enam sisi.',
  cooldownMs: 3_000,
  async run(ctx) {
    const value = Math.floor(ctx.random() * 6) + 1
    await ctx.reply(`🎲 Kamu mendapatkan ${value}.`)
  },
} satisfies Command

export default command
```

Contoh harus disesuaikan dengan contract final dan dibuktikan oleh typecheck.
