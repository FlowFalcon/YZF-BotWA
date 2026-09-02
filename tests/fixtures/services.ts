import type { CommandListing } from '../../lib/commands/command.js'
import type { SettingsView } from '../../lib/settings.js'
import type { BotMode } from '../../lib/settings.js'

export function fakeSettings(mode: BotMode = 'owner-only'): SettingsView {
  return { getMode: () => mode }
}

export function fakeCommands(): CommandListing {
  return { list: () => [] }
}
