# Zapo Fun Bot

Base bot WhatsApp untuk fitur hiburan, dibangun dengan Node.js, TypeScript, dan `zapo-js`.

> Status: Task 1–15 selesai plus mode private. 31 file test, 198 test lulus, termasuk E2E terhadap `@zapo-js/fake-server`.
> Belum pernah dijalankan terhadap akun WhatsApp sungguhan.

## Menjalankan

```bash
npm install
cp .env.example .env   # BOT_OWNER_NUMBER wajib diisi
npm run check          # typecheck + lint + test
npm run build
npm start              # QR muncul di terminal, scan dari WhatsApp
```

Hentikan dengan Ctrl+C: `stop()` memanggil `disconnect()`, bukan `logout()`, sehingga device tetap tertaut.

## Mode private

Bot tidak merespons siapa pun kecuali:

- **Private chat:** hanya nomor `BOT_OWNER_NUMBER`. Chat lain diabaikan tanpa balasan.
- **Grup:** hanya grup yang ada di allowlist. Grup lain bungkam total, termasuk untuk owner.

Mendaftarkan grup — jalankan dari dalam grup yang dimaksud, sebagai owner:

```
.access add     # izinkan grup ini
.access del     # cabut izin grup ini
.access list    # daftar grup yang diizinkan (bisa dari mana saja)
```

`.access` adalah satu-satunya command yang jalan di grup non-allowlist, dan hanya untuk owner — tanpa itu grup tidak akan pernah bisa didaftarkan, karena JID grup tidak terlihat dari private chat.

Allowlist disimpan di `allowed-groups.json` di direktori yang sama dengan store (`.auth/` secara default), tidak masuk Git. Penolakan bersifat senyap: bot tidak mengirim pesan error, supaya keberadaannya tidak terkonfirmasi di grup komunitas.

## Dokumen acuan

Urutan baca yang disarankan:

1. [`docs/PRD.md`](docs/PRD.md) — kebutuhan produk dan acceptance criteria.
2. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — struktur sistem dan aliran data.
3. [`docs/COMMAND_SPEC.md`](docs/COMMAND_SPEC.md) — kontrak command, context, dan middleware.
4. [`docs/TESTING.md`](docs/TESTING.md) — strategi TDD dan verifikasi.
5. [`docs/SECURITY.md`](docs/SECURITY.md) — batas keamanan dan praktik operasional.
6. [`docs/DECISIONS.md`](docs/DECISIONS.md) — keputusan arsitektur yang sudah disepakati.
7. [`docs/CREATIVE_MESSAGES.md`](docs/CREATIVE_MESSAGES.md) — rencana Phase 2 untuk rich message kreatif.
8. [`docs/PLUGIN_SURVEY.md`](docs/PLUGIN_SURVEY.md) — survei fitur anya-MD-v3 dan ChiiMD untuk roadmap.
9. [`.hermes/plans/2026-08-30_210345-zapo-fun-bot-foundation.md`](.hermes/plans/2026-08-30_210345-zapo-fun-bot-foundation.md) — urutan implementasi.

Instruksi untuk coding agent berada di [`AGENTS.md`](AGENTS.md). `AGENT.md` disediakan sebagai pointer kompatibilitas.

## Scope MVP

- Satu akun WhatsApp dan satu proses.
- Autentikasi QR atau pairing code.
- Session persisten menggunakan `@zapo-js/store-sqlite`.
- Command modular dengan alias, permission, dan cooldown.
- Command awal: `menu`, `ping`, `dice`, `coinflip`, `eightball`, dan `rate`.
- Mode private: owner-only di private chat, allowlist grup dikelola `.access` (D-015).
- Reconnect dengan exponential backoff.
- Unit test, integration test, dan E2E memakai `@zapo-js/fake-server`.

## Referensi utama

- [Dokumentasi Zapo](https://zapo.to)
- [Repository resmi Zapo](https://github.com/vinikjkkj/zapo)
- [BangsulBotz/zapo-js](https://github.com/bangsulbotz/zapo-js) — referensi konsep loader dan serializer.
- [FionyBot/JH-Zapo](https://github.com/FionyBot/JH-Zapo) — referensi konsep routing, auth, dan fitur.

Ide boleh dipelajari, tetapi source dari dua base referensi tidak disalin mentah. Implementasi dibuat ulang dengan tipe, test, dan struktur proyek ini.
