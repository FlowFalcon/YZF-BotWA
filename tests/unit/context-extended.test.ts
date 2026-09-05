import { describe, expect, it } from 'vitest'
import type { WaSendMessageContent } from 'zapo-js'
import { createCommandContext } from '../../lib/messages/context.js'
import type { MessageSender } from '../../lib/messages/context.js'
import type { GroupGateway } from '../../lib/group/gateway.js'
import type { ParsedCommand } from '../../lib/commands/parser.js'
import type { MenuMediaService } from '../../lib/messages/menu-media.js'
import type { AIRichSendOptions } from '../../lib/messages/ai-rich.js'
import {
  buildIncomingMessageEvent,
  GROUP_JID,
  groupPnParticipantEvent,
  PEER_LID_JID,
  PEER_PN_JID,
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
const clock = { now: () => 1_000, schedule: () => () => undefined }
const random = { next: () => 0.5 }

function mediaService(
  compact: { bytes: Uint8Array; width: number; height: number } | undefined,
): MenuMediaService {
  return {
    header: () => Promise.resolve(undefined),
    compact: () => Promise.resolve(compact),
  }
}

interface ContextOverrides {
  readonly menuMedia?: MenuMediaService
  readonly group?: GroupGateway
  readonly botJids?: readonly string[]
}

function build(
  event: ReturnType<typeof privatePnEvent>,
  sender: MessageSender,
  overrides: ContextOverrides = {},
  command: ParsedCommand = parsed,
) {
  return createCommandContext({
    event,
    parsed: command,
    sender,
    clock,
    random,
    settings: fakeSettings(),
    commands: fakeCommands(),
    menuThumbnailPath: 'x',
    ...overrides,
  })
}

describe('createCommandContext reply surfaces', () => {
  it('reply() sends bare text so ordinary replies stay compact', async () => {
    const { sender, sent } = fakeSender()
    const context = build(privatePnEvent(textMessage('.ping')), sender, {
      menuMedia: mediaService({ bytes: new Uint8Array([1]), width: 240, height: 135 }),
    })

    await context.reply('pong')

    expect(sent).toEqual([{ to: PEER_PN_JID, content: 'pong' }])
  })

  it('reply() carries mentions as a typed text message when asked', async () => {
    const { sender, sent } = fakeSender()
    const context = build(groupPnParticipantEvent(textMessage('.ping')), sender)

    await context.reply('hi @6289876543210', { mentions: [PEER_PN_JID] })

    expect(sent).toEqual([
      {
        to: GROUP_JID,
        content: {
          type: 'text',
          text: 'hi @6289876543210',
          contextInfo: { mentionedJids: [PEER_PN_JID] },
        },
      },
    ])
  })

  it('Reply() sends the HQ link-preview card when a thumbnail is installed', async () => {
    const { sender, sent } = fakeSender()
    const thumbnail = { bytes: new Uint8Array([9]), width: 240, height: 135 }
    const context = build(privatePnEvent(textMessage('.ping')), sender, {
      menuMedia: mediaService(thumbnail),
    })

    await context.Reply('pong', { title: 'Status', description: 'aktif' })

    const [message] = sent
    expect(message?.to).toBe(PEER_PN_JID)
    const content = message?.content as {
      type: string
      text: string
      linkPreview: { title: string; description: string; thumbnail: unknown }
    }
    expect(content.type).toBe('text')
    expect(content.text.endsWith('pong')).toBe(true)
    expect(content.linkPreview.title).toBe('Status')
    expect(content.linkPreview.description).toBe('aktif')
    expect(content.linkPreview.thumbnail).toEqual(thumbnail)
  })

  it('Reply() falls back to bare text when no thumbnail is installed', async () => {
    const { sender, sent } = fakeSender()
    const context = build(privatePnEvent(textMessage('.ping')), sender, {
      menuMedia: mediaService(undefined),
    })

    await context.Reply('pong')

    expect(sent).toEqual([{ to: PEER_PN_JID, content: 'pong' }])
  })

  it('Reply() falls back to bare text when the runtime has no media service', async () => {
    const { sender, sent } = fakeSender()
    const context = build(privatePnEvent(textMessage('.ping')), sender)

    await context.Reply('pong', { mentions: [PEER_PN_JID] })

    expect(sent).toEqual([
      {
        to: PEER_PN_JID,
        content: { type: 'text', text: 'pong', contextInfo: { mentionedJids: [PEER_PN_JID] } },
      },
    ])
  })
})

describe('createCommandContext quoted message and mentions', () => {
  it('exposes the quoted message, its author and the mentioned jids', () => {
    const { sender } = fakeSender()
    const event = buildIncomingMessageEvent({
      remoteJid: GROUP_JID,
      isGroup: true,
      participant: PEER_PN_JID,
      message: {
        extendedTextMessage: {
          text: '.kick @111',
          contextInfo: {
            stanzaId: 'QUOTED-1',
            participant: '111@s.whatsapp.net',
            quotedMessage: { conversation: 'halo' },
            mentionedJid: ['222@s.whatsapp.net'],
          },
        },
      },
    })
    const context = build(event, sender, {}, {
      prefix: '.',
      name: 'kick',
      args: ['@111'],
      text: '@111',
    })

    expect(context.quoted).toEqual({
      id: 'QUOTED-1',
      participant: '111@s.whatsapp.net',
      message: { conversation: 'halo' },
    })
    expect(context.mentionedJids).toEqual(['222@s.whatsapp.net'])
  })

  it('leaves quoted undefined and mentions empty for a plain conversation', () => {
    const { sender } = fakeSender()
    const context = build(privatePnEvent(textMessage('.ping')), sender)

    expect(context.quoted).toBeUndefined()
    expect(context.mentionedJids).toEqual([])
  })
})

describe('createCommandContext media and message keys', () => {
  it('replyImage sends a typed image message with caption', async () => {
    const { sender, sent } = fakeSender()
    const context = build(privatePnEvent(textMessage('.qr')), sender)
    const bytes = new Uint8Array([1, 2])

    await context.replyImage(bytes, { mimetype: 'image/png', caption: 'qr' })

    expect(sent).toEqual([
      {
        to: PEER_PN_JID,
        content: { type: 'image', media: bytes, mimetype: 'image/png', caption: 'qr' },
      },
    ])
  })

  it('revoke sends a revoke targeting the given key in the current chat', async () => {
    const { sender, sent } = fakeSender()
    const context = build(groupPnParticipantEvent(textMessage('.del')), sender)

    await context.revoke({ id: 'M-1', participant: PEER_LID_JID, fromMe: false })

    expect(sent).toEqual([
      {
        to: GROUP_JID,
        content: {
          type: 'revoke',
          target: { remoteJid: GROUP_JID, id: 'M-1', fromMe: false, participant: PEER_LID_JID },
        },
      },
    ])
  })

  it('exposes the incoming message id so commands can delete or quote it', () => {
    const { sender } = fakeSender()
    const context = build(groupPnParticipantEvent(textMessage('.x')), sender)

    expect(context.messageId).toBe('MSG-1')
  })
})

describe('createCommandContext group gateway', () => {
  it('passes the group gateway and the bot jids through untouched', async () => {
    const { sender } = fakeSender()
    const metadata = {
      jid: GROUP_JID,
      subject: 'Test',
      restrict: false,
      announce: false,
      participants: [
        { jid: PEER_PN_JID, isAdmin: true, isSuperAdmin: false },
        { jid: '5550@s.whatsapp.net', isAdmin: false, isSuperAdmin: false },
      ],
    }
    const group: GroupGateway = {
      metadata: () => Promise.resolve(metadata),
      add: () => Promise.resolve([]),
      remove: () => Promise.resolve([]),
      promote: () => Promise.resolve([]),
      demote: () => Promise.resolve([]),
      setAnnounce: () => Promise.resolve(),
      setSubject: () => Promise.resolve(),
      setDescription: () => Promise.resolve(),
      inviteCode: () => Promise.resolve('CODE'),
      revokeInvite: () => Promise.resolve('NEW'),
    }
    const context = build(groupPnParticipantEvent(textMessage('.kick')), sender, {
      group,
      botJids: ['5550@s.whatsapp.net'],
    })

    expect(context.group).toBe(group)
    expect(await context.group?.metadata(GROUP_JID)).toBe(metadata)
    expect(context.botJids).toEqual(['5550@s.whatsapp.net'])
  })

  it('defaults botJids to an empty list when the runtime has no client identity', () => {
    const { sender } = fakeSender()
    const context = build(groupPnParticipantEvent(textMessage('.kick')), sender)

    expect(context.group).toBeUndefined()
    expect(context.botJids).toEqual([])
  })
})
