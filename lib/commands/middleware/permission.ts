import type { Command } from '../command.js'

export type PermissionDenialReason = 'owner_only'

export type PermissionDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: PermissionDenialReason }

const ALLOWED: PermissionDecision = { allowed: true }

/**
 * COMMAND_SPEC §5 langkah 5: permission diperiksa sebelum flood dan cooldown.
 * Fungsi ini murni dan tidak menyentuh state cooldown, sehingga penolakan
 * permission tidak mungkin mengonsumsi cooldown sender.
 */
export function checkPermission(command: Command, isOwner: boolean): PermissionDecision {
  if ((command.permission ?? 'everyone') === 'everyone') {
    return ALLOWED
  }
  return isOwner ? ALLOWED : { allowed: false, reason: 'owner_only' }
}
