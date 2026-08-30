# Creative Rich Messages — Verified Feasibility

Status: **terverifikasi pada level encoding/protobuf**, belum terverifikasi pada rendering client WhatsApp.  
Target fase: **Phase 2**, setelah MVP command pipeline selesai.

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

## 5. Yang belum terverifikasi

- Apakah WhatsApp menerima pesan ini dari companion device biasa.
- Apakah client Android, iOS, dan Web merender HTML primitive tersebut.
- Apakah `verificationMetadata` palsu/placeholder diterima atau ditolak server.
- Apakah pengiriman berulang memicu pembatasan akun.
- Apakah bentuk `GenAIaeacdsnwHtmlPrimitive` stabil; nama typename semacam ini biasanya hasil reverse engineering dan dapat berubah kapan pun.

Sampel HTML dalam pesan user juga sudah rusak akibat escaping (`\o.forEach`, regex `d+`, newline hilang). Payload harus ditulis ulang dari sumber bersih, bukan disalin dari teks yang sudah termangle.

## 6. Rencana implementasi Phase 2

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
