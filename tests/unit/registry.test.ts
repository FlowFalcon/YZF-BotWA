import { describe, expect, it } from 'vitest'

import type { Command } from '../../lib/commands/command.js'
import { createCommandRegistry } from '../../lib/commands/registry.js'

function makeCommand(overrides: Partial<Command> & Pick<Command, 'name'>): Command {
  return {
    category: 'tools',
    description: 'Deskripsi singkat.',
    run: async () => {},
    ...overrides,
  }
}

describe('createCommandRegistry', () => {
  it('registers valid commands and resolves them by name', () => {
    const ping = makeCommand({ name: 'ping' })
    const registry = createCommandRegistry([ping])

    expect(registry.get('ping')).toBe(ping)
    expect(registry.get('unknown')).toBeUndefined()
  })

  it('rejects an invalid command name', () => {
    expect(() => createCommandRegistry([makeCommand({ name: 'Ping!' })])).toThrow(/Ping!/)
  })

  it('rejects an invalid alias', () => {
    expect(() =>
      createCommandRegistry([makeCommand({ name: 'ping', aliases: ['-p'] })]),
    ).toThrow(/-p/)
  })

  it('rejects an empty description', () => {
    expect(() => createCommandRegistry([makeCommand({ name: 'ping', description: '  ' })])).toThrow(
      /description/,
    )
  })

  it('rejects an unknown category', () => {
    const rogue = { ...makeCommand({ name: 'ping' }), category: 'chaos' } as unknown as Command
    expect(() => createCommandRegistry([rogue])).toThrow(/category/)
  })

  it('rejects a negative cooldown', () => {
    expect(() => createCommandRegistry([makeCommand({ name: 'ping', cooldownMs: -1 })])).toThrow(
      /cooldownMs/,
    )
  })

  it('rejects a duplicate name against another name, naming both sources', () => {
    expect(() =>
      createCommandRegistry([makeCommand({ name: 'ping' }), makeCommand({ name: 'ping' })]),
    ).toThrow(/ping/)
  })

  it('rejects a name colliding with an existing alias', () => {
    expect(() =>
      createCommandRegistry([
        makeCommand({ name: 'ping', aliases: ['dice'] }),
        makeCommand({ name: 'dice' }),
      ]),
    ).toThrow(/dice.*ping.*dice|dice/)
  })

  it('rejects a duplicate alias against another alias', () => {
    let message = ''
    try {
      createCommandRegistry([
        makeCommand({ name: 'ping', aliases: ['p'] }),
        makeCommand({ name: 'pong', aliases: ['p'] }),
      ])
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }

    expect(message).toContain('"p"')
    expect(message).toContain('ping')
    expect(message).toContain('pong')
  })

  it('does not publish anything when one command is invalid', () => {
    expect(() =>
      createCommandRegistry([
        makeCommand({ name: 'ping' }),
        makeCommand({ name: 'bad name' }),
      ]),
    ).toThrow()
  })

  it('resolves an alias to the canonical command', () => {
    const menu = makeCommand({ name: 'menu', aliases: ['help'] })
    const registry = createCommandRegistry([menu])

    expect(registry.get('help')).toBe(menu)
    expect(registry.get('menu')).toBe(menu)
  })

  it('lists canonical commands only, sorted by category then name', () => {
    const registry = createCommandRegistry([
      makeCommand({ name: 'ping', aliases: ['p'], category: 'tools' }),
      makeCommand({ name: 'dice', aliases: ['dadu'], category: 'games' }),
      makeCommand({ name: 'menu', aliases: ['help'], category: 'tools' }),
      makeCommand({ name: 'coinflip', category: 'games' }),
    ])

    expect(registry.list().map((command) => command.name)).toEqual([
      'coinflip',
      'dice',
      'menu',
      'ping',
    ])
  })
})
