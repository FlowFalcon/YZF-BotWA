import type { WaSendTextMessage } from 'zapo-js'

/**
 * Kartu link-preview dengan thumbnail yang di-upload oleh zapo-js. URL harus
 * tetap ada di body agar `matchedText` dipertahankan oleh klien WhatsApp.
 */
export const HIDDEN_URL_PADDING = '\u200B'.repeat(400)

/** Kartu perlu URL agar `matchedText` cocok; repo bot adalah tautan yang jujur. */
export const DEFAULT_CARD_URL = 'https://github.com/FlowFalcon/YZF-BotWA'
export const DEFAULT_CARD_TITLE = 'YZF-BotWA'


export interface ReplyCardThumbnail {
  readonly bytes: Uint8Array
  readonly width: number
  readonly height: number
}

export interface ReplyCardInput {
  readonly text: string
  readonly url: string
  readonly title: string
  readonly description?: string
  readonly thumbnail: ReplyCardThumbnail
  readonly mentions?: readonly string[]
}

export function replyCard(input: ReplyCardInput): WaSendTextMessage {
  return {
    type: 'text',
    text: `${input.url}${HIDDEN_URL_PADDING}\n\n${input.text}`,
    linkPreview: {
      matchedText: input.url,
      title: input.title,
      ...(input.description === undefined ? {} : { description: input.description }),
      previewType: 0,
      thumbnail: {
        bytes: input.thumbnail.bytes,
        width: input.thumbnail.width,
        height: input.thumbnail.height,
      },
    },
    ...(input.mentions === undefined ? {} : { contextInfo: { mentionedJids: input.mentions } }),
  }
}
