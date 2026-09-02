# Testing Strategy

## 1. Tujuan

Test membuktikan behavior produk, bukan sekadar coverage. Semua production behavior baru mengikuti RED → GREEN → REFACTOR.

## 2. Tooling

- Test runner: Vitest.
- Coverage: V8 provider Vitest.
- Typecheck: `tsc --noEmit`.
- Lint: ESLint dengan type-aware rules yang relevan.
- E2E protocol: `@zapo-js/fake-server`.

Script yang tersedia di `package.json`:

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage",
  "typecheck": "tsc --noEmit",
  "lint": "eslint .",
  "check": "npm run typecheck && npm run lint && npm test"
}
```

Formatter terpisah tidak dipakai: gaya kode dijaga ESLint.

## 3. TDD workflow

Untuk setiap behavior:

1. Tulis satu test behavior.
2. Jalankan test spesifik dan pastikan gagal karena behavior belum ada.
3. Implementasikan minimum agar test lulus.
4. Jalankan test spesifik sampai lulus.
5. Jalankan suite terkait.
6. Refactor hanya dalam kondisi hijau.
7. Jalankan `npm run check` sebelum commit.

Test yang langsung lulus pada RED harus diperbaiki karena tidak membuktikan perubahan.

## 4. Lapisan test

### Unit

Tidak menggunakan `WaClient` nyata.

Target:

- config parser;
- text extraction;
- identity PN/LID normalization;
- command parser;
- command metadata validation;
- duplicate registry detection;
- candidate registry swap/retention, policy capability/top-level/realpath, immutable generation concurrent build, output containment, staging promotion, dan watcher add/change/unlink, debounce, serialisasi, serta shutdown;
- permission middleware;
- flood limiter;
- cooldown expiry/cleanup;
- reconnect backoff calculation;
- settings store dengan temporary path, safe default, atomic persistence, dan concurrent writes;
- matriks penuh mode × private/group × owner/non-owner;
- menu, Owner Menu, `.botmode`, profile/branding owner, sticker, dan AIRich Dino;
- profile coordinator fake, resize/crop JPEG deterministik, validasi tipe/limit, serta thumbnail atomic pada temporary path (test tidak menyentuh `.auth`).

### Integration

Menghubungkan beberapa module dengan fake adapter, tanpa jaringan.

Target:

- event → context → parser → middleware → command → reply adapter;
- menu membaca registry canonical;
- command exception masuk error boundary;
- reconnect state tidak membuat connect paralel;
- auth mode memilih QR/pairing dengan benar;
- shutdown membatalkan backoff dan memanggil disconnect satu kali.

### E2E fake server

Menggunakan `@zapo-js/fake-server` dan memory store agar hermetic.

Target minimum:

1. App connect ke fake server.
2. Fake peer mengirim `.ping`.
3. Peer menerima reply yang sesuai.
4. Own-message echo tidak diroute ulang.
5. Dua pesan cepat membuktikan cooldown.
6. Group event membuktikan reply target adalah group JID.

Tidak menonaktifkan certificate verification; gunakan `testHooks.noiseRootCa` dari fake server sebagaimana dokumentasi resmi.

### Live smoke test

Hanya setelah automated suite lulus, dengan akun test:

- QR pairing;
- pairing code;
- restart tanpa pairing;
- private `.menu`, `.sticker`, dan owner `.botmode`;
- group `.ping` dan identitas LID;
- transient reconnect bila dapat diuji aman;
- SIGTERM graceful shutdown.

Hasil dicatat tanpa QR payload, pairing code, nomor penuh, atau credential.

## 5. Test matrix inti

| Area | Happy path | Edge/failure |
|---|---|---|
| Config | defaults dan env valid | prefix kosong, auth method invalid |
| Parser | prefix, alias, args | empty command, unknown prefix |
| Registry | commands unik | duplicate name/alias, invalid module |
| Identity | PN private, LID group | alternate missing |
| Permission | everyone/owner | non-owner ditolak |
| BotMode | seluruh matriks chat × owner × mode | file hilang/korup, perubahan runtime, jalur darurat owner |
| Cooldown | first call allowed | repeated call blocked, expiry |
| Reconnect | transient close | logout, max attempts, shutdown race |
| Auth | QR/pairing | missing pairing number, passkey required |
| Features | menu/sticker/AIRich/owner controls | input invalid dan command yang dihapus tidak terdaftar |
| Router | reply sukses | feature throws, send fails |

## 6. Determinisme

- Waktu di-inject melalui `Clock`/`now()`.
- Random di-inject melalui `RandomSource`/`random()`.
- Filesystem loader memakai temporary fixture directory.
- Cooldown test tidak menggunakan real sleep.
- E2E memiliki timeout eksplisit dan selalu teardown server/client.

## 7. Coverage

Coverage bukan satu-satunya gate. Target awal:

- statements/lines/functions: minimal 85%;
- branches: minimal 80%;
- 100% untuk parser, registry duplicate detection, dan reconnect state transitions.

Pengecualian harus dicatat dengan alasan, bukan dikejar lewat test yang tidak bermakna.

## 8. Definition of done

Perubahan belum selesai jika:

- test tidak pernah terlihat gagal;
- hanya typecheck yang lulus;
- hanya happy path diuji;
- test memakai real time/random padahal dapat di-inject;
- fake server/client tidak ditutup;
- live behavior diklaim tanpa smoke test nyata.
