import type { WaIncomingMessageEvent, WaSendMessageContent } from 'zapo-js'
import type { CommandContext } from '../commands/command.js'
import type { ParsedCommand } from '../commands/parser.js'
import type { Clock } from '../shared/clock.js'
import type { Random } from '../shared/random.js'
import { isOwnerNumber, resolveIdentity } from './identity.js'

/**
 * Hanya member `message.send` yang dipakai context; menerima structural type
 * agar test tidak perlu membangun seluruh `WaClient`.
 */
export interface MessageSender {
  readonly message: {
    send(to: string, content: WaSendMessageContent): Promise<unknown>
  }
}

export interface CommandContextInput {
  readonly event: WaIncomingMessageEvent
  readonly parsed: ParsedCommand
  readonly sender: MessageSender
  readonly clock: Clock
  readonly random: Random
  readonly ownerNumber?: string
  /** Default: `clock.now()` saat context dibuat. */
  readonly receivedAtMs?: number
}

export function createCommandContext(input: CommandContextInput): CommandContext {
  const { event, parsed, sender, clock, random } = input
  const identity = resolveIdentity(event)
  const pushName = event.pushName
  const isOwner =
    input.ownerNumber === undefined ? false : isOwnerNumber(identity, input.ownerNumber)

  return {
    chatJid: identity.chatJid,
    senderJid: identity.senderJid,
    ...(identity.senderAltJid === undefined ? {} : { senderAltJid: identity.senderAltJid }),
    ...(identity.senderPnJid === undefined ? {} : { senderPnJid: identity.senderPnJid }),
    ...(identity.senderLidJid === undefined ? {} : { senderLidJid: identity.senderLidJid }),
    ...(identity.senderNumber === undefined ? {} : { senderNumber: identity.senderNumber }),
    ...(pushName === undefined ? {} : { pushName }),
    isGroup: identity.isGroup,
    isOwner,
    prefix: parsed.prefix,
    commandName: parsed.name,
    args: parsed.args,
    text: parsed.text,
    receivedAtMs: input.receivedAtMs ?? clock.now(),
    now: () => clock.now(),
    random: () => random.next(),
    reply: async (content) => {
      // COMMAND_SPEC §6: reply di grup dikirim ke group JID.
      await sender.message.send(identity.replyJid, content)
    },
    replyContent: async (content) => {
      await sender.message.send(identity.replyJid, content)
    },
    replyMedia: async (content) => {
      await sender.message.send(identity.replyJid, content)
    },
    ...(event.message === null || event.message === undefined ? {} : { message: event.message }),
    react: async (emoji) => {
      // Event diteruskan verbatim sebagai target; zapo memakai `key` di dalamnya.
      await sender.message.send(identity.replyJid, { type: 'reaction', emoji, target: event })
    },
  }
}
