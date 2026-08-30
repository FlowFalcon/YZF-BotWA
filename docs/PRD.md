# Product Requirements Document — Zapo Fun Bot

**Status:** Draft siap implementasi  
**Versi:** 0.1  
**Working title:** Zapo Fun Bot  
**Platform:** WhatsApp companion device  
**Runtime:** Node.js >= 20.9.0, TypeScript, `zapo-js`

## 1. Ringkasan

Zapo Fun Bot adalah base bot WhatsApp modular untuk command hiburan. Produk harus mudah ditambah fiturnya tanpa mengubah core, tetap stabil saat satu command gagal, dan dapat diuji tanpa akun WhatsApp melalui `@zapo-js/fake-server`.

Produk mengambil pelajaran arsitektur dari dua base referensi, tetapi implementasinya baru. JH-Zapo menjadi referensi pemisahan auth/router/context, sedangkan BangsulBotz menjadi referensi loader, alias, dan isolasi plugin.

## 2. Masalah

Base bot yang ada memenuhi sebagian kebutuhan, tetapi masih plain JavaScript, tidak memiliki test otomatis yang terlihat, mencampur tanggung jawab, memakai global state atau fitur berisiko, dan membawa fitur di luar kebutuhan MVP. Mengembangkan salah satunya secara langsung akan mewariskan technical debt yang tidak perlu.

## 3. Tujuan

1. Menyediakan base TypeScript yang kecil, jelas, dan type-safe.
2. Membuat command baru cukup dengan menambah satu modul feature dan test-nya.
3. Menjaga event WhatsApp, identitas PN/LID, permission, cooldown, dan error handling tetap konsisten.
4. Mempertahankan session saat proses restart.
5. Menyediakan verifikasi otomatis dari unit hingga E2E tanpa akun production.

## 4. Non-goals MVP

- Multi-account atau multi-tenant.
- Dashboard web.
- RPG, economy, inventory, quest, atau database user permanen.
- Moderasi grup lengkap.
- Penyimpanan arsip pesan, thread, atau kontak.
- Hot reload di production.
- AI chatbot.
- Broadcast massal.
- Custom protocol node, monkey patch dependency, atau opsi `dangerous.*` Zapo.
- Eksekusi kode dari chat (`eval`, shell, dynamic install, file write).

## 5. Pengguna

### Owner

Menjalankan bot, melakukan pairing, memantau log, dan menambah command.

### User WhatsApp

Menggunakan command hiburan melalui private chat atau grup.

### Contributor/agent

Menambah fitur melalui kontrak command yang terdokumentasi dan test-first.

## 6. User stories

- Sebagai owner, saya dapat pairing melalui QR atau pairing code.
- Sebagai owner, saya dapat restart bot tanpa pairing ulang.
- Sebagai user, saya dapat melihat command yang tersedia lewat `menu`.
- Sebagai user, saya dapat menjalankan command fun dan menerima respons yang jelas.
- Sebagai user, saya mendapat pemberitahuan ketika command masih cooldown.
- Sebagai contributor, saya dapat menambah command tanpa mengubah router utama.
- Sebagai maintainer, saya dapat menjalankan test bot tanpa terhubung ke WhatsApp production.

## 7. Kebutuhan fungsional

### FR-1 — Bootstrap dan konfigurasi

- Konfigurasi berasal dari environment variables dan default aman.
- Konfigurasi divalidasi satu kali saat startup.
- Startup gagal dengan pesan spesifik jika konfigurasi wajib tidak valid.
- Prefix mendukung satu atau beberapa string nonkosong; default `.`.
- Identitas owner dinormalisasi dari digit, tanpa menyimpan secret dalam source.

### FR-2 — Store dan session

- Session memakai SQLite melalui `@zapo-js/store-sqlite`.
- `sessionId` stabil; default `default`.
- Domain `auth`, `signal`, `preKey`, `session`, `identity`, `senderKey`, `appState`, dan `privacyToken` persisten.
- Domain arsip `messages`, `threads`, dan `contacts` diset `none` pada MVP.
- Folder session tidak boleh masuk Git.

### FR-3 — Autentikasi

- Mode `qr`, `pairing`, dan `auto` didukung.
- QR terbaru ditampilkan saat event `auth_qr` terbit.
- Pairing code hanya diminta setelah koneksi aktif dan event pairing membutuhkan input.
- Pairing number harus digit dengan country code.
- Event `auth_paired` dicatat tanpa membocorkan credential.
- Passkey-required dilaporkan sebagai kondisi yang memerlukan autentikator; tidak dibuat bypass.

### FR-4 — Lifecycle koneksi

- Bot memanggil `connect()` satu kali saat startup.
- Pada disconnect transient, bot reconnect dengan exponential backoff terbatas.
- Pada logout/fatal auth, bot berhenti reconnect dan meminta pairing ulang.
- Koneksi sukses mereset backoff.
- `SIGINT` dan `SIGTERM` memanggil `disconnect()`, bukan `logout()`.
- Listener tidak boleh terpasang ganda setelah reconnect.

### FR-5 — Normalisasi pesan dan identitas

- Event `message` dengan `key.fromMe === true` diabaikan untuk routing command.
- Text umum diekstrak dari conversation, extended text, serta caption image/video.
- Context menyimpan chat JID, sender primary, sender alternate, PN, LID, nama, tipe chat, event asli, dan target reply.
- Di grup, reply selalu dikirim ke `event.key.remoteJid`.
- Jika tersedia, identitas LID dipertahankan sebagai identitas utama yang privacy-preserving.
- Parser tidak menganggap newsletter/broadcast sebagai chat command biasa.

