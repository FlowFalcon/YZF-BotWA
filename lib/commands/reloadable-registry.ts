import type { CommandRegistry } from './registry.js'

export interface RegistryChange {
  readonly added: number
  readonly removed: number
}

export interface ReloadableRegistry extends CommandRegistry {
  reload(): Promise<RegistryChange>
}

export function createReloadableRegistry(
  initial: CommandRegistry,
  buildCandidate: () => Promise<CommandRegistry>,
): ReloadableRegistry {
  let current = initial

  return {
    get: (trigger) => current.get(trigger),
    list: () => current.list(),
    reload: async () => {
      const candidate = await buildCandidate()
      const before = new Set(current.list().map((command) => command.name))
      const after = new Set(candidate.list().map((command) => command.name))
      const change = {
        added: [...after].filter((name) => !before.has(name)).length,
        removed: [...before].filter((name) => !after.has(name)).length,
      }
      current = candidate
      return change
    },
  }
}
