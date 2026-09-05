import type { Proto, WaIncomingMessageEvent, WaSendMessageContent } from 'zapo-js'
import type {
  CommandContext,
  CommandListing,
  QuotedMessage,
  ReplyCardOptions,
  ReplyOptions,
} from '../commands/command.js'
import type { ParsedCommand } from '../commands/parser.js'
import type { Clock } from '../shared/clock.js'
import type { Random } from '../shared/random.js'
import type { SettingsView } from '../settings.js'
import type { AIRichSendOptions } from './ai-rich.js'
import type { ProfileBrandingService } from '../profile/branding.js'
import type { MenuMediaService } from './menu-media.js'
import type { GroupGateway } from '../group/gateway.js'
import type { UserStore } from '../users/store.js'
import { DEFAULT_CARD_TITLE, DEFAULT_CARD_URL, replyCard } from './reply-card.js'
import { isOwnerNumber, resolveIdentity } from './identity.js'

/**
 * Hanya member `message.send` yang dipakai context; menerima structural type
 * agar test tidak perlu membangun seluruh `WaClient`.
 */
export interface MessageSender {
  readonly message: {
    send(
      to: string,
      content: WaSendMessageContent,
      options?: AIRichSendOptions,
    ): Promise<unknown>
  }
}

export interface CommandContextInput {
  readonly event: WaIncomingMessageEvent
  readonly parsed: ParsedCommand
  readonly sender: MessageSender
  readonly clock: Clock
  readonly random: Random
  readonly ownerNumber?: string
  readonly settings: SettingsView
  readonly commands: CommandListing
  readonly profile?: ProfileBrandingService
  readonly menuThumbnailPath: string
  readonly menuMedia?: MenuMediaService
  readonly group?: GroupGateway
  readonly users?: UserStore
  /** Semua JID akun bot (PN dan LID); dipakai untuk cek admin bot dan filter self. */
  readonly botJids?: readonly string[]
  /** Default: `clock.now()` saat context dibuat. */
  readonly receivedAtMs?: number
}

/** Submessage yang bisa membawa `contextInfo`; `getContextInfo` zapo hanya baca yang pertama. */
function readContextInfo(message: Proto.IMessage | undefined): Proto.IContextInfo | undefined {
  if (message === undefined || message === null) return undefined
  return (
    message.extendedTextMessage?.contextInfo ??
    message.imageMessage?.contextInfo ??
    message.videoMessage?.contextInfo ??
    message.stickerMessage?.contextInfo ??
    message.audioMessage?.contextInfo ??
    message.documentMessage?.contextInfo ??
    undefined
  )
}

function readQuoted(info: Proto.IContextInfo | undefined): QuotedMessage | undefined {
  const quoted = info?.quotedMessage
  const id = info?.stanzaId
  if (quoted === undefined || quoted === null || id === undefined || id === null) return undefined
  const participant = info?.participant
  return {
    id,
    ...(participant === undefined || participant === null ? {} : { participant }),
    message: quoted,
  }
}

function readMentions(info: Proto.IContextInfo | undefined): readonly string[] {
  const mentioned = info?.mentionedJid
  if (mentioned === undefined || mentioned === null) return []
  return mentioned.filter((jid): jid is string => typeof jid === 'string')
}

export function createCommandContext(input: CommandContextInput): CommandContext {
  const { event, parsed, sender, clock, random } = input
  const identity = resolveIdentity(event)
  const pushName = event.pushName
  const isOwner =
    input.ownerNumber === undefined ? false : isOwnerNumber(identity, input.ownerNumber)
  const contextInfo = readContextInfo(event.message ?? undefined)
  const quoted = readQuoted(contextInfo)

  const sendText = async (content: string, options?: ReplyOptions): Promise<void> => {
    // Tanpa mention, string mentah sudah cukup dan menghindari payload berlebih.
    if (options?.mentions === undefined || options.mentions.length === 0) {
      await sender.message.send(identity.replyJid, content)
      return
    }
    await sender.message.send(identity.replyJid, {
      type: 'text',
      text: content,
      contextInfo: { mentionedJids: options.mentions },
    })
  }

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
    messageId: event.key.id,
    ...(quoted === undefined ? {} : { quoted }),
    mentionedJids: readMentions(contextInfo),
    settings: input.settings,
    commands: input.commands,
    ...(input.profile === undefined ? {} : { profile: input.profile }),
    ...(input.menuMedia === undefined ? {} : { menuMedia: input.menuMedia }),
    ...(input.group === undefined ? {} : { group: input.group }),
    ...(input.users === undefined ? {} : { users: input.users }),
    botJids: input.botJids ?? [],
    menuThumbnailPath: input.menuThumbnailPath,
    now: () => clock.now(),
    random: () => random.next(),
    // COMMAND_SPEC §6: reply di grup dikirim ke group JID.
    reply: sendText,
    Reply: async (content, options?: ReplyCardOptions) => {
      const thumbnail = await input.menuMedia?.compact()
      if (thumbnail === undefined) {
        await sendText(content, options)
        return
      }
      await sender.message.send(
        identity.replyJid,
        replyCard({
          text: content,
          url: DEFAULT_CARD_URL,
          title: options?.title ?? DEFAULT_CARD_TITLE,
          ...(options?.description === undefined ? {} : { description: options.description }),
          thumbnail,
          ...(options?.mentions === undefined ? {} : { mentions: options.mentions }),
        }),
      )
    },
    replyContent: async (content) => {
      await sender.message.send(identity.replyJid, content)
    },
    replyMedia: async (content) => {
      await sender.message.send(identity.replyJid, content)
    },
    replyImage: async (bytes, options) => {
      await sender.message.send(identity.replyJid, {
        type: 'image',
        media: bytes,
        mimetype: options.mimetype,
        ...(options.caption === undefined ? {} : { caption: options.caption }),
      })
    },
    replyAIRich: async (content, options) => {
      return sender.message.send(identity.replyJid, content, options)
    },
    revoke: async (key) => {
      await sender.message.send(identity.replyJid, {
        type: 'revoke',
        target: {
          remoteJid: identity.chatJid,
          id: key.id,
          fromMe: key.fromMe,
          ...(key.participant === undefined ? {} : { participant: key.participant }),
        },
      })
    },
    ...(event.message === null || event.message === undefined ? {} : { message: event.message }),
    react: async (emoji) => {
      // Event diteruskan verbatim sebagai target; zapo memakai `key` di dalamnya.
      await sender.message.send(identity.replyJid, { type: 'reaction', emoji, target: event })
    },
  }
}