### FR-6 — Command registry dan loader

- Command memiliki `name`, `aliases`, `category`, `description`, optional permission/cooldown, dan `run(ctx)`.
- Nama dan alias dinormalisasi lowercase.
- Nama/alias duplikat menggagalkan startup atau reload secara eksplisit; tidak menggunakan first-wins diam-diam.
- Loader hanya memuat file command dari direktori yang ditentukan.
- Registry tidak disimpan di `global`.
- Core menerima registry melalui dependency injection.
- Kegagalan satu command saat runtime tidak mematikan client.

### FR-7 — Parsing dan middleware

Urutan pipeline wajib:

1. filter event;
2. normalisasi message/context;
3. parse prefix, command, dan args;
4. lookup registry;
5. permission;
6. flood protection;
7. cooldown;
8. execute;
9. centralized error handling.

- Whitespace awal setelah prefix ditangani konsisten.
- Command bersifat case-insensitive.
- Args mempertahankan urutan dan dipecah berdasarkan whitespace.
- Cooldown hanya dicatat setelah permission lolos.
- Unknown command diabaikan pada MVP agar tidak spam.

### FR-8 — Command MVP

| Command | Alias | Perilaku |
|---|---|---|
| `menu` | `help` | Menampilkan command berdasarkan kategori dan prefix aktif. |
| `ping` | `p` | Menampilkan bahwa bot aktif dan latency pemrosesan. |
| `dice` | `dadu` | Menghasilkan bilangan bulat 1–6. |
| `coinflip` | `coin`, `koin` | Menghasilkan `head` atau `tail` dengan representasi lokal. |
| `eightball` | `8ball` | Menjawab pertanyaan dengan salah satu respons tetap. |
| `rate` | `nilai` | Memberi nilai deterministik 0–100 untuk input yang sama pada hari yang sama. |

Ketentuan:

- `eightball` menolak input kosong dengan usage singkat.
- `rate` menolak input kosong.
- Randomness dapat di-inject agar unit test deterministik.
- Command tidak menyimpan profil atau histori user.

### FR-9 — Logging dan observability

- Logger terstruktur dipakai melalui satu interface.
- Production menggunakan JSON; development boleh pretty-print.
- Log mencatat lifecycle, command, durasi, dan error.
- Log tidak mencetak credential, QR payload, pairing secret setelah ditampilkan, isi pesan penuh, atau raw event secara default.
- Error memiliki correlation fields seperti command, chat kind, dan message ID tanpa memuat body.

## 8. Kebutuhan nonfungsional

### NFR-1 — Type safety

- TypeScript `strict` aktif.
- Production source tidak memakai `any` tanpa justifikasi lokal.
- Tidak ada default export untuk core; command boleh default export agar loader sederhana.

### NFR-2 — Reliability

- Satu command gagal tidak mematikan event loop.
- Tidak ada unbounded in-memory map; cooldown/flood state memiliki cleanup atau TTL.
- Tidak ada promise rejection yang sengaja diabaikan tanpa alasan dan observability.

### NFR-3 — Maintainability

- Core tidak bergantung pada feature tertentu.
- Feature tidak mengakses store protocol secara langsung kecuali kebutuhannya terdokumentasi.
- Tidak ada wrapper yang hanya meneruskan argumen tanpa memberi kontrak atau nilai tambahan.

### NFR-4 — Performance

- Jalur pesan tidak menulis raw message ke database.
- Loader tidak berjalan per pesan.
- Group metadata tidak diambil kecuali command membutuhkannya.

### NFR-5 — Compatibility

- Node.js minimum mengikuti requirement Zapo: `>=20.9.0`.
- Versi dependency dikunci melalui lockfile.
- Upgrade major Zapo harus membaca changelog dan menjalankan seluruh suite.

## 9. Acceptance criteria MVP

- [ ] Fresh install dapat typecheck, lint, dan menjalankan unit test.
- [ ] QR flow dapat mencapai `auth_paired` pada smoke test manual.
- [ ] Pairing-code flow dapat mencapai `auth_paired` pada smoke test manual.
- [ ] Restart menggunakan session SQLite yang sama tanpa pairing ulang.
- [ ] Disconnect transient menjalankan backoff tanpa listener ganda.
- [ ] Logout tidak memicu reconnect loop.
- [ ] Keenam command MVP terdaftar dan berfungsi.
- [ ] Duplicate command/alias ditolak dengan error yang menyebut kedua sumber.
- [ ] Permission dan cooldown diuji secara otomatis.
- [ ] PN/LID mapping diuji untuk private dan group events.
- [ ] E2E fake server membuktikan pesan inbound menghasilkan reply outbound.
- [ ] `npm run check` dan `npm test` lulus tanpa warning/error proyek.
- [ ] Tidak ada credential/session/raw message di Git.

## 10. Release MVP

MVP dinyatakan selesai hanya setelah acceptance criteria terpenuhi dan live smoke test dilakukan pada akun test, bukan akun utama. Pengujian live memverifikasi pairing, restart, private command, group command, dan shutdown; hasilnya dicatat tanpa menyimpan QR atau credential.

## 11. Risiko

- Perubahan protokol WhatsApp dapat menyebabkan disconnect atau pairing failure.
- Akun dapat terkena pembatasan platform jika digunakan untuk spam/automation agresif.
- Bentuk interactive message dapat berubah.
- Alt identity PN/LID tidak selalu tersedia.
- Pairing dapat memerlukan passkey pada akun tertentu.

Mitigasi berada di arsitektur reconnect, penggunaan API typed resmi, rate limit, fake-server test, lockfile, dan upgrade dependency yang disengaja.
