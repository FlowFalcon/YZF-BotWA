import type { Clock } from '../../shared/clock.js'

export type FloodDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly retryAfterMs: number }

export interface FloodOptions {
  readonly clock: Clock
  /** Maksimum command per sender dalam satu window. */
  readonly limit: number
  readonly windowMs: number
  readonly maxSenders?: number
}

export interface FloodGate {
  /** Check-and-record sinkron: tidak ada await antara baca dan tulis. */
  check(senderJid: string): FloodDecision
  size(): number
  senders(): readonly string[]
  hitCount(senderJid: string): number
}

const DEFAULT_MAX_SENDERS = 5_000

const ALLOWED: FloodDecision = { allowed: true }

/**
 * Sliding window per sender (SECURITY.md §4). State dibatasi dua arah:
 * timestamp di luar window dibuang saat sender diakses, dan sender yang seluruh
 * timestamp-nya kedaluwarsa dihapus dari map pada setiap check.
 */
export function createFloodGate(options: FloodOptions): FloodGate {
  const maxSenders = options.maxSenders ?? DEFAULT_MAX_SENDERS
  /** senderJid -> timestamp hit yang masih di dalam window, ascending. */
  const hitsBySender = new Map<string, number[]>()

  function dropExpired(hits: number[], cutoffMs: number): void {
    let keepFrom = 0
    while (keepFrom < hits.length) {
      const hit = hits[keepFrom]
      if (hit === undefined || hit > cutoffMs) {
        break
      }
      keepFrom += 1
    }
    if (keepFrom > 0) {
      hits.splice(0, keepFrom)
    }
  }

  function pruneAll(cutoffMs: number): void {
    for (const [sender, hits] of hitsBySender) {
      dropExpired(hits, cutoffMs)
      if (hits.length === 0) {
        hitsBySender.delete(sender)
      }
    }
  }

  return {
    check(senderJid) {
      const nowMs = options.clock.now()
      const cutoffMs = nowMs - options.windowMs
      pruneAll(cutoffMs)

      const existing = hitsBySender.get(senderJid)
      const hits = existing ?? []
      if (hits.length >= options.limit) {
        const oldest = hits[0]
        // hits nonkosong di cabang ini; fallback nowMs hanya untuk memenuhi type.
        const retryAfterMs = (oldest ?? nowMs) + options.windowMs - nowMs
        return { allowed: false, retryAfterMs }
      }

      hits.push(nowMs)
      // delete sebelum set: sender aktif pindah ke akhir insertion order, sehingga
      // eviction membuang sender yang paling lama tidak dipakai.
      hitsBySender.delete(senderJid)
      // Insertion order cukup untuk batas sender saat ini.
      while (hitsBySender.size >= maxSenders) {
        const oldestSender = hitsBySender.keys().next()
        if (oldestSender.done === true) {
          break
        }
        hitsBySender.delete(oldestSender.value)
      }
      hitsBySender.set(senderJid, hits)
      return ALLOWED
    },
    size: () => hitsBySender.size,
    senders: () => [...hitsBySender.keys()],
    hitCount: (senderJid) => hitsBySender.get(senderJid)?.length ?? 0,
  }
}
