import { describe, expect, it } from 'vitest'

import { BOTMODE_COMMAND, evaluateAccess } from '../../lib/access/access-policy.js'
import type { BotMode } from '../../lib/settings.js'

interface MatrixRow {
  readonly mode: BotMode
  readonly isGroup: boolean
  readonly isOwner: boolean
  readonly allowed: boolean
}

const rows: readonly MatrixRow[] = [
  { mode: 'public', isGroup: false, isOwner: false, allowed: true },
  { mode: 'public', isGroup: false, isOwner: true, allowed: true },
  { mode: 'public', isGroup: true, isOwner: false, allowed: true },
  { mode: 'public', isGroup: true, isOwner: true, allowed: true },
  { mode: 'group-only', isGroup: false, isOwner: false, allowed: false },
  { mode: 'group-only', isGroup: false, isOwner: true, allowed: true },
  { mode: 'group-only', isGroup: true, isOwner: false, allowed: true },
  { mode: 'group-only', isGroup: true, isOwner: true, allowed: true },
  { mode: 'owner-only', isGroup: false, isOwner: false, allowed: false },
  { mode: 'owner-only', isGroup: false, isOwner: true, allowed: true },
  { mode: 'owner-only', isGroup: true, isOwner: false, allowed: false },
  { mode: 'owner-only', isGroup: true, isOwner: true, allowed: true },
]

describe('evaluateAccess', () => {
  it.each(rows)('$mode group=$isGroup owner=$isOwner -> $allowed', (row) => {
    const decision = evaluateAccess({
      mode: row.mode,
      isGroup: row.isGroup,
      isOwner: row.isOwner,
      commandName: 'ping',
    })

    expect(decision.allowed).toBe(row.allowed)
  })

  it.each(['public', 'group-only', 'owner-only'] as const)(
    'keeps the owner botmode emergency path open in %s mode',
    (mode) => {
      expect(
        evaluateAccess({ mode, isGroup: false, isOwner: true, commandName: BOTMODE_COMMAND }),
      ).toEqual({ allowed: true })
    },
  )

  it('does not open the emergency path to non-owners', () => {
    expect(
      evaluateAccess({
        mode: 'owner-only',
        isGroup: false,
        isOwner: false,
        commandName: BOTMODE_COMMAND,
      }),
    ).toEqual({ allowed: false, reason: 'owner_only' })
  })
})
