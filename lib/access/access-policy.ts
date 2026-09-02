import type { BotMode } from '../settings.js'

export const BOTMODE_COMMAND = 'botmode'

export type AccessDenialReason = 'private_not_group' | 'owner_only'

export type AccessDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: AccessDenialReason }

export interface AccessInput {
  readonly mode: BotMode
  readonly isGroup: boolean
  readonly isOwner: boolean
  /** Canonical command name, never the alias the user typed. */
  readonly commandName: string
}

const ALLOWED: AccessDecision = { allowed: true }

export function evaluateAccess(input: AccessInput): AccessDecision {
  if (input.isOwner && input.commandName === BOTMODE_COMMAND) return ALLOWED

  switch (input.mode) {
    case 'public':
      return ALLOWED
    case 'group-only':
      return input.isGroup || input.isOwner
        ? ALLOWED
        : { allowed: false, reason: 'private_not_group' }
    case 'owner-only':
      return input.isOwner ? ALLOWED : { allowed: false, reason: 'owner_only' }
  }
}
