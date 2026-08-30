# Architecture Decision Log

Keputusan di sini bersifat aktif sampai diganti oleh entri baru. Perubahan keputusan harus memperbarui PRD, arsitektur, plan, dan test yang terdampak.

## D-001 — TypeScript strict

**Status:** Accepted  
**Keputusan:** Seluruh production source ditulis dengan TypeScript strict.  
**Alasan:** `zapo-js` ditulis dengan TypeScript dan menerbitkan declaration resmi; typed events dan content union memberi nilai langsung.  
**Konsekuensi:** Ada build/typecheck, tetapi kontrak message/command lebih aman.

## D-002 — Greenfield reimplementation

**Status:** Accepted  
**Keputusan:** Tidak fork atau merge mentah BangsulBotz/JH-Zapo.  
**Alasan:** Keduanya memberi konsep berguna, tetapi membawa coupling, fitur di luar scope, dan status lisensi source yang perlu kehati-hatian.  
**Konsekuensi:** Biaya awal lebih tinggi; hasil lebih kecil, konsisten, dan teruji.

## D-003 — JH-Zapo sebagai referensi arsitektur, BangsulBotz sebagai referensi loader

**Status:** Accepted  
**Keputusan:** Ambil pola auth/router/context dari JH-Zapo dan pola recursive loader/duplicate detection dari BangsulBotz, lalu desain ulang.  
**Konsekuensi:** Tidak ada kompatibilitas plugin dengan kedua base pada MVP.

## D-004 — Single session + SQLite

**Status:** Accepted  
**Keputusan:** MVP menjalankan satu `WaClient`, satu stable `sessionId`, dan `@zapo-js/store-sqlite`.  
**Alasan:** Target fun bot single-host; ini opsi paling sederhana.  
**Konsekuensi:** Multi-tenant dan multi-host ditunda.

## D-005 — Tidak mengarsipkan pesan

**Status:** Accepted  
**Keputusan:** Provider `messages`, `threads`, dan `contacts` diset `none`.  
**Alasan:** Tidak dibutuhkan command MVP dan mengurangi data sensitif serta I/O.  
**Konsekuensi:** Tidak ada histori/menu berbasis statistik user.

## D-006 — Registry dependency injection

**Status:** Accepted  
**Keputusan:** Registry tidak ditempatkan di `global`; router menerima dependency eksplisit.  
**Alasan:** Lebih mudah diuji dan menghindari shared mutable state tersembunyi.

## D-007 — No hot reload in production

**Status:** Accepted  
**Keputusan:** Hot reload hanya optional pada development dan tidak termasuk MVP pertama.  
**Alasan:** Dynamic import cache dan partial reload menambah failure mode.  
**Konsekuensi:** Penambahan command memerlukan restart pada MVP.

## D-008 — Tidak memakai patch/custom nodes

**Status:** Accepted  
**Keputusan:** Hanya API typed/public Zapo pada MVP.  
**Alasan:** Patch internal rapuh terhadap upgrade.  
**Konsekuensi:** Rich message khusus yang tidak didukung API public ditunda.

## D-009 — Reconnect dimiliki aplikasi

**Status:** Accepted  
**Keputusan:** Connection manager menerapkan bounded exponential backoff dan berhenti pada logout.  
**Alasan:** Zapo tidak auto-reconnect secara desain.  
**Konsekuensi:** Lifecycle harus diuji sebagai state machine.

## D-010 — Vitest + fake server

**Status:** Accepted  
**Keputusan:** Unit/integration memakai Vitest; E2E memakai `@zapo-js/fake-server`.  
**Alasan:** Pipeline dapat diuji tanpa akun WhatsApp dan tanpa network live.

## D-011 — Exact dependency intent + lockfile

**Status:** Accepted  
**Keputusan:** Tidak menulis `latest`; gunakan range yang disengaja dan commit `package-lock.json`.  
**Alasan:** Reproducible build dan upgrade yang dapat direview.

## D-014 — Referensi plugin hanya untuk ide fitur

**Status:** Accepted  
**Keputusan:** `hamm-r/anya-MD-v3` (425 plugin) dan `AgusXzz/ChiiMD` (96 plugin) dipakai sebagai sumber inspirasi daftar fitur dan bentuk pesan, bukan sumber kode.  
**Alasan:** Keduanya Baileys, menyimpan state game pada object socket, memuat `exec`/`writeFileSync`/API key literal serta artefak secret ter-commit, dan tidak menyertakan file LICENSE meski `package.json` menyebut MIT/ISC.  
**Konsekuensi:** Survei dan roadmap fase 2–4 ada di `docs/PLUGIN_SURVEY.md`; downloader, AI wrapper, RPG penuh, dan panel management berada di luar scope.

## D-013 — Creative rich message ditunda ke Phase 2

**Status:** Accepted  
**Keputusan:** Command bergaya bot-forwarded AI rich response (HTML primitive) tidak masuk MVP; ditulis sebagai Phase 2 dengan feature flag owner-only.  
**Alasan:** Encoding sudah dibuktikan didukung `proto` Zapo 1.8.2, tetapi rendering client, penerimaan server, dan risiko akun belum terverifikasi.  
**Konsekuensi:** Detail teknis dan batasannya berada di `docs/CREATIVE_MESSAGES.md`; D-008 tetap berlaku karena implementasinya memakai raw `Proto.IMessage` publik, bukan patch internal.

## D-012 — Unknown command diabaikan

**Status:** Accepted  
**Keputusan:** Router tidak membalas command tidak dikenal pada MVP.  
**Alasan:** Mengurangi spam grup. Menu menjadi jalur discovery resmi.
