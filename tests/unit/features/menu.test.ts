import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import { describe, expect, it } from 'vitest'

import type { Command, CommandContext } from '../../../lib/commands/command.js'
import menu from '../../../plugins/tools/menu.js'
import type { RichInteractiveContent } from '../../../lib/messages/rich.js'
import { createProfileBrandingService } from '../../../lib/profile/branding.js'

/** Box-drawing characters the old menu used; the compact menu must not reintroduce them. */
const BORDER_CHARS = /[╭╮╰╯├┤─│]/

function testCommand(name: string, category: Command['category'] = 'tools', permission?: Command['permission']): Command {
  return {
    name,
    category,
    description: `${name} command`,
    ...(permission === undefined ? {} : { permission }),
    run: async () => {},
  }
}

const mockCommands: readonly Command[] = [
  testCommand('menu', 'tools'),
  testCommand('sticker', 'sticker'),
  testCommand('dino', 'games'),
  testCommand('ownermenu', 'owner', 'owner'),
]

function harness(parts: { readonly isOwner?: boolean; readonly isGroup?: boolean; readonly pushName?: string; readonly menuThumbnailPath?: string } = {}) {
  const cards: RichInteractiveContent[] = []
  const context = {
    chatJid: 'chat@s.whatsapp.net',
    senderJid: '628123456789@s.whatsapp.net',
    senderNumber: '628123456789',
    pushName: parts.pushName ?? 'TestUser',
    isGroup: parts.isGroup ?? false,
    isOwner: parts.isOwner ?? false,
    prefix: '.',
    commandName: 'menu',
    args: [],
    text: '',
    receivedAtMs: 0,
    now: () => 0,
    random: () => 0,
    reply: () => Promise.resolve(),
    replyContent: (content: RichInteractiveContent) => { cards.push(content); return Promise.resolve() },
    replyMedia: () => Promise.resolve(),
    replyAIRich: () => Promise.resolve(),
    settings: { getMode: () => 'owner-only' },
    commands: { list: () => mockCommands },
    menuThumbnailPath: parts.menuThumbnailPath ?? '.auth/assets/menu-thumbnail.jpg',
    react: () => Promise.resolve(),
  } as CommandContext
  return { context, cards }
}

function buttons(card: RichInteractiveContent): readonly { readonly text: string; readonly id: string }[] {
  return card.interactiveMessage.nativeFlowMessage.buttons.map((button) => {
    const value = JSON.parse(button.buttonParamsJson) as {
      readonly display_text?: string
      readonly id?: string
    }
    return { text: value.display_text ?? '', id: value.id ?? '' }
  })
}

describe('menu command', () => {
  it('displays user info, bot status, and full command categories', async () => {
    const h = harness({ pushName: 'Fathur' })

    await menu.run(h.context)

    const card = h.cards[0] as RichInteractiveContent
    const text = card.interactiveMessage.body.text
    expect(text).toContain('YZF-BotWA')
    expect(text).toContain('Fathur')
    expect(text).toContain('628123456789')
    expect(text).toContain('STICKER')
    expect(text).toContain('TOOLS')
    expect(text).toContain('GAMES')
    expect(text).toContain('.sticker')
    expect(text).toContain('.dino')
  })

  it('renders compact text without box-drawing borders', async () => {
    const h = harness({ isOwner: true, isGroup: true })

    await menu.run(h.context)

    const text = (h.cards[0] as RichInteractiveContent).interactiveMessage.body.text
    expect(text).not.toMatch(BORDER_CHARS)
  })

  it('offers only one-tap commands as buttons', async () => {
    const h = harness({ isOwner: true })

    await menu.run(h.context)

    const ids = buttons(h.cards[0] as RichInteractiveContent).map((button) => button.id)
    expect(ids).toEqual(['.ownermenu', '.ping', '.dino'])
    // `.sticker` needs an attachment, so a tap could never complete it.
    expect(ids).not.toContain('.sticker')
  })

  it('shows Owner section and Owner button only to the owner', async () => {
    const user = harness()
    const owner = harness({ isOwner: true })

    await menu.run(user.context)
    await menu.run(owner.context)

    const userText = (user.cards[0] as RichInteractiveContent).interactiveMessage.body.text
    const ownerText = (owner.cards[0] as RichInteractiveContent).interactiveMessage.body.text

    expect(userText).not.toContain('OWNER')
    expect(ownerText).toContain('OWNER')
    expect(buttons(user.cards[0] as RichInteractiveContent).map((b) => b.id)).not.toContain('.ownermenu')
    expect(buttons(owner.cards[0] as RichInteractiveContent).map((b) => b.id)).toContain('.ownermenu')
  })

  it('shows group status when invoked inside a group', async () => {
    const groupChat = harness({ isGroup: true })

    await menu.run(groupChat.context)

    const text = (groupChat.cards[0] as RichInteractiveContent).interactiveMessage.body.text
    expect(text).toContain('Group')
  })

  it('sends the setthumbnail image as an externalAdReply card, not a native header', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'zapo-menu-thumbnail-'))
    const thumbnailPath = path.join(directory, 'assets', 'menu-thumbnail.jpg')
    const thumbnail = new Uint8Array([0xff, 0xd8, 0xff, 0x42])
    const service = createProfileBrandingService({
      profile: {
        setPushName: () => Promise.resolve(),
        setProfilePicture: () => Promise.resolve(null),
        deleteProfilePicture: () => Promise.resolve(),
        setStatus: () => Promise.resolve(),
      },
      download: () => Promise.resolve(Readable.from([thumbnail])),
      resize: (bytes) => Promise.resolve(bytes),
      thumbnailPath,
    })

    try {
      await service.setThumbnail({ imageMessage: { mimetype: 'image/jpeg' } })
      const writtenThumbnail = new Uint8Array(await readFile(thumbnailPath))
      const h = harness({ menuThumbnailPath: thumbnailPath })
      await menu.run(h.context)

      const card = (h.cards[0] as RichInteractiveContent).interactiveMessage
      expect(card.contextInfo?.externalAdReply.thumbnail).toEqual(writtenThumbnail)
      expect(card.contextInfo?.externalAdReply.title).toBe('YZF-BotWA')
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('omits the ad card when no thumbnail is installed', async () => {
    const h = harness({ menuThumbnailPath: path.join(tmpdir(), 'yzf-missing-thumbnail.jpg') })

    await menu.run(h.context)

    expect((h.cards[0] as RichInteractiveContent).interactiveMessage.contextInfo).toBeUndefined()
  })
})
