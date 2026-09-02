import { describe, expect, it } from 'vitest'

import { createFloodGate } from '../../lib/commands/middleware/flood.js'
import type { Clock } from '../../lib/shared/clock.js'

const SENDER = '62800@s.whatsapp.net'

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

describe('createFloodGate', () => {
  it('mengizinkan pemanggilan di bawah limit', () => {
    const clock = createFakeClock()
    const gate = createFloodGate({ clock, limit: 3, windowMs: 10_000 })

    expect(gate.check(SENDER)).toEqual({ allowed: true })
    expect(gate.check(SENDER)).toEqual({ allowed: true })
    expect(gate.check(SENDER)).toEqual({ allowed: true })
  })

  it('memblokir pemanggilan di atas limit dengan remaining wait', () => {
    const clock = createFakeClock()
    const gate = createFloodGate({ clock, limit: 2, windowMs: 10_000 })

    gate.check(SENDER)
    clock.advance(1_000)
    gate.check(SENDER)
    clock.advance(1_000)

    // Slot tertua tercatat pada t=10_000 dan lepas pada t=20_000; sekarang t=12_000.
    expect(gate.check(SENDER)).toEqual({ allowed: false, retryAfterMs: 8_000 })
  })

  it('tidak mencampur sender berbeda', () => {
    const clock = createFakeClock()
    const gate = createFloodGate({ clock, limit: 1, windowMs: 10_000 })

    gate.check(SENDER)

    expect(gate.check('62801@s.whatsapp.net')).toEqual({ allowed: true })
  })

  it('window bergeser: slot lama lepas satu per satu', () => {
    const clock = createFakeClock()
    const gate = createFloodGate({ clock, limit: 2, windowMs: 10_000 })

    gate.check(SENDER)
    clock.advance(5_000)
    gate.check(SENDER)
    expect(gate.check(SENDER).allowed).toBe(false)

    // t=20_000: slot pertama (t=10_000) lepas, satu slot masih terpakai.
    clock.advance(5_000)
    expect(gate.check(SENDER)).toEqual({ allowed: true })
    expect(gate.check(SENDER).allowed).toBe(false)
  })

  it('memangkas sender kedaluwarsa sehingga map tidak tumbuh tanpa batas', () => {
    const clock = createFakeClock()
    const gate = createFloodGate({ clock, limit: 5, windowMs: 10_000 })

    for (let index = 0; index < 40; index += 1) {
      gate.check(`6280${String(index)}@s.whatsapp.net`)
    }
    expect(gate.size()).toBe(40)

    clock.advance(10_000)
    gate.check(SENDER)

    expect(gate.size()).toBe(1)
    expect(gate.senders()).toEqual([SENDER])
  })

  it('menegakkan maxSenders dengan membuang sender paling lama tercatat', () => {
    const clock = createFakeClock()
    const gate = createFloodGate({ clock, limit: 5, windowMs: 60_000, maxSenders: 2 })

    gate.check('a@s.whatsapp.net')
    gate.check('b@s.whatsapp.net')
    gate.check('c@s.whatsapp.net')

    expect(gate.size()).toBe(2)
    expect(gate.senders()).toEqual(['b@s.whatsapp.net', 'c@s.whatsapp.net'])
  })

  it('timestamp di luar window tidak menumpuk di dalam satu sender', () => {
    const clock = createFakeClock()
    const gate = createFloodGate({ clock, limit: 5, windowMs: 1_000 })

    for (let index = 0; index < 100; index += 1) {
      gate.check(SENDER)
      clock.advance(1_000)
    }

    expect(gate.hitCount(SENDER)).toBe(1)
  })
})
