import type { Proto } from 'zapo-js'
import { readRichReplyId } from './rich.js'

/**
 * Pulls the user-visible text from a decrypted message, in WhatsApp's own
 * precedence: plain conversation, extended text, then media captions. A
 * native-flow button tap resolves to the command text it carries, so a tap
 * enters the same router path as a typed message — including every access gate.
 * Returns `undefined` for message kinds that carry no text.
 */
export function extractMessageText(message: Proto.IMessage | null | undefined): string | undefined {
  if (message === null || message === undefined) return undefined
  return (
    message.conversation ??
    message.extendedTextMessage?.text ??
    message.imageMessage?.caption ??
    message.videoMessage?.caption ??
    readRichReplyId(message) ??
    undefined
  )
}
