## Command `.raw`

Mengirim payload `Proto.IMessage` mentah yang ditempel ke chat. Dipakai untuk
mencoba bentuk pesan baru tanpa menulis fitur lebih dulu.

### Kenapa parse, bukan eval

`SECURITY.md` §2 melarang eksekusi source dari pesan. Larangan itu tidak
menghalangi apa pun di sini: payload yang jadi alasan command ini ada
(`interactiveMessage`, `botForwardedMessage`, `locationMessage`) semuanya **data
murni** — nol logika, nol fungsi. `JSON.parse` mencapai tujuan penuh tanpa
memberi jalur eksekusi ke server.

Kode dari internet yang dijalankan sebagai JavaScript akan punya hak penuh
proses bot, termasuk baca `.auth/state.sqlite` yang berisi kredensial sesi
WhatsApp. Satu baris `require('fs')` di tengah payload 800 baris CSS sudah cukup,
dan tidak akan terlihat saat menempel.

### Field bytes

Protobuf punya tipe `bytes`; JSON tidak. Field seperti `unifiedResponse.data`,
`signature`, `certificateChain` ditulis:

```json
{"unifiedResponse":{"data":{"__bytes":"eyJhIjoxfQ=="}}}
```

`{"__bytes":"<base64>"}` didekode jadi `Uint8Array`. Menulis base64 sebagai
string biasa akan ter-encode dua kali di wire dan klien menolaknya.

### Gate

1. `BOT_RAW_SEND=1` — default mati.
2. `permission: 'owner'`.
3. Cap 128 KiB, kedalaman maks 24 tingkat.
4. Kunci `__proto__` / `constructor` / `prototype` ditolak di kedalaman apa pun.

### Yang tidak dilakukan

Payload **tidak pernah** dikirim balik ke chat, hanya nama field teratas. Pesan
error zapo juga tidak diteruskan ke chat — bisa membawa detail protokol; router
yang mencatatnya.

### Terverifikasi

`tests/integration/raw-proto.test.ts` mem-parse payload lalu meng-encode dengan
protobuf zapo asli: `locationMessage`, `interactiveMessage` + `cta_url`, field
`__bytes` (byte hasil decode identik, tanpa lapisan base64 ekstra), dan bentuk
HTML primitive lengkap yang user tempelkan.

Enam mutasi dijalankan untuk membuktikan test mengikat: hapus cek kunci
terlarang, hapus cap ukuran, `__bytes` mengembalikan string, hapus batas
kedalaman, echo payload ke chat, hapus gate flag — semuanya gagal, lalu hijau
lagi setelah restore.
