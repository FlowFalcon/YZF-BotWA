# Zapo Fun Bot Foundation Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Membangun MVP bot WhatsApp TypeScript berbasis `zapo-js` dengan auth QR/pairing, session SQLite, command pipeline modular, enam command, reconnect, dan automated tests.

**Architecture:** Satu composition root membuat store, `WaClient`, registry, middleware, router, auth controller, dan connection manager. Raw event Zapo dinormalisasi menjadi typed `CommandContext`; feature hanya bergantung pada contract tersebut. Lifecycle koneksi dimiliki connection manager dan behavior protocol diuji dengan `@zapo-js/fake-server`.

**Tech Stack:** Node.js >=20.9.0, TypeScript strict/ESM, zapo-js 1.8.2, @zapo-js/store-sqlite 1.2.0, Vitest 4.1.11, @zapo-js/fake-server 1.3.0, ESLint, Pino, SQLite.

---

## Ground rules

- Ikuti `AGENTS.md`, PRD, arsitektur, command spec, testing, security, dan decision log.
- TDD untuk setiap production behavior: satu failing test → minimum implementation → pass → refactor.
- Jangan menyalin source dari dua base referensi.
- Jangan mengimplementasikan non-goals PRD.
- Versi di atas adalah hasil registry npm saat plan dibuat. Sebelum install, cek engine/peer compatibility; jika konflik nyata, dokumentasikan versi kompatibel yang dipilih dalam `docs/DECISIONS.md`.
- Commit hanya setelah test terkait dan `npm run check` lulus.

## Target files

```text
package.json
package-lock.json
tsconfig.json
eslint.config.js
vitest.config.ts
.gitignore
.env.example
src/**/*.ts
tests/{unit,integration,e2e,fixtures}/**/*.test.ts
README.md
docs/*.md
```

---

### Task 1: Scaffold TypeScript dan quality gates

**Objective:** Membuat project ESM strict dengan script build, test, lint, dan check yang dapat dijalankan.

**Files:**
- Create: `package.json`
- Create: `package-lock.json`
- Create: `tsconfig.json`
- Create: `eslint.config.js`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `src/index.ts`
- Create: `tests/unit/smoke.test.ts`

**Step 1: Tulis failing smoke test**

Test mengimpor fungsi sementara `projectName()` dari `src/index.ts` dan mengharapkan `zapo-fun-bot`. Jalankan:

```bash
npx vitest run tests/unit/smoke.test.ts
```

Expected: FAIL karena module/function belum tersedia.

**Step 2: Install dependency secara exact**

```bash
npm install --save-exact zapo-js@1.8.2 @zapo-js/store-sqlite@1.2.0 better-sqlite3@13.0.3 pino@10.3.1 qrcode-terminal@0.12.0
npm install --save-dev --save-exact typescript@7.0.2 vitest@4.1.11 @vitest/coverage-v8@4.1.11 @zapo-js/fake-server@1.3.0 eslint@10.9.1 typescript-eslint@8.68.0 tsx@4.23.13 @types/node@26.4.0 @types/qrcode-terminal@0.12.2 prettier@3.9.6
```

Jika peer dependency resmi tidak mendukung kombinasi ini, pilih kombinasi kompatibel dan catat hasil registry/error nyata; jangan memakai `--force`.

**Step 3: Konfigurasi minimum**

- `type: module`.
- Engine `node >=20.9.0`.
- TypeScript: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, Node ESM.
- Scripts mengikuti `docs/TESTING.md` ditambah `dev`, `build`, dan `start`.
- `.gitignore` mencakup `node_modules`, `dist`, `.auth`, `.env`, coverage, log, QR, SQLite sidecars.

**Step 4: Implementasi minimum dan verifikasi**

Tambahkan export sementara agar smoke test hijau, lalu jalankan:

```bash
npm run typecheck
npm run lint
npm test
npm run check
```

Expected: seluruh command exit 0.

**Step 5: Commit**

```bash
git add package.json package-lock.json tsconfig.json eslint.config.js vitest.config.ts .gitignore .env.example src/index.ts tests/unit/smoke.test.ts
git commit -m "chore: scaffold TypeScript project"
```

---

### Task 2: Typed configuration

**Objective:** Memvalidasi environment menjadi readonly config dengan default aman.

