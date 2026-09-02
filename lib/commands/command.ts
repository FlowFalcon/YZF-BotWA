import type { RichReplyContent } from '../messages/rich.js'
import type { AIRichContent, AIRichSendOptions } from '../messages/ai-rich.js'
import type { IncomingMessageContent, MediaReply } from '../media/types.js'
import type { SettingsView } from '../settings.js'
import type { ProfileBrandingService } from '../profile/branding.js'

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
  /** Read-only settings view; commands that need mode info read it from here. */
  readonly settings: SettingsView
  /** Read-only command listing; the menu command uses this instead of a module-global. */
  readonly commands: CommandListing
  readonly profile?: ProfileBrandingService
  readonly menuThumbnailPath: string
  now(): number
  random(): number
  reply(content: string): Promise<void>
  /** Sends a native-flow interactive payload or a text reply carrying a branding card. */
  replyContent(content: RichReplyContent): Promise<void>
  /** Sends encoded media (sticker) back to the same chat. */
  replyMedia(content: MediaReply): Promise<void>
  /** Sends a typed AIRich proto payload used by the built-in Dino and V4 renderers. */
  replyAIRich(content: AIRichContent, options?: AIRichSendOptions): Promise<unknown>
  react(emoji: string): Promise<void>
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
