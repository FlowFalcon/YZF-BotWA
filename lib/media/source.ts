import type { Proto } from 'zapo-js'

export interface StickerSource {
  /** A message carrying exactly the media to download. */
  readonly message: Proto.IMessage
  readonly animated: boolean
}

/**
 * Finds the media a sticker should be built from: the message itself, or the
 * message it replies to.
 *
 * Replying to someone else's photo is how these bots are actually used, and the
 * quoted copy carries the same CDN keys as the original, so it can be
 * downloaded directly. Documents are excluded even with an image mimetype —
 * the client does not treat them as media.
 */
export function resolveStickerSource(
  message: Proto.IMessage | null | undefined,
): StickerSource | undefined {
  if (message === null || message === undefined) return undefined

  const direct = pickMedia(message)
  if (direct !== undefined) return direct

  const quoted =
    message.extendedTextMessage?.contextInfo?.quotedMessage ??
    message.imageMessage?.contextInfo?.quotedMessage ??
    message.videoMessage?.contextInfo?.quotedMessage
  return quoted === null || quoted === undefined ? undefined : pickMedia(quoted)
}

function pickMedia(message: Proto.IMessage): StickerSource | undefined {
  if (message.imageMessage) return { message: { imageMessage: message.imageMessage }, animated: false }
  if (message.videoMessage) return { message: { videoMessage: message.videoMessage }, animated: true }
  if (message.stickerMessage?.isAnimated === true) {
    return { message: { stickerMessage: message.stickerMessage }, animated: true }
  }
  return undefined
}

/**
 * Sama seperti `resolveStickerSource` tapi khusus gambar diam: fitur yang
 * mengirim byte ke layanan gambar tidak bisa memakai video atau sticker
 * animasi.
 */
export function resolveImageSource(
  message: Proto.IMessage | null | undefined,
): Proto.IMessage | undefined {
  const source = resolveStickerSource(message)
  if (source === undefined) return undefined
  return source.message.imageMessage ? source.message : undefined
}