**Files:**
- Create: `src/config.ts`
- Create: `tests/unit/config.test.ts`
- Modify: `.env.example`
- Modify: `src/index.ts`

**Behavior slices:**

1. Empty env menghasilkan prefix `['.']`, auth `auto`, session `default`, store `.auth/state.sqlite`.
2. `BOT_PREFIXES=.,!` menghasilkan dua prefix yang di-trim.
3. Prefix kosong/duplikat ditolak.
4. Auth selain `auto|qr|pairing` ditolak.
5. Pairing non-interaktif tanpa nomor ditangani oleh auth layer, bukan config global.
6. Owner/pairing number dinormalisasi hanya ke digit.

Untuk setiap slice: tulis test → jalankan test spesifik (FAIL) → implementasi minimum → jalankan (PASS).

```bash
npx vitest run tests/unit/config.test.ts
npm run check
```

Expected: PASS dan no type/lint errors.

**Commit:** `feat: add validated bot configuration`

---

### Task 3: Logger dan secure log contract

**Objective:** Menyediakan logger terstruktur tanpa membocorkan message body atau credential.

**Files:**
- Create: `src/shared/logger.ts`
- Create: `tests/unit/logger.test.ts`

**Behavior slices:**

1. Development memilih pretty transport; production JSON.
2. Helper command log menerima metadata terdefinisi, bukan raw event.
3. Redaction mencakup credential/QR/pairing keys bila object error membawa field tersebut.

Gunakan capture stream Pino pada test; jangan hanya mock function.

```bash
npx vitest run tests/unit/logger.test.ts
npm run check
```

**Commit:** `feat: add structured redacted logging`

---

### Task 4: SQLite store dan client factory

**Objective:** Membuat durable protocol store dengan archive domain disabled dan `WaClient` yang dapat di-inject untuk test.

**Files:**
- Create: `src/client/store.ts`
- Create: `src/client/create-client.ts`
- Create: `tests/unit/store.test.ts`
- Create: `tests/unit/create-client.test.ts`

**Behavior slices:**

1. Store parent directory dibuat bila belum ada.
2. Delapan protocol domain diarahkan ke SQLite.
3. `messages`, `threads`, `contacts` adalah `none`.
4. Client memakai stable `sessionId` dari config.
5. Factory tidak memasang event listener atau memanggil `connect()`.

Bila internal store mapping tidak memiliki public inspector, test contract melalui adapter/factory arguments atau temp SQLite behavior; jangan mengetes private field dengan casting `any`.

```bash
npx vitest run tests/unit/store.test.ts tests/unit/create-client.test.ts
npm run check
```

**Commit:** `feat: add SQLite-backed Zapo client factory`

---

### Task 5: Connection manager state machine

**Objective:** Menjamin connect/reconnect/shutdown tidak paralel, tidak infinite, dan berhenti saat logout.

**Files:**
- Create: `src/client/connection-manager.ts`
- Create: `src/shared/clock.ts`
- Create: `tests/unit/connection-manager.test.ts`

**Behavior slices:**

1. `start()` memanggil connect satu kali.
2. Event open mereset attempt.
3. Transient close menjadwalkan exponential backoff: 1s, 2s, 4s, capped 30s.
4. Logout close tidak reconnect.
5. Max attempts menghentikan retry.
6. Close berulang tidak membuat timer/connect paralel.
7. `stop()` membatalkan timer dan memanggil disconnect satu kali.
8. Connect failure masuk retry policy.

Gunakan fake timers Vitest, bukan real sleep.

```bash
npx vitest run tests/unit/connection-manager.test.ts
npm run check
```

**Commit:** `feat: add bounded connection lifecycle manager`

---

### Task 6: Auth controller QR dan pairing

**Objective:** Mendukung `auto`, QR, dan pairing code tanpa membocorkan auth material.

**Files:**
- Create: `src/auth/auth-controller.ts`
- Create: `src/auth/qr.ts`
- Create: `src/auth/pairing.ts`
- Create: `tests/unit/auth-controller.test.ts`

**Behavior slices:**

1. QR event merender QR terbaru.
2. Pairing request hanya dilakukan setelah `auth_pairing_required` dan active connection flow.
3. Nomor pairing berupa digit country code.
4. Mode noninteraktif pairing tanpa nomor menghasilkan startup error spesifik.
5. `auth_paired` hanya mencatat identity aman, bukan credential object.
6. Passkey-required tanpa signer dilaporkan, tanpa bypass.
7. Listener dipasang sekali dan dapat dilepas saat teardown.

