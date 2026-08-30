import type { Proto } from 'zapo-js'

/**
 * Pulls the user-visible text from a decrypted message, in WhatsApp's own
 * precedence: plain conversation, extended text, then media captions.
 * Returns `undefined` for message kinds that carry no text.
 */
export function extractMessageText(message: Proto.IMessage | null | undefined): string | undefined {
  if (message === null || message === undefined) return undefined
  return (
    message.conversation ??
    message.extendedTextMessage?.text ??
    message.imageMessage?.caption ??
    message.videoMessage?.caption ??
    undefined
  )
}
