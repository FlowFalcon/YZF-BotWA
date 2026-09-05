import type { Command } from '../command.js'
import type { Clock } from '../../shared/clock.js'

export type CooldownDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly retryAfterMs: number }

export interface CooldownOptions {
  readonly clock: Clock
  /** Dipakai saat command tidak menetapkan `cooldownMs` (COMMAND_SPEC §1). */
  readonly defaultCooldownMs: number
  readonly maxEntries?: number
}

export interface CooldownGate {
  /** Check-and-set sinkron: tidak ada await antara baca dan tulis, jadi atomic per turn. */
  check(senderJid: string, command: Command): CooldownDecision
  size(): number
  keys(): readonly string[]
}

const DEFAULT_MAX_ENTRIES = 5_000
// NUL tidak muncul pada JID maupun nama command valid, jadi key tidak bisa bertabrakan.
const KEY_SEPARATOR = '\u0000'

const ALLOWED: CooldownDecision = { allowed: true }

export function createCooldownGate(options: CooldownOptions): CooldownGate {
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES
  /** key -> epoch ms saat cooldown berakhir. Insertion order dipakai untuk eviction. */
  const expiryByKey = new Map<string, number>()

  function prune(nowMs: number): void {
    for (const [key, expiresAtMs] of expiryByKey) {
      if (expiresAtMs <= nowMs) {
        expiryByKey.delete(key)
      }
    }
  }

  return {
    check(senderJid, command) {
      // Key memakai command.name (canonical), bukan trigger/alias yang diketik user:
      // SECURITY.md §4 mengharuskan cooldown per sender + canonical command.
      const key = `${senderJid}${KEY_SEPARATOR}${command.name}`
      const nowMs = options.clock.now()
      const expiresAtMs = expiryByKey.get(key)
      if (expiresAtMs !== undefined && expiresAtMs > nowMs) {
        return { allowed: false, retryAfterMs: expiresAtMs - nowMs }
      }

      const cooldownMs = command.cooldownMs ?? options.defaultCooldownMs
      // prune dulu supaya entry kedaluwarsa tidak ikut menghitung batas ukuran.
      prune(nowMs)
      if (cooldownMs > 0) {
        // Insertion order cukup untuk batas entry saat ini; tidak perlu heap expiry.
        while (expiryByKey.size >= maxEntries) {
          const oldest = expiryByKey.keys().next()
          if (oldest.done === true) {
            break
          }
          expiryByKey.delete(oldest.value)
        }
        // delete sebelum set supaya key yang diperbarui pindah ke akhir insertion order.
        expiryByKey.delete(key)
        expiryByKey.set(key, nowMs + cooldownMs)
      }
      return ALLOWED
    },
    size: () => expiryByKey.size,
    keys: () => [...expiryByKey.keys()],
  }
}
