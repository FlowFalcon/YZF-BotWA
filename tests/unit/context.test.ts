import { describe, expect, it } from 'vitest'
import type { WaSendMessageContent } from 'zapo-js'
import { createCommandContext } from '../../src/messages/context.js'
import type { MessageSender } from '../../src/messages/context.js'
import type { ParsedCommand } from '../../src/commands/parser.js'
import {
  GROUP_JID,
  PEER_LID_JID,
  PEER_PN_JID,
  groupPnParticipantEvent,
  privatePnEvent,
  textMessage,
} from '../fixtures/messages.js'

interface SentMessage {
  readonly to: string
  readonly content: WaSendMessageContent
}

function fakeSender(): { sender: MessageSender; sent: SentMessage[] } {
  const sent: SentMessage[] = []
  const sender: MessageSender = {
    message: {
      send: (to, content) => {
        sent.push({ to, content })
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
    })

    await context.reply('pong')

    expect(sent).toEqual([{ to: GROUP_JID, content: 'pong' }])
    expect(context.isGroup).toBe(true)
  })

  it('flags the configured owner and nobody else', () => {
    const { sender } = fakeSender()
    const base = {
      event: privatePnEvent(textMessage('.ping')),
      parsed,
      sender,
      clock: { now: () => 1_000, schedule: () => () => undefined },
      random: { next: () => 0.5 },
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
    })

    await context.react('🎲')

    expect(sent).toEqual([
      { to: GROUP_JID, content: { type: 'reaction', emoji: '🎲', target: event } },
    ])
  })
})
