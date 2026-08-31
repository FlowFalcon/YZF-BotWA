## Fitur game HTML (eksperimen)

`botForwardedMessage` + `richResponseMessage` membawa `unifiedResponse.data`
berisi JSON dengan `sections[].view_model.primitive.__typename =
GenAIaeacdsnwHtmlPrimitive`. Klien WhatsApp diduga memetakan typename itu ke
renderer HTML-nya.

### Status terverifikasi

- `proto.Message.encode`/`decode` round-trip penuh, payload HTML utuh
  (`tests/unit/ai-rich.test.ts`).
- Script game dieksekusi nyata di `node:vm` dengan stub canvas: 400 frame tanpa
  throw, skor naik, lompat mengangkat sprite, tabrakan menutup ronde, restart
  memulihkan state (`tests/integration/dino-logic.test.ts`).

### Belum terverifikasi

- Apakah server Meta menerima stanza ini dari companion device biasa.
- Apakah klien merender primitive-nya. **Nol bukti.**
- Apakah pengiriman berulang memicu pembatasan akun.

### Gate

`.dino` selalu mengirim kartu tombol; payload HTML hanya bonus di atasnya dan
mati secara default.

1. `BOT_HTML_GAMES=1` — tanpa itu payload HTML tidak pernah dikirim.
2. Hanya pada ronde baru (`score === 0`), bukan tiap tick.
3. Grup **boleh**, karena `access-policy` sudah menyaring: hanya grup yang
   di-allowlist owner yang sampai ke command sama sekali.

Alasan poin 3 diubah dari private-only: gate grup di command adalah duplikasi
dari lapisan akses yang sudah ada, dan menghalangi diagnosis — perilaku render
bisa berbeda antara private chat dan grup, jadi kedua jalur perlu bisa diuji.

### Batas yang dipertahankan

Payload sengaja **tanpa** `verificationMetadata`, `certificateChain`, dan
`botJid` (§7). `messageDisclaimerText` dibiarkan kosong, bukan diisi klaim
identitas. Ada test yang gagal bila salah satu field itu muncul.

HTML-nya mandiri: nol request jaringan, nol `<img>`, nol `eval`. Sprite digambar
dengan `fillRect`, bukan data URL, supaya payload jauh di bawah plafon 128 KiB.

`runInNewContext` hanya ada di `tests/support/dino-harness.ts` dan tidak pernah
terjangkau dari pesan. SECURITY.md §2 melarang eksekusi source dari chat; input
harness adalah konstanta milik proyek sendiri.
