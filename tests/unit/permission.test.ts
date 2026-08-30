import { describe, expect, it } from 'vitest'

import type { Command } from '../../src/commands/command.js'
import { createCooldownGate } from '../../src/commands/middleware/cooldown.js'
import { checkPermission } from '../../src/commands/middleware/permission.js'
import type { Clock } from '../../src/shared/clock.js'

function buildCommand(overrides: Partial<Command> = {}): Command {
  return {
    name: 'ping',
    category: 'general',
    description: 'Membalas pong.',
    run: () => Promise.resolve(),
    ...overrides,
  }
}

const frozenClock: Clock = {
  now: () => 1_000,
  schedule: () => () => undefined,
}

describe('checkPermission', () => {
  it('mengizinkan command tanpa permission untuk non-owner', () => {
    expect(checkPermission(buildCommand(), false)).toEqual({ allowed: true })
  })

  it('mengizinkan permission everyone untuk non-owner', () => {
    expect(checkPermission(buildCommand({ permission: 'everyone' }), false)).toEqual({
      allowed: true,
    })
  })

  it('menolak command owner untuk non-owner', () => {
    expect(checkPermission(buildCommand({ permission: 'owner' }), false)).toEqual({
      allowed: false,
      reason: 'owner_only',
    })
  })

  it('mengizinkan command owner untuk owner', () => {
    expect(checkPermission(buildCommand({ permission: 'owner' }), true)).toEqual({ allowed: true })
  })

  it('permission failure tidak mengonsumsi cooldown', () => {
    const command = buildCommand({ permission: 'owner', cooldownMs: 5_000 })
    const cooldown = createCooldownGate({ clock: frozenClock, defaultCooldownMs: 0 })

    const decision = checkPermission(command, false)

    expect(decision.allowed).toBe(false)
    // checkPermission tidak menerima gate cooldown, jadi state cooldown wajib masih kosong.
    expect(cooldown.size()).toBe(0)
    expect(cooldown.check('62800@s.whatsapp.net', command)).toEqual({ allowed: true })
  })
})
