import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { loadCommands } from '../../lib/commands/loader.js'

const PLUGINS_DIR = path.resolve(import.meta.dirname, '../../plugins')

describe('public command surface', () => {
  it('discovers exactly the v0.0.1 command surface', async () => {
    const registry = await loadCommands(PLUGINS_DIR, { extension: '.ts' })

    expect(registry.list().map((command) => command.name).sort()).toEqual([
      'botmode',
      'delpp',
      'delthumbnail',
      'dino',
      'menu',
      'ownermenu',
      'ping',
      'setabout',
      'setname',
      'setpp',
      'setthumbnail',
      'sticker',
    ])
    for (const removed of ['v4', 'raw', 'coinflip', 'dice', 'rate', 'eightball', 'tebakangka', 'suit', 'panel', 'access']) {
      expect(registry.get(removed)).toBeUndefined()
    }
  })
})
