import { describe, expect, it } from 'vitest'

import type { Command } from '../../lib/commands/command.js'
import { createCommandRegistry } from '../../lib/commands/registry.js'
import { createReloadableRegistry } from '../../lib/commands/reloadable-registry.js'

function command(name: string, aliases: readonly string[] = []): Command {
  return { name, aliases, category: 'tools', description: name, run: async () => {} }
}

describe('createReloadableRegistry', () => {
  it('publishes a complete candidate atomically', async () => {
    const active = createReloadableRegistry(
      createCommandRegistry([command('ping')]),
      () => Promise.resolve(createCommandRegistry([command('menu')])),
    )

    const change = await active.reload()

    expect(change).toEqual({ added: 1, removed: 1 })
    expect(active.get('ping')).toBeUndefined()
    expect(active.get('menu')?.name).toBe('menu')
  })

  it('retains the old registry when a candidate is broken', async () => {
    const active = createReloadableRegistry(
      createCommandRegistry([command('ping')]),
      () => Promise.reject(new Error('broken plugin')),
    )

    await expect(active.reload()).rejects.toThrow('broken plugin')
    expect(active.get('ping')?.name).toBe('ping')
  })

  it('retains the old registry when a candidate has duplicate triggers', async () => {
    const active = createReloadableRegistry(
      createCommandRegistry([command('ping')]),
      () => Promise.resolve(createCommandRegistry([command('menu'), command('other', ['menu'])])),
    )

    await expect(active.reload()).rejects.toThrow('Duplicate trigger "menu"')
    expect(active.get('ping')?.name).toBe('ping')
  })
})
