# Plugin Survey — anya-MD-v3 dan ChiiMD

Tanggal survei: 30 Agustus 2026  
Tujuan: memilih ide fitur untuk roadmap, bukan menyalin implementasi.  
Kedua repo adalah **Baileys**, bukan Zapo.

## 1. Ukuran nyata

| Metrik | anya-MD-v3 | ChiiMD |
|---|---|---|
| Total file repo | 569 | 119 |
| Plugin `.js` | 425 | 96 |
| Struktur plugin | flat, satu direktori | flat, satu direktori |
| Kategori via `handler.tags` | 26 | 14 |
| Dependency produksi | 64 | 15 |
| `package.json` license | MIT | ISC |
| File LICENSE di repo | **tidak ada** | **tidak ada** |

Keduanya memang punya fitur melimpah. anya jauh lebih besar; Chii lebih ringkas dan lebih mudah dibaca.

## 2. Distribusi kategori

**anya-MD-v3** (jumlah plugin per tag):

`tools` 54, `rpg` 51, `owner` 33, `ai` 30, `game` 30, `downloader` 29, `group` 29, `maker` 25, `fun` 21, `internet` 16, `sticker` 13, `info` 12, `search` 12, `main` 9, `anime` 7, `xp` 7, sisanya kecil.

**ChiiMD**:

`rpg` 23, `owner` 13, `downloader` 8, `fun` 7, `tools` 7, `info` 6, `group` 5, `database` 4, `main` 4, `xp` 4, `game` 2, `internet` 2, `sticker` 2, `ai` 1.

Pola yang terlihat: bobot terbesar ada di RPG/economy, downloader, dan AI — tiga area yang justru paling berat dari sisi maintenance, biaya, dan risiko.

## 3. Bentuk pesan WhatsApp yang dipakai

Hasil grep pada plugin, dipetakan ke ketersediaan di proto `zapo-js@1.8.2` (diverifikasi ada di `spec/proto/index.d.ts`):

| Bentuk | anya | Chii | Ada di proto Zapo |
|---|---|---|---|
| `relayMessage` (API Baileys) | 22 file | 0 | Tidak — gunakan `client.message.send` |
| `interactiveMessage` | 3 | 0 | Ya |
| `nativeFlowMessage` | 3 | 0 | Ya |
| `externalAdReply` | 4 | 0 | Ya |
| `albumMessage` | 0 | 2 | Ya |
| `botForwardedMessage` | 1 | 0 | Ya |
| `richResponseMessage` | 1 | 0 | Ya |
| `productMessage` | — | — | Ya |
| `paymentInviteMessage` | — | — | Ya |
| `stickerPackMessage` | — | — | Ya |
| `scheduledCallCreationMessage` | — | — | Ya |
| `ptvMessage` | — | — | Ya |
| `eventMessage` / `pollCreationMessageV3` | — | — | Ya |
| `groupInviteMessage` | — | — | Ya |

Kesimpulan: **hampir semua bentuk pesan kreatif yang dipakai kedua repo tersedia di Zapo.** Hambatannya bukan protokol, melainkan API wrapper Baileys.

`botForwardedMessage` + `richResponseMessage` di anya berada di `info-stats.js` — sumber yang sama dengan sample dino game yang dikirim user, dan sudah dibuktikan encode/decode di `docs/CREATIVE_MESSAGES.md`.

## 4. Biaya porting: bukan pesan, tapi helper

Grep `conn.*` pada seluruh plugin kedua repo:

| Pemakaian | Jumlah | Status di Zapo |
|---|---|---|
| `conn.reply` | 465 | Perlu helper sendiri; `CommandContext.reply` sudah setara |
| `conn.sendMessage` | 303 | `client.message.send` |
| `conn.sendFile` | 81 | Perlu helper media; Zapo punya typed media builder |
| `conn.user` | 50 | Ada padanan |
| `conn.getName` | 32 | Perlu helper sendiri |
| `conn.relayMessage` | 25 | Tidak ada; pakai raw `Proto.IMessage` |
| `conn.waUploadToServer` | 11 | Ditangani media builder Zapo |
| `conn.parseMention` | 10 | Trivial, tulis sendiri |
| `conn.game`, `conn.tebakbuah`, `conn.caklontong`, `conn.hangman`, `conn.casino`, `conn.bomb`, `conn.suit`, dst | ~150 gabungan | **State game ditempel ke object socket** |