```bash
npx vitest run tests/unit/auth-controller.test.ts
npm run check
```

**Commit:** `feat: add QR and pairing authentication controller`

---

### Task 7: Message text dan PN/LID identity normalization

**Objective:** Mengubah raw event menjadi identity/text model yang konsisten untuk private dan group.

**Files:**
- Create: `src/messages/extract-text.ts`
- Create: `src/messages/identity.ts`
- Create: `tests/unit/extract-text.test.ts`
- Create: `tests/unit/identity.test.ts`
- Create: `tests/fixtures/messages.ts`

**Behavior slices:**

- conversation, extended text, image caption, video caption;
- empty/unsupported message;
- private PN + optional LID alt;
- private LID + PN alt;
- group participant PN/LID pair;
- alternate missing;
- group reply target tetap remote group JID;
- owner matching memakai normalized PN bila tersedia.

Gunakan tipe `WaIncomingMessageEvent` aktual; fixture boleh memakai builder typed yang hanya mengisi field relevan.

```bash
npx vitest run tests/unit/extract-text.test.ts tests/unit/identity.test.ts
npm run check
```

**Commit:** `feat: normalize incoming messages and identities`

---

### Task 8: Command parser, contract, dan registry

**Objective:** Membuat typed command contract, parser multi-prefix, dan registry atomic tanpa duplikat.

**Files:**
- Create: `src/commands/command.ts`
- Create: `src/commands/parser.ts`
- Create: `src/commands/registry.ts`
- Create: `tests/unit/parser.test.ts`
- Create: `tests/unit/registry.test.ts`

**Behavior slices:**

1. Parsing prefix, case-insensitive command, args, dan text.
2. Whitespace setelah prefix diperbolehkan.
3. Empty/unknown prefix tidak menghasilkan invocation.
4. Metadata valid terdaftar.
5. Invalid name/alias/category/cooldown ditolak.
6. Duplicate name-name, name-alias, dan alias-alias ditolak dengan dua source.
7. Alias resolve ke canonical command.
8. Menu listing hanya canonical dan stable-sorted.

```bash
npx vitest run tests/unit/parser.test.ts tests/unit/registry.test.ts
npm run check
```

**Commit:** `feat: add typed command registry and parser`

---

### Task 9: Filesystem command loader

**Objective:** Menemukan feature modules secara rekursif dan mempublikasikan registry hanya setelah semua module valid.

**Files:**
- Create: `src/commands/loader.ts`
- Create: `tests/integration/loader.test.ts`
- Create: `tests/fixtures/features/valid.ts`
- Create: `tests/fixtures/features/duplicate.ts`
- Create: `tests/fixtures/features/invalid.ts`

**Behavior slices:**

1. Recursive discovery memuat nested command.
2. Non-command file diabaikan atau ditolak sesuai explicit file convention.
3. Invalid export menghasilkan source-aware error.
4. Duplicate membuat seluruh load gagal; registry lama tidak berubah jika reload kelak ditambah.
5. Production path bekerja terhadap compiled `.js`; test loader tidak bergantung pada source-only `.ts` magic.

Jika runtime TS loader membuat behavior berbeda dari compiled ESM, build fixtures dan test output `dist`; jangan mengandalkan query-string cache busting sebagai desain utama.

```bash
npx vitest run tests/integration/loader.test.ts
npm run build
npm run check
```

**Commit:** `feat: load commands recursively and atomically`

---

### Task 10: Context factory dan reply adapter

**Objective:** Membuat typed `CommandContext` dengan target reply, clock, random, reply, dan reaction.

**Files:**
- Create: `src/messages/context.ts`
- Create: `src/shared/random.ts`
- Create: `tests/unit/context.test.ts`

**Behavior slices:**

1. Private reply ke peer chat target.
2. Group reply ke group JID, bukan participant.
3. Context menyimpan PN/LID dan owner flag.
4. `reply` memakai API public typed `client.message.send`.
5. `react` memakai content union typed dengan raw event sebagai target.
6. `now/random` berasal dari injected service.

```bash
npx vitest run tests/unit/context.test.ts
npm run check
```

