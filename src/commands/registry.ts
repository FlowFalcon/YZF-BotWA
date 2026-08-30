import type { Command } from './command.js'
import { commandTriggers, validateCommandMetadata } from './command.js'

export interface CommandRegistry {
  get(trigger: string): Command | undefined
  list(): readonly Command[]
}

/**
 * Validasi seluruh command sebelum publish: registry hanya terbentuk bila
 * semua metadata valid dan tidak ada trigger duplikat (COMMAND_SPEC §4).
 */
export function createCommandRegistry(commands: readonly Command[]): CommandRegistry {
  for (const command of commands) {
    validateCommandMetadata(command)
  }

  const byTrigger = new Map<string, Command>()
  for (const command of commands) {
    for (const trigger of commandTriggers(command)) {
      const owner = byTrigger.get(trigger)
      if (owner !== undefined) {
        throw new Error(
          `Duplicate trigger "${trigger}" dari command "${owner.name}" dan "${command.name}".`,
        )
      }
      byTrigger.set(trigger, command)
    }
  }

  const canonical = [...commands].sort(
    (left, right) =>
      left.category.localeCompare(right.category) || left.name.localeCompare(right.name),
  )

  return {
    get: (trigger) => byTrigger.get(trigger),
    list: () => canonical,
  }
}
