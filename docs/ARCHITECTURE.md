# Architecture — YZF-BotWA

> **Status:** Menjelaskan struktur yang berjalan pada `v0.0.1`: `app/` bootstrap, `lib/` runtime internal, `plugins/` surface fitur.

## 1. Prinsip

1. **Greenfield, bukan merge source.** Konsep baik dipelajari; implementasi ditulis ulang.
2. **Dependency mengarah ke dalam.** Feature bergantung pada contract, bukan detail Zapo/store.
3. **Typed boundary.** Raw `WaIncomingMessageEvent` dinormalisasi sekali menjadi `CommandContext`.
4. **Explicit lifecycle.** Connect, reconnect, auth, dan shutdown memiliki satu owner.
5. **Fail closed untuk registry/config.** Duplikat atau config invalid menghentikan startup.
6. **Fail isolated untuk command.** Error feature dicatat dan dibalas tanpa mematikan bot.
7. **YAGNI.** Single session dan mode akses tunggal tanpa kombinasi boolean kontradiktif.

## 2. Struktur aktif

```text
YZF-BotWA/
├── app/
│   └── index.ts
├── lib/
│   ├── app.ts
│   ├── config.ts
│   ├── settings.ts
│   ├── access/
│   ├── auth/
│   ├── client/
│   ├── commands/
│   ├── games/
│   ├── media/
│   ├── messages/
│   ├── profile/
│   └── shared/
├── plugins/
│   ├── tools/
│   ├── sticker/
│   ├── games/
│   └── owner/
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── fixtures/
├── docs/
├── .auth/      # runtime, gitignored
├── .runtime/   # runtime, gitignored
├── AGENTS.md
└── package.json
```

`plugins/` adalah surface fitur; nama subfolder selalu sama dengan `category` command di dalamnya (D-020). `app/index.ts` adalah entry point dan signal wiring. Subfolder `lib/` dibagi per tanggung jawab: `access` (mode/allowlist), `auth` (QR/pairing), `client` (koneksi dan store), `commands` (kontrak, loader, registry, middleware), `games` (aset HTML), `media` (ffmpeg dan tipe media), `messages` (router, context, builder presentasi), `profile` (branding), `shared` (clock/random).

## 3. Komponen

### App composition root

`lib/app.ts` membuat dependency dan memasangnya: config, logger, store, client, registry, middleware, router, auth controller, dan connection manager. Tidak ada business logic di composition root.

`app/index.ts` membaca environment, membuat adapter produksi, memasang shutdown hook, dan menentukan exit code.

### Client/store

`createStore` memakai SQLite untuk domain protokol yang wajib persisten. Arsip pesan/thread/kontak diset `none`. `WaClient` dibangun satu kali per app instance dengan `sessionId` stabil.

`connection-manager.ts` menjadi satu-satunya komponen yang memanggil `connect()` ulang. Reconnect menggunakan bounded exponential backoff dan tidak berjalan bila `isLogout` atau shutdown sedang berlangsung.

### Auth controller

Auth controller memasang listener sebelum connect. QR renderer dan pairing requester adalah adapter terpisah agar dapat diuji. Credential tidak pernah keluar dari boundary Zapo/store.

### Message normalization

Raw event diproses menjadi context immutable sejauh mungkin. Context menyimpan event asli hanya untuk quote/reaction/receipt, bukan untuk diparsing ulang oleh feature.

Identitas:

- group sender: `participant`, alternate `participantAlt`;
- private sender: `remoteJid`, alternate `remoteJidAlt`;
- LID dipertahankan bila tersedia;
- PN digunakan untuk konfigurasi owner ketika tersedia;
- group reply target selalu `remoteJid`.

### Command registry

Registry memiliki satu record per canonical command dan index trigger → canonical command. Registrasi bersifat atomic: semua command divalidasi dahulu, baru registry dipublikasikan. Duplikat command/alias menghasilkan error eksplisit.

Registry tidak global. Router menerima `CommandRegistry` melalui constructor/function argument.

Reload memvalidasi source trusted `.ts`, mengompilasi candidate, menjalankan import probe child process dengan environment minimal dan timeout, lalu memvalidasi metadata/duplikat. Build diserialisasi dan setiap hasil valid dipublikasikan sebagai generation immutable unik di `.runtime/plugins/<generation>/`; registry lama tetap utuh sampai candidate lengkap. Source Plugin Manager dipromosikan atomik dari `.runtime/plugin-staging/` hanya setelah callback validasi berhasil.

Runtime memantau `plugins/**/*.ts` untuk add/change/unlink. Save burst didebounce 400 ms dan reload
diserialisasi. Loader membangun registry kandidat lengkap sebelum reference aktif ditukar; kegagalan
import, metadata, typecheck, atau duplikat mempertahankan registry lama. Watcher ditutup sebelum
`client.disconnect()`.

### Router dan middleware

```text
WhatsApp message event
  → event filter
  → context factory
  → command parser
  → access mode gate
  → registry lookup
  → permission
  → flood limit
  → command cooldown
  → command.run(ctx)
  → error boundary + structured log
```

Middleware berupa fungsi kecil dengan contract yang sama. Pipeline disusun sekali saat startup, bukan setiap pesan.

### Features

Feature hanya berisi metadata dan behavior command. Feature tidak mengetahui loader, filesystem, auth, reconnect, atau SQLite session. Dependency non-deterministik (`clock`, `random`) tersedia dari context/service agar test stabil.

