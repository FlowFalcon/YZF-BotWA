# Architecture — Zapo Fun Bot

## 1. Prinsip

1. **Greenfield, bukan merge source.** Konsep baik dipelajari; implementasi ditulis ulang.
2. **Dependency mengarah ke dalam.** Feature bergantung pada contract, bukan detail Zapo/store.
3. **Typed boundary.** Raw `WaIncomingMessageEvent` dinormalisasi sekali menjadi `CommandContext`.
4. **Explicit lifecycle.** Connect, reconnect, auth, dan shutdown memiliki satu owner.
5. **Fail closed untuk registry/config.** Duplikat atau config invalid menghentikan startup.
6. **Fail isolated untuk command.** Error feature dicatat dan dibalas tanpa mematikan bot.
7. **YAGNI.** Single session, SQLite, dan enam command dahulu.

## 2. Struktur target

```text
zapo-fun-bot/
├── src/
│   ├── index.ts
│   ├── app.ts
│   ├── config.ts
│   ├── client/
│   │   ├── create-client.ts
│   │   ├── store.ts
│   │   └── connection-manager.ts
│   ├── auth/
│   │   ├── auth-controller.ts
│   │   ├── qr.ts
│   │   └── pairing.ts
│   ├── messages/
│   │   ├── extract-text.ts
│   │   ├── identity.ts
│   │   ├── context.ts
│   │   └── router.ts
│   ├── commands/
│   │   ├── command.ts
│   │   ├── registry.ts
│   │   ├── loader.ts
│   │   ├── parser.ts
│   │   └── middleware/
│   │       ├── permission.ts
│   │       ├── flood.ts
│   │       ├── cooldown.ts
│   │       └── error-boundary.ts
│   ├── features/
│   │   ├── general/
│   │   │   ├── menu.ts
│   │   │   └── ping.ts
│   │   └── fun/
│   │       ├── dice.ts
│   │       ├── coinflip.ts
│   │       ├── eightball.ts
│   │       └── rate.ts
│   └── shared/
│       ├── clock.ts
│       ├── random.ts
│       └── logger.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── fixtures/
├── docs/
├── .auth/
├── AGENTS.md
└── package.json
```

## 3. Komponen

### App composition root

`src/app.ts` membuat dependency dan memasangnya: config, logger, store, client, registry, middleware, router, auth controller, dan connection manager. Tidak ada business logic di composition root.

`src/index.ts` hanya memanggil bootstrap, memasang shutdown hook, dan menentukan exit code.

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

### Router dan middleware

```text
WhatsApp message event
  → event filter
  → context factory
  → command parser
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

## 4. Kontrak tingkat tinggi

```ts
export interface Command {
  readonly name: string
  readonly aliases?: readonly string[]
  readonly category: 'general' | 'fun'
  readonly description: string
  readonly usage?: string
  readonly permission?: 'everyone' | 'owner'
  readonly cooldownMs?: number
  run(context: CommandContext): Promise<void>
}

export interface CommandContext {
  readonly event: WaIncomingMessageEvent
  readonly chatJid: string
  readonly senderJid: string
  readonly senderAltJid?: string
  readonly senderPnJid?: string
  readonly senderLidJid?: string
  readonly senderNumber?: string
  readonly pushName?: string
  readonly isGroup: boolean
  readonly isOwner: boolean
  readonly prefix: string
  readonly commandName: string
  readonly args: readonly string[]
  readonly text: string
  readonly receivedAtMs: number
  reply(content: string): Promise<void>
  react(emoji: string): Promise<void>
}
```

Tipe final harus menggunakan tipe export aktual `zapo-js` dan dibuktikan dengan `tsc`; contoh ini adalah kontrak desain, bukan source final.

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

MVP memakai satu SQLite protocol store di `.auth/state.sqlite`.

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

Environment variables yang direncanakan:

| Variable | Default | Catatan |
|---|---|---|
| `BOT_PREFIXES` | `.` | Dipisahkan koma. |
| `BOT_OWNER_NUMBER` | kosong | Digit dengan country code; optional sampai command owner ada. |
| `BOT_AUTH_METHOD` | `auto` | `auto`, `qr`, atau `pairing`. |
| `BOT_PAIRING_NUMBER` | kosong | Wajib bila mode pairing noninteraktif. |
| `BOT_SESSION_ID` | `default` | Jangan berubah setelah pairing. |
| `BOT_STORE_PATH` | `.auth/state.sqlite` | Di luar source dan gitignored. |
| `BOT_LOG_LEVEL` | `info` | Level logger. |
| `NODE_ENV` | `development` | Mengontrol pretty/json log dan hot reload. |

Config object final bersifat readonly.

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
