import { describe, expect, it } from 'vitest'

import type { Command } from '../../../lib/commands/command.js'
import menu from '../../../plugins/tools/menu.js'
import ownermenu from '../../../plugins/owner/ownermenu.js'
import groupmenu from '../../../plugins/group/groupmenu.js'
import type { ReplyCardOptions } from '../../../lib/commands/command.js'
import { fakeContext } from '../../fixtures/context.js'

/** Box-drawing characters the old menu used; the text menu must not reintroduce them. */
const BORDER_CHARS = /[╭╮╰╯├┤─│]/

function testCommand(
  name: string,
  category: Command['category'] = 'tools',
  permission?: Command['permission'],
): Command {
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
  testCommand('qrcode', 'tools'),
  testCommand('sticker', 'sticker'),
  testCommand('dino', 'games'),
  testCommand('kick', 'group'),
  testCommand('ownermenu', 'owner', 'owner'),
  testCommand('ban', 'owner', 'owner'),
]

function harness(parts: {
  readonly isOwner?: boolean
  readonly isGroup?: boolean
  readonly pushName?: string
} = {}) {
  const cards: { text: string; options?: ReplyCardOptions }[] = []
  const plain: string[] = []
  const interactive: unknown[] = []
  const context = fakeContext({
    senderJid: '628123456789@s.whatsapp.net',
    senderNumber: '628123456789',
    pushName: parts.pushName ?? 'TestUser',
    isGroup: parts.isGroup ?? false,
    isOwner: parts.isOwner ?? false,
    commandName: 'menu',
    commands: { list: () => mockCommands },
    Reply: (text, options) => {
      cards.push({ text, ...(options === undefined ? {} : { options }) })
      return Promise.resolve()
    },
    reply: (text) => {
      plain.push(text)
      return Promise.resolve()
    },
    replyContent: (content) => {
      interactive.push(content)
      return Promise.resolve()
    },
  })
  return { context, cards, plain, interactive }
}

describe('menu', () => {
  it('sends the categorized listing as an HQ card, never an interactive payload', async () => {
    const h = harness({ pushName: 'Fathur' })

    await menu.run(h.context)

    expect(h.cards.length).toBe(1)
    expect(h.interactive).toEqual([])
    const [card] = h.cards
    expect(card?.text).toContain('YZF-BotWA')
    expect(card?.text).toContain('Fathur')
    expect(card?.text).toContain('628123456789')
  })

  it('groups commands under their category headings', async () => {
    const h = harness()

    await menu.run(h.context)

    const text = h.cards[0]?.text ?? ''
    expect(text).toContain('TOOLS')
    expect(text).toContain('STICKER')
    expect(text).toContain('GAMES')
    expect(text).toContain('GROUP')
    expect(text).toContain('.qrcode')
    expect(text).toContain('.sticker')
    expect(text).toContain('.kick')
  })

  it('renders without box-drawing borders', async () => {
    const h = harness({ isOwner: true, isGroup: true })

    await menu.run(h.context)

    expect(h.cards[0]?.text ?? '').not.toMatch(BORDER_CHARS)
  })

  it('hides owner commands from non-owners', async () => {
    const user = harness()
    const owner = harness({ isOwner: true })

    await menu.run(user.context)
    await menu.run(owner.context)

    expect(user.cards[0]?.text ?? '').not.toContain('OWNER')
    expect(user.cards[0]?.text ?? '').not.toContain('.ban')
    expect(owner.cards[0]?.text ?? '').toContain('OWNER')
    expect(owner.cards[0]?.text ?? '').toContain('.ban')
  })

  it('shows the chat kind and active mode', async () => {
    const h = harness({ isGroup: true })

    await menu.run(h.context)

    const text = h.cards[0]?.text ?? ''
    expect(text).toContain('Group')
    expect(text).toContain('owner-only')
  })

  it('points to the sub-menus', async () => {
    const h = harness()

    await menu.run(h.context)

    const text = h.cards[0]?.text ?? ''
    expect(text).toContain('.groupmenu')
  })
})

describe('ownermenu', () => {
  it('lists owner commands as text without buttons', async () => {
    const h = harness({ isOwner: true })

    await ownermenu.run(h.context)

    expect(h.interactive).toEqual([])
    const text = h.cards[0]?.text ?? ''
    expect(text).toContain('Owner')
    expect(text).toContain('.botmode')
    expect(text).toContain('.ban')
    expect(text).toContain('.setthumbnail')
  })

  it('does not offer a premium tier', async () => {
    const h = harness({ isOwner: true })

    await ownermenu.run(h.context)

    expect((h.cards[0]?.text ?? '').toLowerCase()).not.toContain('premium')
  })
})

describe('groupmenu', () => {
  it('lists group commands as text without buttons', async () => {
    const h = harness()

    await groupmenu.run(h.context)

    expect(h.interactive).toEqual([])
    const text = h.cards[0]?.text ?? ''
    expect(text).toContain('.kick')
    expect(text).toContain('.promote')
    expect(text).toContain('.hidetag')
    expect(text).toContain('.linkgroup')
  })

  it('states that these commands need group admin', async () => {
    const h = harness()

    await groupmenu.run(h.context)

    expect((h.cards[0]?.text ?? '').toLowerCase()).toContain('admin')
  })
})
