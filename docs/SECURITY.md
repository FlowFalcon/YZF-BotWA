# Security and Operational Boundaries

## 1. Credential dan session

- `.auth/`, SQLite session, QR artifact, dan credential tidak boleh masuk Git.
- Credential Zapo dapat mengimpersonasi linked device; perlakukan sebagai secret.
- Jangan log `credentials`, raw QR string, Noise/Signal key, cookie, atau database session.
- Backup session harus terenkripsi dan aksesnya dibatasi.
- Shutdown memakai `disconnect()`. `logout()` hanya untuk unlink permanen yang disengaja.

## 2. Fitur yang dilarang

MVP tidak boleh memiliki:

- `eval`, `Function`, VM execution, atau eksekusi source dari chat;
- shell command dari pesan;
- remote plugin install/update;
- arbitrary file read/write dari command;
- URL fetch generik tanpa allowlist dan limit;
- dynamic dependency patch;
- opsi Zapo `dangerous.*`;
- endpoint debug yang mengeluarkan raw event/credential.

## 3. Input boundary

- Semua command metadata divalidasi saat startup.
- Semua pesan dianggap untrusted input.
- Panjang command body dibatasi sebelum parsing: `MAX_COMMAND_BODY_BYTES` = 4096 byte UTF-8 di `lib/commands/parser.ts`; body yang lebih panjang tidak diparse.
- Output user tidak dipakai sebagai path, module specifier, SQL, shell argument, atau log template.
- Nomor pairing dinormalisasi ke digit dan divalidasi sebelum API dipanggil.

## 4. Abuse controls

- Flood limit per sender dengan TTL dan batas ukuran map.
- Cooldown per sender + canonical command.
- Owner tidak otomatis kebal dari safety boundary; hanya permission/cooldown tertentu jika diputuskan eksplisit.
- Bot tidak memproses own-message echo.
- Tidak ada broadcast massal atau unsolicited messaging pada MVP.

## 5. Logging dan privasi

Boleh dicatat:

- message ID;
- command canonical;
- tipe chat;
- durasi;
- status sukses/gagal;
- sender identifier yang sudah direduksi/hash bila diperlukan.

Tidak boleh dicatat secara default:

- body pesan;
- raw event;
- nomor telepon lengkap;
- quoted content;
- media content;
- QR/pairing code;
- credential/session state.

Debug logging yang lebih detail harus opt-in, temporer, dan tetap menyensor secret.

## 6. Dependency policy

- Jangan memakai versi `latest` di `package.json`.
- Commit lockfile.
- Major upgrade `zapo-js` memerlukan review changelog dan full test suite.
- Postinstall script dari dependency ditinjau saat dependency baru ditambahkan.
- Dependency baru harus membuktikan nilai yang tidak wajar ditulis dengan standard library.

## 7. Store dan filesystem

- Default store berada di `.auth/state.sqlite`.
- Parent directory dibuat dengan permission yang sesuai kemampuan OS.
- Satu `sessionId` hanya dimiliki satu proses pada saat yang sama.
- Jangan membuka SQLite session yang sama dari dua instance bot.
- Message/thread/contact archive disabled pada MVP untuk minimisasi data.
- Mode runtime disimpan di `.auth/settings.json` dengan write-then-rename atomik dan permission file terbatas bila OS mendukung.
- Settings hilang, korup, atau legacy harus fail closed ke `owner-only`; tidak boleh menebak mode lebih terbuka.
- `.raw` dan parser payload dari chat tidak tersedia. AIRich built-in hanya memakai builder typed yang ditinjau.
- Plugin adalah trusted owner code, bukan sandbox. Hanya source `.ts` reguler maksimal 256 KiB yang diterima; path keluar project, symlink, `.d.ts`, dan file non-TypeScript ditolak.
- Static policy konservatif menolak seluruh referensi `eval`, `Function`, `process`, `globalThis`, `require`, dan `createRequire`; dynamic import; tagged template; initializer top-level impure; assignment/call/await top-level; import paket di luar `zapo-js`; serta built-in di luar `node:crypto`/`node:fs`/`node:stream`. Relative import diperiksa dengan `realpath`; symlink dan path escape ditolak.
- Candidate dikompilasi dengan dependency terpasang dan diprobe lewat child process dengan environment minimal, timeout 2 detik, dan `SIGKILL` saat timeout. Probe bukan sandbox filesystem/network. Build diserialisasi dan hanya mempublikasikan generation immutable unik setelah seluruh validasi berhasil; candidate gagal dibersihkan dan registry lama dipertahankan.
- Staging Plugin Manager divalidasi per komponen path dengan `lstat`/`realpath` sebelum write dan sebelum promote; `.runtime`, `.runtime/plugin-staging`, file staged, dan `plugins/` yang berupa symlink ditolak sehingga source tidak pernah ditulis atau dipromosikan ke luar project.
- Lock build lintas process menyimpan PID dan timestamp owner. Lock milik process hidup tidak pernah diambil; lock dengan owner mati, owner metadata korup, atau tanpa owner melewati grace direcover tanpa menunggu timeout 30 detik.
- Retensi output plugin dibatasi tepat tiga generation termasuk yang aktif; directory dengan nama di luar format generation dihapus tanpa memakan kuota retensi.

## 7A. Access mode

- `public` membuka private chat dan grup, tetapi permission command tetap berlaku.
- `group-only` membuka grup untuk semua anggota dan private chat hanya untuk owner.
- `owner-only` membuka command hanya untuk owner di kedua jenis chat.
- Access gate berjalan sebelum registry lookup. Penolakan senyap.
- `.botmode` owner-only selalu dapat melewati jalur kontrol agar mode tidak mengunci owner permanen.

## 8. Error handling

- Error internal dibalas generic; stack trace hanya ke logger.
- Error fatal startup menyebabkan exit nonzero.
- Jangan melanjutkan proses setelah uncaught exception dalam state tidak diketahui.
- Reconnect berhenti pada logout/fatal auth dan setelah max attempts.
- Retry memiliki backoff dan batas; tidak ada loop tanpa batas.

## 9. Responsible use

Bot digunakan untuk eksperimen dan hiburan pada akun/grup yang mengizinkan. Tidak digunakan untuk spam, scraping kontak, impersonation, bypass passkey, atau perilaku yang melanggar aturan platform.

## 10. Incident response minimum

Jika session diduga bocor:

1. Unlink perangkat melalui WhatsApp Linked Devices.
2. Hentikan bot.
3. Hapus/karantina session store yang terdampak.
4. Periksa log dan akses host tanpa menyebarkan credential.
5. Pair ulang setelah host dinyatakan aman.
