/** Read-only view of the allowlist; the router only ever asks. */
export interface GroupAllowlistView {
  has(chatJid: string): boolean
}

/**
 * The one command allowed inside a group that is not allowlisted yet, so the
 * owner can enable the group from within it. Core owns the name; the feature
 * imports it instead of the other way round.
 */
export const ALLOWLIST_COMMAND = 'access'

export type AccessDenialReason = 'private_not_owner' | 'group_not_allowlisted'

export type AccessDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: AccessDenialReason }

export interface AccessInput {
  readonly chatJid: string
  readonly isGroup: boolean
  readonly isOwner: boolean
  /** Canonical command name, never the alias the user typed. */
  readonly commandName: string
  readonly allowlist: GroupAllowlistView
}

const ALLOWED: AccessDecision = { allowed: true }

/**
 * Private mode (SECURITY.md): the bot answers only the owner in 1:1 chats, and
 * in groups only when the group is allowlisted. A non-allowlisted group stays
 * silent even for the owner — except for ALLOWLIST_COMMAND, which is how the
 * owner enables the group in the first place.
 */
export function evaluateAccess(input: AccessInput): AccessDecision {
  if (!input.isGroup) {
    return input.isOwner ? ALLOWED : { allowed: false, reason: 'private_not_owner' }
  }
  if (input.allowlist.has(input.chatJid)) return ALLOWED
  if (input.isOwner && input.commandName === ALLOWLIST_COMMAND) return ALLOWED
  return { allowed: false, reason: 'group_not_allowlisted' }
}
