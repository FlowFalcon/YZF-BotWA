import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import type { CommandContext } from '../../../lib/commands/command.js'
import type { RichInteractiveContent } from '../../../lib/messages/rich.js'
import botmode from '../../../plugins/owner/botmode.js'
import type { BotMode, SettingsStore } from '../../../lib/settings.js'

function harness(initialMode: BotMode = 'owner-only', args: readonly string[] = []) {
  let mode: BotMode = initialMode
  const settings: SettingsStore = {
    getMode: () => mode,
    setMode: (next) => {
      mode = next
      return Promise.resolve()
    },
  }
  const replies: string[] = []
  const cards: RichInteractiveContent[] = []
  const context = {
    chatJid: '6289876543210@s.whatsapp.net',
    senderJid: '6289876543210@s.whatsapp.net',
    isGroup: false,
    isOwner: true,
    prefix: '.',
    commandName: 'botmode',
    args,
    text: args.join(' '),
    receivedAtMs: 1_000,
    now: () => 1_000,
    random: () => 0.5,
    reply: (text: string) => {
      replies.push(text)
      return Promise.resolve()
    },
    replyContent: (content: RichInteractiveContent) => {
      cards.push(content)
      return Promise.resolve()
    },
    replyMedia: () => Promise.resolve(),
    replyAIRich: () => Promise.resolve(),
    react: () => Promise.resolve(),
    settings,
    commands: { list: () => [] },
    menuThumbnailPath: path.join(tmpdir(), 'yzf-absent-thumbnail.jpg'),
  } as unknown as CommandContext

  return { settings, replies, cards, context }
}

function cardButtonIds(card: RichInteractiveContent): string[] {
  return card.interactiveMessage.nativeFlowMessage.buttons.map((button) => {
    const value = JSON.parse(button.buttonParamsJson) as { readonly id?: string }
    return value.id ?? ''
  })
}

describe('botmode command', () => {
  it('is owner-only', () => {
    expect(botmode.permission).toBe('owner')
  })

  it('offers only the modes that would actually change state, plus navigation', async () => {
    const h = harness()

    await botmode.run(h.context)

    const card = h.cards[0]
    expect(card?.interactiveMessage.body.text).toContain('owner-only')
    expect(card).toBeDefined()
    if (card !== undefined) {
      // The active mode is omitted: tapping it would be a no-op button.
      expect(cardButtonIds(card)).toEqual([
        '.botmode public',
        '.botmode group-only',
        '.ownermenu',
      ])
    }
  })

  it('changes the mode and confirms via reply', async () => {
    const h = harness('owner-only', ['public'])

    await botmode.run(h.context)

    expect(h.settings.getMode()).toBe('public')
    expect(h.replies).toEqual(['Mode bot diubah ke public.'])
  })

  it('rejects an invalid mode with usage instructions', async () => {
    const h = harness('owner-only', ['invalid-mode'])

    await botmode.run(h.context)

    expect(h.settings.getMode()).toBe('owner-only')
    expect(h.replies[0]).toContain('.botmode public')
  })

  it('rejects extra arguments without changing settings', async () => {
    const h = harness('owner-only', ['public', 'anything'])
    await botmode.run(h.context)
    expect(h.settings.getMode()).toBe('owner-only')
    expect(h.replies[0]).toContain('.botmode public')
  })
})
