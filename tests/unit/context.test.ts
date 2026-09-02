import { describe, expect, it } from 'vitest'
import type { WaSendMessageContent } from 'zapo-js'
import { createCommandContext } from '../../lib/messages/context.js'
import type { MessageSender } from '../../lib/messages/context.js'
import type { ParsedCommand } from '../../lib/commands/parser.js'
import {
  htmlPrimitiveMessage,
  htmlPrimitiveSendOptions,
  type AIRichSendOptions,
} from '../../lib/messages/ai-rich.js'
import {
  GROUP_JID,
  PEER_LID_JID,
  PEER_PN_JID,
  groupPnParticipantEvent,
  privatePnEvent,
  textMessage,
} from '../fixtures/messages.js'
import { fakeSettings, fakeCommands } from '../fixtures/services.js'

interface SentMessage {
  readonly to: string
  readonly content: WaSendMessageContent
  readonly options?: AIRichSendOptions
}

function fakeSender(): { sender: MessageSender; sent: SentMessage[] } {
  const sent: SentMessage[] = []
  const sender: MessageSender = {
    message: {
      send: (to, content, options) => {
        sent.push({ to, content, ...(options === undefined ? {} : { options }) })
        return Promise.resolve()
      },
    },
  }
  return { sender, sent }
}

const parsed: ParsedCommand = { prefix: '.', name: 'ping', args: [], text: '' }

describe('createCommandContext', () => {
  it('sends a private reply to the peer chat', async () => {
    const { sender, sent } = fakeSender()
    const context = createCommandContext({
      event: privatePnEvent(textMessage('.ping')),
      parsed,
      sender,
      clock: { now: () => 1_000, schedule: () => () => undefined },
      random: { next: () => 0.5 },
      settings: fakeSettings(),
      commands: fakeCommands(),
      menuThumbnailPath: '.auth/assets/menu-thumbnail.jpg',
    })

    await context.reply('pong')

    expect(sent).toEqual([{ to: PEER_PN_JID, content: 'pong' }])
  })

  it('sends a group reply to the group JID, not the participant', async () => {
    const { sender, sent } = fakeSender()
    const context = createCommandContext({
      event: groupPnParticipantEvent(textMessage('.ping')),
      parsed,
      sender,
      clock: { now: () => 1_000, schedule: () => () => undefined },
      random: { next: () => 0.5 },
      settings: fakeSettings(),
      commands: fakeCommands(),
      menuThumbnailPath: '.auth/assets/menu-thumbnail.jpg',
    })

    await context.reply('pong')

    expect(sent).toEqual([{ to: GROUP_JID, content: 'pong' }])
    expect(context.isGroup).toBe(true)
  })

  it('forwards typed AIRich content and options to the public Zapo send API via replyAIRich', async () => {
    const { sender, sent } = fakeSender()
    const context = createCommandContext({
      event: groupPnParticipantEvent(textMessage('.dino')),
      parsed: { prefix: '.', name: 'dino', args: [], text: '' },
      sender,
      clock: { now: () => 1_000, schedule: () => () => undefined },
      random: { next: () => 0.5 },
      settings: fakeSettings(),
      commands: fakeCommands(),
      menuThumbnailPath: '.auth/assets/menu-thumbnail.jpg',
    })
    const content = htmlPrimitiveMessage({ html: '<div>Dino</div>', caption: 'Dino', responseId: 'x' })
    const options = htmlPrimitiveSendOptions()

    await context.replyAIRich(content, options)

    expect(sent).toEqual([{ to: GROUP_JID, content, options }])
  })

  it('flags the configured owner and nobody else', () => {
    const { sender } = fakeSender()
    const base = {
      event: privatePnEvent(textMessage('.ping')),
      parsed,
      sender,
      clock: { now: () => 1_000, schedule: () => () => undefined },
      random: { next: () => 0.5 },
      settings: fakeSettings(),
      commands: fakeCommands(),
      menuThumbnailPath: '.auth/assets/menu-thumbnail.jpg',
    }

    expect(createCommandContext({ ...base, ownerNumber: '6289876543210' }).isOwner).toBe(true)
    expect(createCommandContext({ ...base, ownerNumber: '6281111111111' }).isOwner).toBe(false)
    expect(createCommandContext(base).isOwner).toBe(false)
  })

  it('carries the invocation and identity fields through', () => {
    const { sender } = fakeSender()
    const context = createCommandContext({
      event: privatePnEvent(textMessage('!rate kopi susu')),
      parsed: { prefix: '!', name: 'rate', args: ['kopi', 'susu'], text: 'kopi susu' },
      sender,
      clock: { now: () => 1_000, schedule: () => () => undefined },
      random: { next: () => 0.5 },
      receivedAtMs: 900,
      settings: fakeSettings(),
      commands: fakeCommands(),
      menuThumbnailPath: '.auth/assets/menu-thumbnail.jpg',
    })

    expect(context.prefix).toBe('!')
    expect(context.commandName).toBe('rate')
    expect(context.args).toEqual(['kopi', 'susu'])
    expect(context.text).toBe('kopi susu')
    expect(context.receivedAtMs).toBe(900)
    expect(context.chatJid).toBe(PEER_PN_JID)
    expect(context.senderJid).toBe(PEER_PN_JID)
    expect(context.senderLidJid).toBe(PEER_LID_JID)
    expect(context.senderNumber).toBe('6289876543210')
    expect(context.pushName).toBeUndefined()
    expect('pushName' in context).toBe(false)
  })

  it('reads now() and random() from the injected services', () => {
    const { sender } = fakeSender()
    let ticks = 0
    const context = createCommandContext({
      event: privatePnEvent(textMessage('.ping')),
      parsed,
      sender,
      clock: {
        now: () => {
          ticks += 1
          return 5_000 + ticks
        },
        schedule: () => () => undefined,
      },
      random: { next: () => 0.25 },
      settings: fakeSettings(),
      commands: fakeCommands(),
      menuThumbnailPath: '.auth/assets/menu-thumbnail.jpg',
    })

    expect(context.receivedAtMs).toBe(5_001)
    expect(context.now()).toBe(5_002)
    expect(context.random()).toBe(0.25)
  })

  it('reacts with the reaction content union targeting the event', async () => {
    const { sender, sent } = fakeSender()
    const event = groupPnParticipantEvent(textMessage('.ping'))
    const context = createCommandContext({
      event,
      parsed,
      sender,
      clock: { now: () => 1_000, schedule: () => () => undefined },
      random: { next: () => 0.5 },
      settings: fakeSettings(),
      commands: fakeCommands(),
      menuThumbnailPath: '.auth/assets/menu-thumbnail.jpg',
    })

    await context.react('🎲')

    expect(sent).toEqual([
      { to: GROUP_JID, content: { type: 'reaction', emoji: '🎲', target: event } },
    ])
  })
})
