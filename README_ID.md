# YZF-BotWA

Base bot WhatsApp modular berbasis TypeScript dan [`zapo-js`](https://www.npmjs.com/package/zapo-js).

[English](README.md)

## Fitur

- Plugin TypeScript, satu file per command di `plugins/`.
- Hot reload dengan validasi source dan pergantian registry atomik.
- Mode akses `public`, `group-only`, dan `owner-only`.
- Flood control, cooldown, permission, dan structured logging.
- Dukungan grup, sticker, kartu reply, media, dan AIRich HTML.
- Session SQLite; konfigurasi dan state sensitif tidak masuk Git.

## Kebutuhan

- Node.js `>=20.9.0`
- `ffmpeg` di `PATH` untuk sticker
- Akun WhatsApp untuk bot

## Mulai

```bash
git clone https://github.com/FlowFalcon/YZF-BotWA.git
cd YZF-BotWA
npm ci
cp .env.example .env
# Isi BOT_OWNER_NUMBER di .env
npm run check
npm run build
npm start
```

Bot mulai dalam mode `owner-only`. Owner dapat menjalankan `.botmode public`.

## Command

Prefix default adalah `.` dan dapat diubah melalui `BOT_PREFIXES`.

- **Tools:** `menu`, `ping`, `qrcode`, `ssweb`, `hd`
- **Sticker:** `sticker`
- **Games:** `dino`
- **Group:** `groupmenu`, `add`, `kick`, `promote`, `demote`, `hidetag`, `tagall`, `gcname`, `gcdesc`, `linkgroup`, `group`
- **Owner:** `ownermenu`, `botmode`, `ban`, `unban`, `banchat`, `unbanchat`, `banlist`, `setname`, `setabout`, `setpp`, `delpp`, `setthumbnail`, `delthumbnail`

Jalankan `.menu`, `.groupmenu`, atau `.ownermenu` untuk usage yang sesuai akses pengguna.

## Konfigurasi

| Variable | Wajib | Default |
| --- | --- | --- |
| `BOT_OWNER_NUMBER` | Ya | — |
| `BOT_PREFIXES` | Tidak | `.` |
| `BOT_AUTH_METHOD` | Tidak | `auto` |
| `BOT_PAIRING_NUMBER` | Untuk pairing | — |
| `BOT_SESSION_ID` | Tidak | `default` |
| `BOT_STORE_PATH` | Tidak | `.auth/state.sqlite` |
| `BOT_LOG_LEVEL` | Tidak | `info` |
| `NODE_ENV` | Tidak | `development` |

## Struktur

```text
app/        Entry point dan dependency wiring
lib/        Runtime bersama, kontrak, routing, media, dan storage
plugins/    Command; implementasi khusus command tetap di file plugin
scripts/    Script build dan validasi
 tests/     Unit, integration, dan e2e
```

`lib/` tidak mengimpor plugin konkret. Helper khusus satu command berada di plugin pemiliknya; `lib/` berisi kemampuan yang dipakai lintas command atau runtime.

## Menulis plugin

```ts
import type { Command } from '../../lib/commands/command.js'

const hello = {
  name: 'hello',
  category: 'tools',
  description: 'Menyapa pengirim.',
  async run(context) {
    await context.reply(`Halo, ${context.pushName ?? 'kawan'}!`)
  },
} satisfies Command

export default hello
```

## Pengembangan

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run check
```

## Privasi layanan pihak ketiga

- `qrcode` mengirim teks ke QuickChart.
- `ssweb` mengirim URL target ke thum.io.
- `hd` mengunggah gambar ke iloveimg.

Jangan gunakan ketiga command tersebut untuk data rahasia. Detail batas keamanan ada di [docs/SECURITY.md](docs/SECURITY.md).

## Lisensi

MIT — lihat [LICENSE](LICENSE).

Proyek ini tidak berafiliasi dengan WhatsApp atau Meta. Otomasi akun dapat membawa risiko pembatasan akun.
