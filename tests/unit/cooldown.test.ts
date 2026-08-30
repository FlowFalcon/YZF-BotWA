import { describe, expect, it } from 'vitest'

import type { Command } from '../../src/commands/command.js'
import { createCooldownGate } from '../../src/commands/middleware/cooldown.js'
import { createCommandRegistry } from '../../src/commands/registry.js'
import type { Clock } from '../../src/shared/clock.js'

const SENDER = '62800@s.whatsapp.net'
const OTHER = '62801@s.whatsapp.net'

function buildCommand(overrides: Partial<Command> = {}): Command {
  return {
    name: 'dice',
    aliases: ['dadu'],
    category: 'fun',
    description: 'Melempar dadu.',
    cooldownMs: 3_000,
    run: () => Promise.resolve(),
    ...overrides,
  }
}

/** exactOptionalPropertyTypes melarang `cooldownMs: undefined`, jadi field-nya dihilangkan. */
function buildCommandWithoutCooldown(name = 'dice'): Command {
  return {
    name,
    aliases: ['dadu'],
    category: 'fun',
    description: 'Melempar dadu.',
    run: () => Promise.resolve(),
  }
}

/** Clock manual: cooldown tidak boleh memanggil Date.now() atau tidur sungguhan. */
function createFakeClock(start = 10_000): Clock & { advance(ms: number): void } {
  let current = start
  return {
    now: () => current,
    schedule: () => () => undefined,
    advance(ms) {
      current += ms
    },
  }
}

describe('createCooldownGate', () => {
  it('mengizinkan pemanggilan pertama', () => {
    const clock = createFakeClock()
    const gate = createCooldownGate({ clock, defaultCooldownMs: 0 })

    expect(gate.check(SENDER, buildCommand())).toEqual({ allowed: true })
  })

  it('memblokir pemanggilan ulang langsung dengan remaining ms', () => {
    const clock = createFakeClock()
    const gate = createCooldownGate({ clock, defaultCooldownMs: 0 })
    const command = buildCommand()

    gate.check(SENDER, command)
    clock.advance(1_000)

    expect(gate.check(SENDER, command)).toEqual({ allowed: false, retryAfterMs: 2_000 })
  })

  it('mengizinkan kembali setelah cooldown lewat', () => {
    const clock = createFakeClock()
    const gate = createCooldownGate({ clock, defaultCooldownMs: 0 })
    const command = buildCommand()

    gate.check(SENDER, command)
    clock.advance(3_000)

    expect(gate.check(SENDER, command)).toEqual({ allowed: true })
  })

  it('tidak mencampur sender berbeda', () => {
    const clock = createFakeClock()
    const gate = createCooldownGate({ clock, defaultCooldownMs: 0 })
    const command = buildCommand()

    gate.check(SENDER, command)

    expect(gate.check(OTHER, command)).toEqual({ allowed: true })
  })

  it('memakai defaultCooldownMs bila command tidak menetapkan cooldownMs', () => {
    const clock = createFakeClock()
    const gate = createCooldownGate({ clock, defaultCooldownMs: 2_000 })
    const command = buildCommandWithoutCooldown()

    gate.check(SENDER, command)

    expect(gate.check(SENDER, command)).toEqual({ allowed: false, retryAfterMs: 2_000 })
  })

  it('mengunci per canonical command, bukan alias yang diketik user', () => {
    const clock = createFakeClock()
    const gate = createCooldownGate({ clock, defaultCooldownMs: 0 })
    const registry = createCommandRegistry([buildCommand()])
    // Sender mengetik `.dice` lalu `.dadu`: dua trigger, satu canonical command.
    const viaName = registry.get('dice')
    const viaAlias = registry.get('dadu')
    expect(viaName).toBeDefined()
    expect(viaAlias).toBeDefined()
    if (viaName === undefined || viaAlias === undefined) {
      throw new Error('registry harus meresolve kedua trigger')
    }

    expect(gate.check(SENDER, viaName)).toEqual({ allowed: true })
    expect(gate.check(SENDER, viaAlias)).toEqual({ allowed: false, retryAfterMs: 3_000 })
    // Command lain dengan nama canonical berbeda punya cooldown terpisah.
    expect(gate.check(SENDER, buildCommand({ name: 'coinflip', aliases: ['koin'] }))).toEqual({
      allowed: true,
    })
    expect(gate.keys()).toEqual([`${SENDER}\u0000dice`, `${SENDER}\u0000coinflip`])
  })

  it('memangkas entry kedaluwarsa sehingga map tidak tumbuh tanpa batas', () => {
    const clock = createFakeClock()
    const gate = createCooldownGate({ clock, defaultCooldownMs: 1_000 })

    for (let index = 0; index < 50; index += 1) {
      gate.check(`6280${String(index)}@s.whatsapp.net`, buildCommandWithoutCooldown())
    }
    expect(gate.size()).toBe(50)

    clock.advance(1_000)
    gate.check(SENDER, buildCommandWithoutCooldown())

    expect(gate.size()).toBe(1)
  })

  it('menegakkan maxEntries dengan membuang entry paling cepat kedaluwarsa', () => {
    const clock = createFakeClock()
    const gate = createCooldownGate({ clock, defaultCooldownMs: 60_000, maxEntries: 2 })

    gate.check('a@s.whatsapp.net', buildCommandWithoutCooldown())
    gate.check('b@s.whatsapp.net', buildCommandWithoutCooldown())
    gate.check('c@s.whatsapp.net', buildCommandWithoutCooldown())

    expect(gate.size()).toBe(2)
    expect(gate.keys()).toEqual(['b@s.whatsapp.net\u0000dice', 'c@s.whatsapp.net\u0000dice'])
  })
})