Temuan penting: kedua base menyimpan state game langsung pada instance `conn`. Itu shared mutable state pada object koneksi — persis pola yang ditolak `docs/ARCHITECTURE.md` dan `D-006`. Port apa pun harus memindahkan state ini ke store terpisah.

Artinya: **menyalin satu plugin bukan pekerjaan satu file.** Rata-rata plugin bergantung pada 3–5 helper `conn.*` yang tidak ada di Zapo.

## 5. Masalah yang jangan ikut dibawa

Semua temuan di bawah berasal dari file nyata di repo tersebut.

### Keamanan dan operasional

- `child_process` / `exec`: 23 file di anya, 3 di Chii. Termasuk `owner-exec2.js`.
- `writeFileSync` / `unlinkSync` ke path lokal: 35 file di anya, 2 di Chii.
- API key literal di source: 3 file di anya (`down-gdrive.js`, `maker-iqc2.js`, `skiplink.js`).
- Artefak sensitif ter-commit di anya: `cookies.txt`, `tokens_1787057592429.txt`, `tokens_1787057624055.txt`.
- Sampah build ter-commit di anya: `smeme_*.jpeg`, `tmp_*.jpg`, `test_*.html`, `test.js`.

### Dependency

- anya: 64 dependency produksi, termasuk fork Baileys pihak ketiga (`@itsliaaa/baileys`) dan beberapa scraper.
- Chii: `baileys` dipin sebagai `"latest"` — melanggar `D-011`.
- Scraper downloader rapuh secara struktural: rusak ketika situs sumber berubah.

### Lisensi

`package.json` menyebut MIT (anya) dan ISC (Chii), tetapi **tidak ada file LICENSE** di kedua repo. Status hak pakai source-nya karena itu tidak jelas.

Konsekuensi: **ambil ide dan daftar fitur, jangan salin kode.** Ini memperkuat `D-002`.

## 6. Rekomendasi roadmap

Urutan berdasarkan rasio nilai terhadap risiko, mengasumsikan MVP sudah hijau.

### Phase 2 — murah, aman, cocok untuk bot fun

Semua ini memakai typed builder atau raw proto yang sudah tersedia:

1. Sticker maker dari gambar/video (Zapo punya typed `sticker` builder).
2. `toimg` dan `tovn`.
3. Poll (`type: 'poll'`).
4. Reaction otomatis pada command tertentu.
5. Quote/mention helper.
6. Game teks tanpa state persisten: `suit`, `tebak angka`, `math`.

### Phase 3 — perlu desain state

7. Game tebak-tebakan dengan sesi per chat. Wajib punya store sendiri, bukan ditempel ke client.
8. XP/level ringan, kalau memang diinginkan. Ini menambah application database yang sengaja dihindari MVP (`D-005`).
9. `albumMessage` untuk kirim beberapa media sekaligus.

### Phase 4 — eksperimental, owner-only, feature flag

10. `interactiveMessage` + `nativeFlowMessage` (quick reply, list).
11. `externalAdReply` untuk kartu link.
12. Creative rich message bergaya `botForwardedMessage` (`D-013`, lihat `docs/CREATIVE_MESSAGES.md`).

### Tidak direkomendasikan

- Downloader sosial media: rawan, sering rusak, dan berpotensi bermasalah dari sisi hak konten.
- AI wrapper dengan API key: butuh biaya, secret management, dan rate limit; di luar scope bot fun.
- RPG/economy penuh: 51 plugin di anya adalah komitmen maintenance jangka panjang.
- `exec`, `eval`, dan file manager dari chat: dilarang oleh `docs/SECURITY.md`.
- Panel/hosting management: di luar scope.

## 7. Cara memakai kedua repo ini

Boleh dilakukan:

- membaca daftar command untuk inspirasi fitur;
- mempelajari bentuk payload WhatsApp yang mereka pakai;
- mencatat UX pesan dan struktur menu.

Tidak dilakukan:

- menyalin file plugin;
- menyalin helper `conn.*`;
- meniru state game di object socket;
- membawa dependency scraper;
- menyalin API key, cookie, atau token.

Setiap fitur yang diadopsi harus melewati contract `docs/COMMAND_SPEC.md` dan TDD `docs/TESTING.md`.

## 8. Referensi

- <https://github.com/hamm-r/anya-MD-v3>
- <https://github.com/AgusXzz/ChiiMD>
- Raw proto sends: <https://zapo.to/en/guides/raw-sends>
- Message types: <https://zapo.to/en/reference/message-types>
