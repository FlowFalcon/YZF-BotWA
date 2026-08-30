# AGENTS.md — Zapo Fun Bot

Instruksi ini berlaku untuk seluruh repository. Dokumen produk dan arsitektur lebih spesifik daripada preferensi agent; jika terjadi konflik, urutan sumber kebenaran adalah:

1. Permintaan user saat ini.
2. `docs/PRD.md`.
3. `docs/ARCHITECTURE.md` dan `docs/COMMAND_SPEC.md`.
4. `docs/SECURITY.md` dan `docs/TESTING.md`.
5. `docs/DECISIONS.md`.
6. Implementation plan aktif di `.hermes/plans/`.
7. Konvensi source yang sudah ada.

## Sebelum mengubah kode

1. Baca PRD, arsitektur, command spec, testing, security, dan decision log.
2. Baca file target, caller, test terkait, `package.json`, `tsconfig.json`, dan lint config.
3. Cek dokumentasi resmi Zapo untuk API yang disentuh: <https://zapo.to/llms.txt>.
4. Cocokkan contoh docs dengan type declaration versi `zapo-js` yang terpasang.
5. Jangan menyalin source BangsulBotz atau JH-Zapo. Implementasikan behavior dari kontrak proyek ini.

## Aturan implementasi

- Gunakan Node.js >= 20.9.0, ESM, dan TypeScript strict.
- Tulis perubahan terkecil yang memenuhi acceptance criteria.
- Jangan menambahkan abstraction, config, dependency, atau fitur spekulatif.
- Jangan memakai `global`, `any` tanpa alasan lokal, blanket catch, atau silent catch.
- Jangan memakai `eval`, shell execution, remote plugin install, dynamic dependency patch, atau `dangerous.*` Zapo.
- Jangan log raw message, body, nomor penuh, QR, pairing code, atau credential.
- Jangan mengaktifkan message/thread/contact archive pada MVP.
- Jangan memakai API internal/custom node selama D-008 aktif.
- Core tidak boleh mengimpor feature tertentu.
- Feature berinteraksi melalui `CommandContext` dan service contract yang diperlukan.
- Named export untuk core; default export hanya diperbolehkan untuk module command yang dimuat loader.
- Komentar menjelaskan alasan/non-obvious constraint, bukan menceritakan baris berikutnya.

## TDD wajib

Tidak ada production behavior baru tanpa failing test lebih dahulu.

1. Tulis satu test behavior.
2. Jalankan test spesifik dan verifikasi failure yang benar.
3. Tulis implementasi minimum.
4. Jalankan test spesifik sampai hijau.
5. Jalankan suite terkait.
6. Refactor hanya setelah hijau.
7. Jalankan `npm run check` sebelum menyatakan selesai.

Bug fix harus dimulai dari test yang mereproduksi bug.

## Verification

Perintah target setelah scaffold:

```bash
npm run typecheck
npm run lint
npm test
npm run check
```

Untuk perubahan lifecycle/protocol, tambahkan integration atau E2E dengan `@zapo-js/fake-server`. Jangan mengklaim live WhatsApp sudah diuji kecuali pairing dan behavior benar-benar dijalankan pada akun test.

## Dependency policy

- Periksa dependency yang sudah ada sebelum menambah baru.
- Jangan menggunakan `latest` di manifest.
- Commit lockfile.
- Major upgrade Zapo memerlukan changelog review, typecheck, full tests, dan E2E.
- Hindari dependency untuk utilitas kecil yang dapat ditulis jelas dengan standard library.

## Git dan scope

- Satu commit untuk satu perubahan koheren.
- Jangan mencampur refactor tidak terkait.
- Jangan commit `.auth/`, SQLite, `.env`, log, coverage output, QR image, atau media sementara.
- Jangan mengubah keputusan arsitektur diam-diam. Tambah/update decision entry dan dokumen terdampak.

## Definition of done

Sebuah task selesai hanya jika:

- acceptance criteria yang terkait terpenuhi;
- test pernah gagal sebelum implementasi dan sekarang lulus;
- typecheck, lint, dan test relevan lulus;
- tidak ada secret/data sensitif dalam diff;
- dokumentasi diperbarui bila behavior/contract berubah;
- hasil verifikasi dilaporkan apa adanya, termasuk bagian yang belum diuji.
