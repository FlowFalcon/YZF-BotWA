import { downloadMediaMessage } from 'zapo-js'
import type { Readable } from 'node:stream'
import type { Command, CommandContext } from '../../lib/commands/command.js'
import type { EncodeStickerOptions } from '../../lib/media/ffmpeg.js'
import { encodeSticker } from '../../lib/media/ffmpeg.js'
import { collectStream } from '../../lib/media/collect.js'
import { resolveStickerSource } from '../../lib/media/source.js'
import type { IncomingMessageContent } from '../../lib/media/types.js'

/**
 * Ceiling on downloaded bytes; large videos are refused, not truncated.
 *
 * Written as a single literal (8 MiB) because the plugin policy rejects
 * computed top-level initializers (SECURITY.md §7).
 */
const DEFAULT_MAX_BYTES = 8_388_608

export interface StickerDeps {
  download(message: IncomingMessageContent): Promise<Readable>
  encode(input: Uint8Array, options: EncodeStickerOptions): Promise<Uint8Array>
  /** Shown as the sticker's publisher in the WhatsApp tray. */
  readonly packAuthor: string
  readonly maxBytes?: number
}

const USAGE = 'Kirim foto/video dengan caption .sticker, atau reply media lalu ketik .sticker.'

export function createStickerCommand(deps: StickerDeps): Command {
  const maxBytes = deps.maxBytes ?? DEFAULT_MAX_BYTES

  return {
    name: 'sticker',
    aliases: ['s', 'stiker'],
    category: 'sticker',
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
        const bytes = await collectStream(await deps.download(source.message), maxBytes)
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
 * Exported directly rather than through a top-level `const` because the plugin
 * policy rejects impure top-level initializers (SECURITY.md §7).
 */
export default createStickerCommand({
  download: (message) => downloadMediaMessage(message),
  encode: encodeSticker,
  packAuthor: 'YZF-BotWA',
})
