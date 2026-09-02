# AGENTS.md — YZF-BotWA

Instruksi bootstrap ini berlaku untuk seluruh repository dan harus dibaca oleh setiap model/agent sebelum bekerja.

## Mandatory startup

1. Baca `AGENTS.md` ini secara penuh; aturan di bawah berlaku tanpa file tambahan.
2. Baca public contract/source/test yang relevan dengan task.
3. Load skill yang cocok sebelum research, coding, debugging, review, dokumentasi, atau deployment.
4. Verifikasi state aktual; jangan mengandalkan chat history atau plan lama bila dapat diperiksa langsung.

Permintaan user terbaru memiliki prioritas tertinggi.

`.agent/` adalah memori kerja lokal maintainer (planning, rules panjang, decision log) dan sengaja tidak dipublikasikan, sehingga tidak ada pada clone. Bila direktori itu ada di working copy, baca `.agent/README.md` lalu ikuti urutan baca yang ditetapkan di sana; bila tidak ada, kontrak publik di `docs/` adalah rujukan yang berlaku.

## Non-negotiable

- Research referensi dan API sebelum implementasi; tulis ulang sesuai arsitektur YZF-BotWA, jangan copy source mentah.
- Coding mengikuti skill yang relevan; production behavior baru wajib TDD RED → GREEN → REFACTOR.
- Debug sampai akar masalah dan output akhir sesuai kebutuhan, bukan berhenti pada test/payload yang terlihat masuk akal.
- Bedakan type/encode/fake-server/ACK/live-render evidence.
- Button harus purpose-driven; input teks/media bukan button kosong; destructive action perlu konfirmasi.
- Dilarang eval/new Function/VM/chat shell/raw source execution, credential leak, atau runtime state dalam Git.
- `.auth/`, `.runtime/`, `.env`, SQLite, QR, pairing code, credential, nomor penuh, dan raw message tidak boleh masuk laporan/dokumen.
- Jangan commit, tag, push, publish, atau mengubah pairing identity tanpa perintah user eksplisit.

Kontrak yang mengikat perubahan kode ada di `docs/COMMAND_SPEC.md`, `docs/ARCHITECTURE.md`, `docs/TESTING.md`, dan `docs/SECURITY.md`. Tidak boleh menyatakan selesai sebelum acceptance criteria dan verifikasi terkait terpenuhi.
