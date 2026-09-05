import type { RichReplyContent } from '../messages/rich.js'
import type { MenuMediaService } from '../messages/menu-media.js'
import type { AIRichContent, AIRichSendOptions } from '../messages/ai-rich.js'
import type { IncomingMessageContent, MediaReply } from '../media/types.js'
import type { SettingsView } from '../settings.js'
import type { ProfileBrandingService } from '../profile/branding.js'
import type { GroupGateway } from '../group/gateway.js'
import type { UserStore } from '../users/store.js'

export const COMMAND_CATEGORIES = [
  'owner',
  'group',
  'tools',
  'downloader',
  'sticker',
  'games',
] as const

export type CommandCategory = (typeof COMMAND_CATEGORIES)[number]
export type CommandPermission = 'everyone' | 'owner'

/** Read-only registry surface exposed to commands via context (e.g. for the menu). */
export interface CommandListing {
  list(): readonly Command[]
}

/** Pesan yang di-reply user, sudah dinormalisasi dari `contextInfo`. */
export interface QuotedMessage {
  readonly id: string
  /** Pengirim pesan yang dikutip; di 1:1 sama dengan lawan bicara. */
  readonly participant?: string
  readonly message: IncomingMessageContent
}

/** Kunci pesan untuk revoke/quote. `remoteJid` selalu chat saat ini. */
export interface MessageKeyInput {
  readonly id: string
  readonly fromMe: boolean
  readonly participant?: string
}

export interface ReplyOptions {
  readonly mentions?: readonly string[]
}

/** Judul dan deskripsi kartu HQ; keduanya punya default bermerek bot. */
export interface ReplyCardOptions extends ReplyOptions {
  readonly title?: string
  readonly description?: string
}

export interface ImageReplyOptions {
  readonly mimetype: 'image/jpeg' | 'image/png' | 'image/webp'
  readonly caption?: string
}

/**
 * Kontrak minimum yang dipakai command (COMMAND_SPEC §2).
 * Field `event` sengaja tidak dideklarasikan di sini; message layer
 * mendeklarasikan type yang lebih lebar dan structurally conform ke interface ini,
 * sehingga core command tidak bergantung pada type zapo-js.
 */
export interface CommandContext {
  readonly chatJid: string
  readonly senderJid: string
  readonly senderAltJid?: string
  readonly senderPnJid?: string
  readonly senderLidJid?: string
  readonly senderNumber?: string
  readonly pushName?: string
  readonly isGroup: boolean
  readonly isOwner: boolean
  readonly prefix: string
  readonly commandName: string
  readonly args: readonly string[]
  readonly text: string
  readonly receivedAtMs: number
  /** Stanza id pesan yang memicu command. */
  readonly messageId: string
  /** Pesan yang di-reply user, bila ada. */
  readonly quoted?: QuotedMessage
  /** JID yang di-mention dalam pesan; kosong bila tidak ada. */
  readonly mentionedJids: readonly string[]
  /** Read-only settings view; commands that need mode info read it from here. */
  readonly settings: SettingsView
  /** Read-only command listing; the menu command uses this instead of a module-global. */
  readonly commands: CommandListing
  readonly profile?: ProfileBrandingService
  readonly menuThumbnailPath: string
  /**
   * Uploaded-media header and inline thumbnail for presentation surfaces.
   * Optional like `profile`: a runtime without it sends text-only cards.
   */
  readonly menuMedia?: MenuMediaService
  /** Operasi grup; `undefined` pada runtime tanpa client (test harness). */
  readonly group?: GroupGateway
  /** Semua JID akun bot (PN dan LID) — untuk cek admin bot dan filter self dari tag. */
  readonly botJids: readonly string[]
  /** Penyimpanan user (AFK, ban, premium). */
  readonly users?: UserStore
  now(): number
  random(): number
  /** Balasan teks polos. Kartu HQ dipakai lewat `Reply`, bukan di sini. */
  reply(content: string, options?: ReplyOptions): Promise<void>
  /** Kartu link-preview dengan thumbnail; fallback ke teks bila media tidak tersedia. */
  Reply(content: string, options?: ReplyCardOptions): Promise<void>
  /** Sends a native-flow interactive payload or a text reply carrying a compact card. */
  replyContent(content: RichReplyContent): Promise<void>
  /** Sends encoded media (sticker) back to the same chat. */
  replyMedia(content: MediaReply): Promise<void>
  replyImage(bytes: Uint8Array, options: ImageReplyOptions): Promise<void>
  /** Sends a typed AIRich proto payload used by the built-in Dino and V4 renderers. */
  replyAIRich(content: AIRichContent, options?: AIRichSendOptions): Promise<unknown>
  react(emoji: string): Promise<void>
  /** Menghapus pesan di chat ini. Bot hanya bisa menghapus pesan orang lain bila admin grup. */
  revoke(key: MessageKeyInput): Promise<void>
  /**
   * The incoming message content, for commands that need the attachment rather
   * than the text — a sticker source, for instance. Undefined for messages that
   * carry no content payload.
   */
  readonly message?: IncomingMessageContent
}

export interface Command {
  readonly name: string
  readonly aliases?: readonly string[]
  readonly category: CommandCategory
  readonly description: string
  readonly usage?: string
  readonly permission?: CommandPermission
  readonly cooldownMs?: number
  run(context: CommandContext): Promise<void>
}

const TRIGGER_PATTERN = /^[a-z0-9][a-z0-9-]*$/
const CATEGORIES: readonly CommandCategory[] = COMMAND_CATEGORIES

/** Melempar Error dengan pesan spesifik bila metadata melanggar COMMAND_SPEC §1. */
export function validateCommandMetadata(command: Command): void {
  if (!TRIGGER_PATTERN.test(command.name)) {
    throw new Error(
      `Command name "${command.name}" invalid: hanya lowercase ASCII, digit, dan "-", diawali huruf/digit.`,
    )
  }

  for (const alias of command.aliases ?? []) {
    if (!TRIGGER_PATTERN.test(alias)) {
      throw new Error(
        `Alias "${alias}" pada command "${command.name}" invalid: hanya lowercase ASCII, digit, dan "-", diawali huruf/digit.`,
      )
    }
  }

  if (command.description.trim() === '') {
    throw new Error(`Command "${command.name}" harus memiliki description nonkosong.`)
  }

  if (!CATEGORIES.includes(command.category)) {
    throw new Error(
      `Command "${command.name}" memakai category "${command.category}"; nilai valid: ${CATEGORIES.join(', ')}.`,
    )
  }

  const { cooldownMs } = command
  if (cooldownMs !== undefined && (!Number.isFinite(cooldownMs) || cooldownMs < 0)) {
    throw new Error(
      `Command "${command.name}" memakai cooldownMs ${String(cooldownMs)}; harus finite dan >= 0.`,
    )
  }
}

export function commandTriggers(command: Command): readonly string[] {
  return [command.name, ...(command.aliases ?? [])]
}
