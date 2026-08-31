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

`.dino` mati secara default. Tiga lapis, semuanya diuji:

1. `BOT_HTML_GAMES=1` — tanpa itu command hanya membalas cara menyalakannya.
2. `permission: 'owner'`.
3. Private chat saja; di grup menolak walau owner.

Alasan lapis ketiga: payload yang tidak dirender akan tampil sebagai pesan rusak
di grup komunitas milik akun kedua user — tepat paparan yang dihindari sejak
D-015.

### Batas yang dipertahankan

Payload sengaja **tanpa** `verificationMetadata`, `certificateChain`, dan
`botJid` (§7). `messageDisclaimerText` dibiarkan kosong, bukan diisi klaim
identitas. Ada test yang gagal bila salah satu field itu muncul.

HTML-nya mandiri: nol request jaringan, nol `<img>`, nol `eval`. Sprite digambar
dengan `fillRect`, bukan data URL, supaya payload jauh di bawah plafon 128 KiB.

`runInNewContext` hanya ada di `tests/support/dino-harness.ts` dan tidak pernah
terjangkau dari pesan. SECURITY.md §2 melarang eksekusi source dari chat; input
harness adalah konstanta milik proyek sendiri.
