import type { Proto } from 'zapo-js'

/**
 * The incoming message content a command may inspect for attachments.
 *
 * Re-exported here so `src/commands/command.ts` stays free of a direct zapo-js
 * import, matching how `RichInteractiveContent` is kept out of it.
 */
export type IncomingMessageContent = Proto.IMessage

/** A sticker ready to send: bytes already encoded to WebP. */
export interface StickerReply {
  readonly type: 'sticker'
  readonly media: Uint8Array
  readonly mimetype: 'image/webp'
}

export type MediaReply = StickerReply
