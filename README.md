# Zapo Fun Bot

Base bot WhatsApp untuk fitur hiburan, dibangun dengan Node.js, TypeScript, dan `zapo-js`.

> Status: Task 1–15 selesai. 27 file test, 169 test lulus, termasuk E2E terhadap `@zapo-js/fake-server`.
> Belum pernah dijalankan terhadap akun WhatsApp sungguhan.

## Menjalankan

```bash
npm install
cp .env.example .env   # isi BOT_OWNER_NUMBER
npm run check          # typecheck + lint + test
npm run build
npm start              # QR muncul di terminal, scan dari WhatsApp
```

Hentikan dengan Ctrl+C: `stop()` memanggil `disconnect()`, bukan `logout()`, sehingga device tetap tertaut.

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
- Reconnect dengan exponential backoff.
- Unit test, integration test, dan E2E memakai `@zapo-js/fake-server`.

## Referensi utama

- [Dokumentasi Zapo](https://zapo.to)
- [Repository resmi Zapo](https://github.com/vinikjkkj/zapo)
- [BangsulBotz/zapo-js](https://github.com/bangsulbotz/zapo-js) — referensi konsep loader dan serializer.
- [FionyBot/JH-Zapo](https://github.com/FionyBot/JH-Zapo) — referensi konsep routing, auth, dan fitur.

Ide boleh dipelajari, tetapi source dari dua base referensi tidak disalin mentah. Implementasi dibuat ulang dengan tipe, test, dan struktur proyek ini.
