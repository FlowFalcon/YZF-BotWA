# Creative Rich Messages — Verified Feasibility

Status: **live-tested via `@zapo-js/mcp-server` on 2026-08-31; transport succeeds, stock WhatsApp clients suppress the AIRich body from a normal account.**  
Target fase: **ditutup untuk game UI; raw transport tetap tersedia untuk eksperimen owner.**

## 1. Ringkasan hasil pemeriksaan

Sample Baileys yang dikirim user (bot-forwarded AI rich response berisi HTML interaktif) **dapat direpresentasikan penuh oleh proto `zapo-js` 1.8.2**. Semua field yang dipakai sample tersedia di schema resmi.

Bukti yang dijalankan pada `zapo-js@1.8.2`:

- `proto.Message.encode(...)` menerima struktur lengkap dan menghasilkan 435 byte.
- `proto.Message.decode(...)` memulihkan seluruh field tanpa kehilangan data.
- `submessages[0].messageText` bertahan.
- `unifiedResponse.data` bertahan dan JSON di dalamnya dapat diparse kembali.
- `contextInfo.forwardedAiBotMessageInfo.botJid` bertahan.
- `verificationMetadata.proofs[0]` mempertahankan `useCase`, `signature`, dan dua entri `certificateChain`.

## 2. Mapping field Baileys → Zapo

| Sample Baileys | Zapo proto | Catatan |
|---|---|---|
| `conn.relayMessage(jid, content, {})` | `client.message.send(jid, content)` | Zapo tidak punya `relayMessage`; raw `Proto.IMessage` adalah API publik yang didokumentasikan. |
| `messageContextInfo.botMetadata` | `proto.MessageContextInfo.botMetadata` | Tersedia. |
| `botMetadata.botResponseId` | `BotMetadata.botResponseId` | Tersedia. |
| `botMetadata.messageDisclaimerText` | `BotMetadata.messageDisclaimerText` | Tersedia. |
| `verificationMetadata.proofs[]` | `BotSignatureVerificationMetadata.proofs` | Tersedia. |
| `proofs[].useCase: 1` | `BotSignatureVerificationUseCaseProof.BotSignatureUseCase.WA_BOT_MSG` | Enum resmi, jangan hardcode angka. |
| `botForwardedMessage` | `Message.botForwardedMessage` bertipe `FutureProofMessage` | Wrapper `{ message: {...} }`. |
| `richResponseMessage` | `AIRichResponseMessage` | Tersedia. |
| `messageType: 1` | `AIRichResponseMessageType.AI_RICH_RESPONSE_TYPE_STANDARD` | Enum resmi. |
| `submessages[].messageType: 2` | `AIRichResponseSubMessageType.AI_RICH_RESPONSE_TEXT` | Enum resmi. |
| `unifiedResponse.data` | `AIRichResponseUnifiedResponse.data` | Tipe `Uint8Array`. |
| `contextInfo.forwardedAiBotMessageInfo.botJid` | `ForwardedAIBotMessageInfo.botJid` | Tersedia. |
| `forwardOrigin: 4` | `ContextInfo.ForwardOrigin.META_AI` | Enum resmi. |

## 3. Perbedaan wajib saat porting

### 3.1 Binary field bukan base64 string

Sample Baileys mengisi `signature` dan `certificateChain` dengan **string base64**. Schema Zapo mendeklarasikan keduanya sebagai `Uint8Array`. Konversi wajib:

```ts
const bytes = (b64: string) => Uint8Array.from(Buffer.from(b64, 'base64'))
```

Mengirim string mentah ke field bytes adalah bug tipe, bukan sekadar gaya.

### 3.2 `unifiedResponse.data` bukan `.toString('base64')`

Sample Baileys memanggil `Buffer.from(JSON.stringify(...)).toString('base64')`. Di Zapo, field `data` sudah bertipe bytes, jadi encoding base64 tambahan akan mengirim payload salah. Yang benar:

```ts
data: Uint8Array.from(Buffer.from(JSON.stringify(payload), 'utf8'))
```

### 3.3 Zapo memakai `Uint8Array`, bukan `Buffer`

Konvensi internal Zapo adalah `Uint8Array` dengan zero-copy pada hot path. Gunakan `Uint8Array` di seluruh boundary.

### 3.4 Enum diambil dari `proto`, bukan angka literal

Zapo tidak memakai TypeScript enum; konstanta protokol berupa objek frozen dan enum proto. Ambil dari namespace `proto` agar tetap benar saat schema berubah.

## 4. Perilaku Zapo yang perlu diperhatikan

Dua perilaku ini ditemukan dengan membaca `dist/message/encode/content.js` versi 1.8.2, bukan diasumsikan.

