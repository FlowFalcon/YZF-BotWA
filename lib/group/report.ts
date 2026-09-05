import type { ParticipantResult } from './gateway.js'

/**
 * Server menerima sebagian target dan menolak sisanya dalam satu permintaan,
 * jadi laporan dibuat per-JID: klaim "berhasil" tanpa memeriksa kode adalah
 * laporan palsu.
 */
function reasonFor(code: number): string {
  switch (code) {
    case 401: return 'bot diblokir target'
    case 403: return 'ditolak (setelan privasi atau butuh undangan)'
    case 404: return 'nomor tidak ditemukan'
    case 408: return 'timeout'
    case 409: return 'sudah jadi peserta'
    default: return `kode ${String(code)}`
  }
}

export function formatParticipantReport(
  action: string,
  results: readonly ParticipantResult[],
): string {
  const ok = results.filter((result) => result.status === 'ok')
  const failed = results.filter((result) => result.status !== 'ok')

  const lines = [`*${action}*: ${String(ok.length)} berhasil, ${String(failed.length)} gagal.`]
  for (const result of failed) {
    const [number] = result.jid.split('@')
    lines.push(`• ${number ?? result.jid} — ${reasonFor(result.code)} (${String(result.code)})`)
  }
  return lines.join('\n')
}