**Commit:** `feat: add typed command context`

---

### Task 11: Permission, flood, cooldown, dan error middleware

**Objective:** Menegakkan urutan guard dan bounded in-memory state.

**Files:**
- Create: `src/commands/middleware/permission.ts`
- Create: `src/commands/middleware/flood.ts`
- Create: `src/commands/middleware/cooldown.ts`
- Create: `src/commands/middleware/error-boundary.ts`
- Create: `tests/unit/permission.test.ts`
- Create: `tests/unit/flood.test.ts`
- Create: `tests/unit/cooldown.test.ts`
- Create: `tests/unit/error-boundary.test.ts`

**Behavior slices:**

- everyone vs owner permission;
- cooldown key canonical command, bukan alias;
- first call allowed, repeat blocked, expiry allowed;
- permission failure tidak mengonsumsi cooldown;
- flood window dan cleanup;
- state map memiliki max entries/TTL;
- command exception menghasilkan generic reply dan structured error;
- send failure dicatat tanpa recursion/retry loop.

Gunakan fake clock. Hindari class hierarchy middleware; fungsi terkomposisi cukup.

```bash
npx vitest run tests/unit/permission.test.ts tests/unit/flood.test.ts tests/unit/cooldown.test.ts tests/unit/error-boundary.test.ts
npm run check
```

**Commit:** `feat: add command safety middleware`

---

### Task 12: Message router integration

**Objective:** Menghubungkan filter, context, parser, registry, middleware, dan execution dalam urutan PRD.

**Files:**
- Create: `src/messages/router.ts`
- Create: `tests/integration/router.test.ts`

**Behavior slices:**

1. Own message, newsletter, dan unsupported broadcast diabaikan.
2. Non-command/unknown command diabaikan.
3. Alias menjalankan canonical command.
4. Pipeline order sesuai spec.
5. Args/text/context diteruskan benar.
6. Permission → flood → cooldown → execute.
7. Satu command error tidak memengaruhi message berikutnya.
8. Duration log tidak memuat body.

```bash
npx vitest run tests/integration/router.test.ts
npm run check
```

**Commit:** `feat: route messages through command pipeline`

---

### Task 13: Implementasi enam command MVP

**Objective:** Menambah behavior product-visible sesuai command spec.

**Files:**
- Create: `src/features/general/menu.ts`
- Create: `src/features/general/ping.ts`
- Create: `src/features/fun/dice.ts`
- Create: `src/features/fun/coinflip.ts`
- Create: `src/features/fun/eightball.ts`
- Create: `src/features/fun/rate.ts`
- Create: `tests/unit/features/menu.test.ts`
- Create: `tests/unit/features/ping.test.ts`
- Create: `tests/unit/features/dice.test.ts`
- Create: `tests/unit/features/coinflip.test.ts`
- Create: `tests/unit/features/eightball.test.ts`
- Create: `tests/unit/features/rate.test.ts`

**Vertical slices:**

Implementasikan satu command per RED/GREEN cycle, lalu commit bila masuk akal.

- `menu`: canonical list, sorted category/name, dynamic prefix.
- `ping`: processing latency, tidak disebut network latency.
- `dice`: random boundary menghasilkan 1 dan 6.
- `coinflip`: boundary `<0.5` dan `>=0.5`.
- `eightball`: empty usage dan deterministic injected random.
- `rate`: empty usage, range 0–100, deterministic normalized input + UTC date.

```bash
npx vitest run tests/unit/features
npm run check
```

**Commit:** `feat: add MVP fun commands`

---

### Task 14: App composition dan graceful shutdown

**Objective:** Merakit seluruh dependency tanpa business logic di entrypoint.

**Files:**
- Create: `src/app.ts`
- Modify: `src/index.ts`
- Create: `tests/integration/app.test.ts`
- Remove/replace: temporary Task 1 smoke export/test bila tidak lagi bernilai.

**Behavior slices:**

1. Bootstrap order: config → logger → store → registry → client → listeners → connect.
2. Startup error menetapkan nonzero outcome tanpa startup parsial.
3. Message listener dipasang sekali.
4. SIGINT/SIGTERM path memanggil manager stop/disconnect.
5. App exposes lifecycle hooks untuk E2E tanpa membaca process global secara sulit diuji.

