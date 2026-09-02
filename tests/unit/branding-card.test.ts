import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { brandingCard } from '../../lib/messages/branding.js'

const ABSENT = path.join(tmpdir(), 'yzf-absent-thumbnail.jpg')

describe('brandingCard', () => {
  it('renders a large card for menu surfaces', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'yzf-branding-'))
    const thumbnailPath = path.join(directory, 'menu-thumbnail.jpg')
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0x01])
    await writeFile(thumbnailPath, bytes)

    try {
      expect(brandingCard(thumbnailPath, 'Owner Control', { large: true })).toEqual({
        title: 'YZF-BotWA',
        body: 'Owner Control',
        thumbnail: bytes,
        renderLargerThumbnail: true,
      })
      expect(brandingCard(thumbnailPath, 'Bot aktif')).toEqual({
        title: 'YZF-BotWA',
        body: 'Bot aktif',
        thumbnail: bytes,
        renderLargerThumbnail: false,
      })
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('returns undefined when no thumbnail is installed', () => {
    expect(brandingCard(ABSENT, 'x', { large: true })).toBeUndefined()
    expect(brandingCard(ABSENT, 'x')).toBeUndefined()
  })
})
