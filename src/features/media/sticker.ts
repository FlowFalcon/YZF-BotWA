import { downloadMediaMessage } from 'zapo-js'
import type { Readable } from 'node:stream'
import type { Command, CommandContext } from '../../commands/command.js'
import type { EncodeStickerOptions } from '../../media/ffmpeg.js'
import { encodeSticker } from '../../media/ffmpeg.js'
import { resolveStickerSource } from '../../media/source.js'
import type { IncomingMessageContent } from '../../media/types.js'

/** Ceiling on downloaded bytes; large videos are refused, not truncated. */
const DEFAULT_MAX_BYTES = 8 * 1024 * 1024

export interface StickerDeps {
  download(message: IncomingMessageContent): Promise<Readable>
  encode(input: Uint8Array, options: EncodeStickerOptions): Promise<Uint8Array>
  /** Shown as the sticker's publisher in the WhatsApp tray. */
  readonly packAuthor: string
  readonly maxBytes?: number
}

const USAGE = 'Kirim foto/video dengan caption .sticker, atau reply media lalu ketik .sticker.'

/**
 * Collects a stream with a hard byte ceiling.
 *
 * Checked while reading rather than after: a malicious or accidental 100 MB
 * video must not be buffered in full before being rejected.
 */
async function collect(stream: Readable, maxBytes: number): Promise<Uint8Array> {
  const chunks: Uint8Array[] = []
  let size = 0
  for await (const chunk of stream) {
    const bytes = chunk as Uint8Array
    size += bytes.byteLength
    if (size > maxBytes) throw new RangeError('media exceeds the sticker size ceiling')
    chunks.push(bytes)
  }

  const out = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

export function createStickerCommand(deps: StickerDeps): Command {
  const maxBytes = deps.maxBytes ?? DEFAULT_MAX_BYTES

  return {
    name: 'sticker',
    aliases: ['s', 'stiker'],
    category: 'fun',
    description: 'Ubah foto/video/GIF jadi sticker',
    usage: '.sticker (kirim bersama media atau reply media)',
    cooldownMs: 5000,
    run: async (context: CommandContext): Promise<void> => {
      const source = resolveStickerSource(context.message)
      if (source === undefined) {
        await context.reply(USAGE)
        return
      }

      await context.react('⏳')

      try {
        const bytes = await collect(await deps.download(source.message), maxBytes)
        const media = await deps.encode(bytes, {
          animated: source.animated,
          metadata: { pack: context.pushName ?? 'Sticker', author: deps.packAuthor },
        })
        await context.replyMedia({ type: 'sticker', media, mimetype: 'image/webp' })
      } catch (error) {
        // ffmpeg stderr and CDN errors stay in the log; the chat gets a plain
        // sentence, per SECURITY.md §5 on not leaking internals.
        await context.reply(
          error instanceof RangeError
            ? 'Medianya terlalu besar. Coba yang lebih kecil atau lebih pendek.'
            : 'Gagal membuat sticker dari media ini.',
        )
      }
    },
  }
}

/**
 * Default wiring for the loader: the real CDN download and the real ffmpeg.
 *
 * `createStickerCommand` stays injectable so tests never spawn a process nor
 * touch the network; this default export is what `loadCommands` picks up.
 */
const sticker = createStickerCommand({
  download: (message) => downloadMediaMessage(message),
  encode: encodeSticker,
  packAuthor: 'zapo-fun-bot',
})

export default sticker