1. **Stanza type attribute.** `resolveMessageTypeAttr` mengembalikan `media` untuk pesan `botForwardedMessage` + `richResponseMessage`, sedangkan `conversation` dan `interactiveMessage` mengembalikan `text`. Ini keputusan library, bukan pilihan kita.

2. **Message secret persistence.** `needsSecretPersistence` bernilai true ketika `messageContextInfo.botMetadata` terisi, termasuk saat body dibungkus `botInvokeMessage`. Artinya mengirim payload bergaya bot menyebabkan Zapo menyimpan message secret. Konsekuensi storage harus dipertimbangkan sebelum command semacam ini dipakai luas.

## 5. Hasil live test

Live test dilakukan melalui `@zapo-js/mcp-server@1.2.0` dengan MCP sebagai
satu-satunya `WaClient` pada store. Payload dikirim ke PM owner dan grup
allowlist dalam beberapa bentuk:

1. pesan kontrol `conversation`;
2. AIRich lengkap dengan `forwardedAiBotMessageInfo.botJid`, `forwardOrigin: 4`,
   signature acak 64 byte, certificate chain acak 684/892 byte;
3. edit protocol type 14 seperti `baileys-mbuilder`;
4. pesan biasa yang mengutip message ID AIRich;
5. pesan polos `status true`.

Semua pengiriman selesai dalam satu attempt dengan `ack.error = null`; ACK grup
memiliki `count = 2`, dan MCP mencatat nol warning/error. Hasil pada WhatsApp HP
dan Web sama:

- kontrol dan `status true` tampil;
- bubble AIRich tidak tampil sama sekali;
- pesan biasa yang mengutip AIRich tampil;
- quoted preview mengenali nomor pengirim, tetapi area isi quoted kosong.

Ini membuktikan message ID AIRich masuk ke graph reply, tetapi body-nya disaring
saat decode/render. Server ACK bukan bukti client akan membuat bubble. Menulis
`botJid` pada metadata dan menambahkan proof acak hanya membuat klaim data; itu
tidak mengubah pengirim `@s.whatsapp.net` menjadi identitas `@bot` yang dapat
diverifikasi.

`mailbox_messages` dan `mailbox_threads` tetap nol row setelah tes, termasuk
untuk pesan kontrol. Store tersebut bukan outbox, sehingga ketiadaan row tidak
membatalkan ACK maupun hasil visual.

### Implikasi

`GenAIaeacdsnwHtmlPrimitive` tidak dipakai sebagai UI game pada akun WhatsApp
biasa. `BOT_HTML_GAMES` kembali nonaktif. Jalur `.raw` tetap tersedia untuk
menguji jenis proto lain yang memang didokumentasikan sebagai raw-send Zapo.

Yang masih dapat diteliti secara sah adalah balasan asli dari bot `@bot` melalui
`client.bot.sendPrompt`; itu dapat menunjukkan provenance asli, tetapi tidak
memberikan credential untuk mengirim sebagai bot tersebut.

## 6. Rencana implementasi historis

Prasyarat: MVP selesai dan hijau.

1. **Adapter typed.** Buat builder kecil yang menerima input tervalidasi lalu menghasilkan `Proto.IMessage`. Tidak ada string protobuf yang ditulis manual di feature.
2. **Unit test encode/decode.** Round-trip harus dibuktikan seperti pada bagian 1, termasuk enum dan panjang bytes.
3. **E2E fake server.** Kirim payload melalui `@zapo-js/fake-server` dan assert stanza keluar benar-benar terkirim serta dapat didekode peer.
4. **Feature flag.** Command eksperimental default nonaktif dan hanya owner, karena risiko akun belum diketahui.
5. **Live test terbatas.** Gunakan akun test, catat hasil per platform client, hentikan bila ada indikasi pembatasan.
6. **Dokumentasikan status.** Jangan menandai fitur ini "berfungsi" sebelum ada bukti rendering nyata.

## 7. Batas keamanan tambahan

- HTML/JS payload adalah konten aktif. Jangan pernah menyusunnya dari input user tanpa allowlist ketat.
- Jangan menyalin certificate chain milik pihak lain sebagai identitas bot kita.
- Jangan mengklaim identitas Meta AI atau bot resmi pihak ketiga.
- Jaga agar payload tidak berisi data pribadi pengguna.
- Command ini tetap tunduk pada larangan `eval` dan eksekusi kode di sisi bot; yang dikirim hanyalah dokumen, bukan eksekusi lokal.

## 8. Referensi

- Raw proto sends: <https://zapo.to/en/guides/raw-sends>
- Message types reference: <https://zapo.to/en/reference/message-types>
- Low-level API: <https://zapo.to/en/reference/low-level>
- Docs MCP dan llms.txt: <https://zapo.to/en/use-with-ai>
- Sumber inspirasi Baileys: <https://github.com/hamm-r/anya-MD-v3>