```bash
npx vitest run tests/integration/app.test.ts
npm run build
npm run check
```

**Commit:** `feat: compose bot application lifecycle`

---

### Task 15: End-to-end fake server

**Objective:** Membuktikan pipeline Zapo nyata dari encrypted inbound message sampai outbound reply tanpa WhatsApp production.

**Files:**
- Create: `tests/e2e/bot.test.ts`
- Modify: `src/client/create-client.ts` bila perlu injection socket URL, test root CA, dan media proxy melalui explicit test-only options.

**Behavior slices:**

1. Start `FakeWaServer`.
2. Start app dengan memory store/test transport.
3. Create fake peer.
4. Peer mengirim `.ping`; outbound reply diterima.
5. Peer mengirim `.dice`; reply valid 1–6.
6. Immediate repeated command membuktikan cooldown.
7. Teardown client/server pada success maupun failure.

Jangan disable TLS verification. Gunakan `server.noiseRootCa` dan proxy yang didokumentasikan.

```bash
npx vitest run tests/e2e/bot.test.ts --testTimeout=15000
npm run check
```

Expected: all pass, tidak ada open handle.

**Commit:** `test: verify bot pipeline with Zapo fake server`

---

### Task 16: Documentation, build artifact, dan release gate

**Objective:** Menyelaraskan dokumentasi dengan implementasi nyata dan menjalankan verifikasi penuh.

**Files:**
- Modify: `README.md`
- Modify: `.env.example`
- Modify: `docs/PRD.md` hanya untuk status acceptance criteria yang benar-benar terpenuhi.
- Modify: `docs/ARCHITECTURE.md`, `docs/COMMAND_SPEC.md`, `docs/TESTING.md`, `docs/SECURITY.md`, atau `docs/DECISIONS.md` hanya bila implementasi yang diverifikasi memerlukan perubahan.

**Step 1: Audit drift**

Bandingkan scripts, paths, env vars, metadata command, middleware order, provider mapping, dan test commands terhadap docs.

**Step 2: Full verification**

```bash
npm ci
npm run check
npm run test:coverage
npm run build
node --check dist/index.js
```

Expected:

- seluruh command exit 0;
- coverage memenuhi target atau pengecualian tercatat;
- build menghasilkan ESM yang valid;
- tidak ada credential/session/log/coverage dalam Git.

**Step 3: Security scan**

Cari `eval`, `new Function`, `child_process`, `dangerous`, raw message logging, `.catch(() => {})`, `any`, dan dependency `latest`. Setiap match harus dihapus atau dijustifikasi oleh contract yang sah.

**Step 4: Independent review**

Jalankan reviewer terpisah untuk spec compliance, security, logic errors, dan test adequacy. Perbaiki hanya finding terverifikasi dan ulangi full verification.

**Step 5: Live smoke test manual**

Dengan akun test:

- QR pairing;
- pairing code pada fresh session terpisah;
- restart tanpa pairing;
- private/group command;
- LID observation jika tersedia;
- graceful SIGTERM.

Jangan menandai acceptance item live sebagai selesai sebelum pengujian benar-benar dilakukan.

**Step 6: Commit**

```bash
git add README.md .env.example docs AGENTS.md AGENT.md
# Tambahkan source/test/config yang memang berubah setelah review.
git commit -m "docs: finalize MVP operating guide"
```

---

## Final acceptance gate

Sebelum menyebut MVP selesai:

- semua acceptance criteria PRD diperiksa satu per satu;
- automated suite dan build lulus dari clean install;
- E2E fake server lulus;
- live items dilaporkan sebagai tested atau explicitly untested;
- tidak ada secret/session artifact di repo;
- dependency lockfile committed;
- reviewer independen tidak menemukan security concern atau logic error yang belum selesai.

## Known open decisions for implementation

1. Nama/branding final bot masih working title `Zapo Fun Bot`.
2. Format output `head/tail` coinflip perlu pilihan kata final (`angka/gambar` atau `kepala/ekor`); default implementasi harus ditetapkan dalam test dan docs.
3. Exact lint compatibility TypeScript 7/ESLint 10 harus dibuktikan saat scaffold; jangan memaksa peer dependency.
4. Live passkey-gated pairing tidak termasuk acceptance karena bergantung pada akun/authenticator, tetapi event wajib ditangani dengan pesan operasional yang benar.