Profile/branding memakai service kecil yang di-inject saat bootstrap. Service memisahkan mutasi `client.profile` dari aset thumbnail menu, memvalidasi input, mengubah gambar profil menjadi JPEG persegi deterministik, dan menyimpan thumbnail secara atomik di path yang dapat di-inject untuk test.

## 4. Kontrak tingkat tinggi

```ts
export interface Command {
  readonly name: string
  readonly aliases?: readonly string[]
  readonly category: CommandCategory
  readonly description: string
  readonly usage?: string
  readonly permission?: 'everyone' | 'owner'
  readonly cooldownMs?: number
  run(context: CommandContext): Promise<void>
}
```

`CommandCategory` adalah salah satu dari `owner`, `group`, `tools`, `downloader`, `sticker`, `games`. Bentuk lengkap `Command` dan `CommandContext` didefinisikan di `lib/commands/command.ts`; file itu adalah sumber kebenaran, dokumen ini tidak menduplikasinya.

## 5. Aliran startup

1. Parse dan validasi config.
2. Buat logger.
3. Buat folder dan SQLite store.
4. Load serta validasi command registry.
5. Buat `WaClient`.
6. Pasang auth, connection, dan message listeners sekali.
7. Panggil `connect()`.
8. Laporkan status open/pairing.

Jika langkah 1–5 gagal, proses keluar nonzero. Tidak ada startup parsial.

## 6. Reconnection state

State minimal:

```text
idle → connecting → open → waiting-backoff → connecting
                          ↘ logged-out
                          ↘ stopping → stopped
```

Invariant:

- maksimal satu connect attempt aktif;
- timer backoff tunggal;
- event open mereset attempt;
- logout/fatal tidak dijadwalkan ulang;
- shutdown membatalkan timer dan memanggil `disconnect()`;
- listener tidak dibuat ulang saat reconnect.

## 7. Storage

MVP memakai satu SQLite protocol store di `.auth/state.sqlite` dan settings aplikasi di `.auth/settings.json`.

Persisten:

- `auth`
- `signal`
- `preKey`
- `session`
- `identity`
- `senderKey`
- `appState`
- `privacyToken`

Disabled:

- `messages`
- `threads`
- `contacts`

Cooldown/flood state berada di bounded memory dengan expiry. Tidak ada application database pada MVP.

`settings.json` menyimpan satu `BotMode`: `public`, `group-only`, atau `owner-only`. Write memakai temporary file lalu rename atomik. File hilang, korup, atau format lama menghasilkan default aman `owner-only`. Router membaca mode melalui `SettingsView` pada setiap pesan, sebelum registry lookup. Owner tetap dapat menjalankan `.botmode` pada semua mode.

## 8. Error policy

| Area | Kebijakan |
|---|---|
| Config/registry/store startup | Fail fast, exit nonzero. |
| Auth invalid/logout | Stop reconnect, minta pairing ulang. |
| Transient connection | Retry terbatas dengan backoff. |
| Command exception | Log, balas generic error, lanjut event berikutnya. |
| Reply failure | Log sebagai delivery failure; jangan retry tanpa batas. |
| Unknown event/message | Ignore atau debug log tanpa raw payload. |

Tidak ada global `uncaughtException` yang membuat proses terus berjalan dalam state tidak diketahui. Error fatal boleh dicatat lalu proses dihentikan agar supervisor melakukan restart bersih.

## 9. Concurrency

- Event berbeda boleh diproses paralel.
- Satu message event melewati pipeline tunggal.
- Cooldown check-and-set harus atomic dalam satu event-loop turn.
- Command yang lambat tidak boleh memblokir event loop dengan operasi sinkron berat.
- Media besar harus di-stream, bukan dibuffer seluruhnya; belum termasuk MVP.

## 10. Configuration contract

Environment variables yang dibaca `lib/config.ts`:

| Variable | Default | Catatan |
|---|---|---|
| `BOT_PREFIXES` | `.` | Dipisahkan koma. |
| `BOT_OWNER_NUMBER` | — | Wajib; digit dengan country code. Startup gagal bila kosong. |
| `BOT_AUTH_METHOD` | `auto` | `auto`, `qr`, atau `pairing`. |
| `BOT_PAIRING_NUMBER` | kosong | Wajib bila mode pairing noninteraktif. |
| `BOT_SESSION_ID` | `default` | Jangan berubah setelah pairing. |
| `BOT_STORE_PATH` | `.auth/state.sqlite` | Di luar source dan gitignored. |
| `BOT_LOG_LEVEL` | `info` | Level logger. |
| `NODE_ENV` | `development` | Mengontrol format log. |

`menuThumbnailPath` bukan environment variable: nilainya diturunkan dari `BOT_STORE_PATH` menjadi `<dir>/assets/menu-thumbnail.jpg`. Config object bersifat readonly.

## 11. Batas ekstensi

Belum dibuat sebelum ada kebutuhan nyata:

- abstract database repository;
- multi-session manager;
- event bus internal;
- generic plugin SDK terpisah;
- dashboard/API server;
- remote plugin install;
- custom protocol node.

## 12. Sumber kebenaran

API Zapo harus mengikuti dokumentasi resmi dan type declaration versi terpasang. Jika contoh dari base referensi bertentangan dengan tipe atau docs resmi, docs dan tipe Zapo yang menang.
