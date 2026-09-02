import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import type { CommandContext } from '../../../lib/commands/command.js'
import ownermenu from '../../../plugins/owner/ownermenu.js'
import type { RichInteractiveContent } from '../../../lib/messages/rich.js'

function harness(menuThumbnailPath = path.join(tmpdir(), 'yzf-absent-thumbnail.jpg')) {
  const cards: RichInteractiveContent[] = []
  const context = {
    isOwner: true,
    isGroup: false,
    prefix: '.',
    args: [],
    menuThumbnailPath,
    replyContent: (content: RichInteractiveContent) => { cards.push(content); return Promise.resolve() },
  } as unknown as CommandContext
  return { context, cards }
}

describe('ownermenu command', () => {
  it('uses buttons only for actions that can complete from a tap', async () => {
    const { context, cards } = harness()

    await ownermenu.run(context)

    expect(ownermenu.permission).toBe('owner')
    const body = cards[0]?.interactiveMessage.body.text ?? ''
    expect(body).toContain('Owner Menu')
    expect(body).toContain('.setname <nama>')
    expect(body).toContain('.setabout <teks>')
    expect(body).toContain('.setpp')
    expect(body).toContain('.setthumbnail')
    const buttons = cards[0]?.interactiveMessage.nativeFlowMessage.buttons ?? []
    const parsed = buttons.map((button): unknown => JSON.parse(button.buttonParamsJson))
    expect(parsed).toEqual([
      { display_text: 'Bot Mode', id: '.botmode' },
      { display_text: 'Main Menu', id: '.menu' },
    ])
  })

  it('carries the installed thumbnail as an externalAdReply card', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'yzf-ownermenu-'))
    const thumbnailPath = path.join(directory, 'menu-thumbnail.jpg')
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0x11])
    await writeFile(thumbnailPath, bytes)

    try {
      const { context, cards } = harness(thumbnailPath)
      await ownermenu.run(context)

      expect(cards[0]?.interactiveMessage.contextInfo?.externalAdReply.thumbnail).toEqual(bytes)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
