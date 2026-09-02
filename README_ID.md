# YZF-BotWA

Base bot WhatsApp modular berbasis TypeScript dan [`zapo-js`](https://www.npmjs.com/package/zapo-js).

Dua belas command yang berjalan, plugin loader hot-reload dengan policy keamanan statis, button native-flow yang terhubung ke aksi nyata, dan test suite yang menutup kontrak runtime. Pakai ini sebagai titik awal bot kamu sendiri, bukan menulis ulang lapisan koneksi, routing, dan akses dari nol.

[English](README.md)

## Status

Versi `0.0.1`. Runtime sudah terverifikasi — 335 test pada 47 file, typecheck, lint, dan build lulus — dan permukaan command sudah stabil. Package ditandai `private`, jadi distribusinya berupa source, bukan release npm.

## Fitur

- **12 command** pada kategori tools, sticker, games, dan owner, semuanya terdaftar dari `plugins/`.
- **Plugin loader dengan policy statis.** Source plugin diparse sebelum dikompilasi; `eval`, `new Function`, `process`, `require`, `import()` dinamis, computed member access, decorator, dan top-level side effect ditolak. Hanya `zapo-js` dan tiga builtin `node:` yang boleh diimpor.
- **Hot reload.** Mengedit file di `plugins/` memicu kompilasi ke generation immutable di `.runtime/plugins/` lalu registry ditukar atomik. Plugin rusak tidak mengubah registry yang sedang berjalan.
- **Button sesuai fungsi.** Quick reply native-flow hanya dipakai ketika satu tap menyelesaikan aksi atau membuka menu yang berguna. Command yang butuh teks atau media tetap sebagai command terdokumentasi.
- **Branding card.** `externalAdReply` membawa thumbnail menu pada reply interaktif maupun compact, sehingga akun normal (non-business) tetap menampilkan gambar.
- **Tiga mode akses** yang disimpan atomik dan berlaku tanpa restart: `public`, `group-only`, `owner-only`.
- **Rate limiting.** Flood control sliding window (5 command per 10 detik per pengirim) plus cooldown per command berbasis nama kanonik, jadi alias tidak bisa dipakai untuk mengakalinya.
- **Sticker** dari gambar, video, GIF, dan sticker animasi lewat pemanggilan `ffmpeg` dengan argv tetap — tanpa shell, dengan metadata pack ditulis ke chunk EXIF WebP.
- **Logger yang meredaksi.** Credential, payload QR, pairing code, dan teks pesan mentah disensor di level pino, bukan hanya lewat kebiasaan menulis kode.
- **AIRich HTML.** `.dino` mengirim game HTML yang bisa dimainkan, dirender oleh HTML primitive milik WhatsApp.

## Kebutuhan

- Node.js `>= 20.9.0` (dikembangkan di v22)
- `ffmpeg` tersedia di `PATH` (encoding sticker)
- Satu akun WhatsApp untuk bot, dan perangkat kedua untuk memindai QR atau memasukkan pairing code

## Mulai cepat

```bash
git clone <url-fork-kamu> yzf-botwa
cd yzf-botwa
npm ci
cp .env.example .env
# isi BOT_OWNER_NUMBER di .env, digit dengan country code
npm run check
npm run build
npm start
```

Pada run pertama QR dicetak di terminal. Pindai dari **WhatsApp → Perangkat tertaut → Tautkan perangkat**. State session ditulis ke `.auth/state.sqlite` dan dipakai lagi pada start berikutnya.

Bot mulai dalam mode `owner-only`. Kirim `.botmode public` dari nomor owner untuk membukanya.

Login pairing code, setup noninteraktif, dan troubleshooting run pertama ada di [docs/INSTALLATION.md](docs/INSTALLATION.md).

## Command

Prefix default `.` — bisa diubah lewat `BOT_PREFIXES`.

| Command | Alias | Kategori | Akses | Keterangan |
| --- | --- | --- | --- | --- |
| `.menu` | `.help` | tools | semua | Navigasi command dengan branding card dan button |
| `.ping` | `.p` | tools | semua | Cek bot aktif dan waktu proses pesan |
| `.sticker` | `.s`, `.stiker` | sticker | semua | Gambar/video/GIF jadi sticker |
| `.dino` | `.dinorun` | games | semua | Dino Run, dirender sebagai AIRich HTML primitive |
| `.ownermenu` | — | owner | owner | Permukaan kontrol owner |
| `.botmode` | — | owner | owner | Melihat atau mengubah mode akses |
| `.setname` | — | owner | owner | Mengubah nama profil bot |
| `.setabout` | — | owner | owner | Mengubah teks About bot |
| `.setpp` | — | owner | owner | Mengatur foto profil dari gambar |
| `.delpp` | — | owner | owner | Menghapus foto profil |
| `.setthumbnail` | — | owner | owner | Mengatur thumbnail menu dari gambar |
| `.delthumbnail` | — | owner | owner | Mengembalikan thumbnail menu default |

Input, reply, dan cooldown tiap command didokumentasikan di [docs/USAGE.md](docs/USAGE.md).

## Konfigurasi

Seluruh konfigurasi berupa environment variable, dimuat dengan `--env-file` milik Node. Tidak ada dependency `dotenv`.

| Variable | Wajib | Default | Fungsi |
| --- | --- | --- | --- |
| `BOT_OWNER_NUMBER` | ya | — | Nomor owner, digit dengan country code |
| `BOT_PREFIXES` | tidak | `.` | Prefix command, dipisah koma |
| `BOT_AUTH_METHOD` | tidak | `auto` | `auto`, `qr`, atau `pairing` |
| `BOT_PAIRING_NUMBER` | bila pairing | — | Nomor bot sendiri untuk alur link-code |
| `BOT_SESSION_ID` | tidak | `default` | Kunci session di store; jangan diubah setelah pairing |
| `BOT_STORE_PATH` | tidak | `.auth/state.sqlite` | Lokasi SQLite protocol store |
| `BOT_LOG_LEVEL` | tidak | `info` | `trace`, `debug`, `info`, `warn`, `error` |
| `NODE_ENV` | tidak | `development` | `production` membuat logger menulis JSON lines |

Nilai invalid membuat startup gagal dengan error bernama, bukan diam-diam mundur ke default. Detail dan path turunan ada di [docs/CONFIGURATION.md](docs/CONFIGURATION.md).

## Struktur project

```text
app/        Entry point: env, wiring, penanganan signal
lib/        Core: config, client, auth, routing, middleware, media, messages
plugins/    Command, satu file per command, dikelompokkan per kategori
tests/      Suite unit, integration, dan e2e
docs/       Dokumentasi publik
```

`lib/` tidak pernah mengimpor plugin konkret. Command mengimpor dari `lib/`; ketergantungan hanya satu arah.

## Menulis plugin

```ts
// plugins/tools/hello.ts
import type { Command } from '../../lib/commands/command.js'

const hello = {
  name: 'hello',
  category: 'tools',
  description: 'Membalas dengan sapaan.',
  cooldownMs: 3_000,
  async run(context) {
    await context.reply(`Hai ${context.pushName ?? 'kamu'}!`)
  },
} satisfies Command

export default hello
```

Simpan file saat bot berjalan dan loader akan memuatnya. Default export wajib berupa `Command`, dan file harus memenuhi plugin policy. Context API, aturan policy, dan panduan button ada di [docs/CREATING_PLUGINS.md](docs/CREATING_PLUGINS.md).

## Pengembangan

```bash
npm run dev            # tsx watch, tanpa build
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
npm test               # vitest run
npm run test:coverage  # vitest run --coverage
npm run check          # typecheck + lint + test
npm run build          # bersihkan dist/, lalu tsc
```

Behavior runtime baru ditulis test dulu: test yang gagal untuk membuktikan gap, baru implementasi. Lihat [docs/TESTING.md](docs/TESTING.md).

## Deployment

`ecosystem.config.cjs` menjalankan entry hasil build di pm2 sebagai satu instance. Dua koneksi ke akun yang sama akan saling menggusur, jadi jumlah instance bukan parameter tuning.

```bash
npm run build
pm2 start ecosystem.config.cjs
pm2 save
```

pm2, kebijakan restart, lokasi log, dan backup dibahas di [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Keamanan

- Tanpa `eval`, `new Function`, eksekusi VM, atau perintah shell yang dibentuk dari input chat. `ffmpeg` dipanggil dengan argv tetap dan `shell: false`.
- `.auth/`, `.env`, `.runtime/`, file SQLite, dan log masuk gitignore. Credential, payload QR, dan pairing code tidak pernah sampai ke logger maupun reply chat.
- Body command di atas 4096 byte tidak diparse. Input sticker dibatasi 8 MiB saat streaming, bukan setelah dibuffer penuh.
- Error dibalas satu kalimat generic; detailnya tetap di log terstruktur.

Model dan catatan ancaman lengkap: [docs/SECURITY.md](docs/SECURITY.md).

## Dokumentasi

- [docs/INSTALLATION.md](docs/INSTALLATION.md) — instalasi, login, run pertama
- [docs/CONFIGURATION.md](docs/CONFIGURATION.md) — environment variable dan path turunan
- [docs/USAGE.md](docs/USAGE.md) — seluruh command secara detail
- [docs/CREATING_PLUGINS.md](docs/CREATING_PLUGINS.md) — API plugin dan policy
- [docs/MESSAGE_BUILDERS.md](docs/MESSAGE_BUILDERS.md) — button, list, branding card, AIRich
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — pm2 dan operasional
- [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) — gejala dan solusi
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — batas modul dan aliran data
- [docs/COMMAND_SPEC.md](docs/COMMAND_SPEC.md) — kontrak command
- [docs/TESTING.md](docs/TESTING.md) — strategi test
- [docs/SECURITY.md](docs/SECURITY.md) — model keamanan

## Kontribusi

Baca [CONTRIBUTING.md](CONTRIBUTING.md). Ringkasnya: `npm run check` wajib lulus, behavior baru butuh test yang ditulis lebih dulu, dan dependency dipin ke versi exact.

## Lisensi

MIT — lihat [LICENSE](LICENSE).

Tidak berafiliasi, tidak didukung, dan tidak terhubung dengan WhatsApp maupun Meta. Mengotomasi akun membawa risiko ban; pakai akun yang siap kamu kehilangan.
