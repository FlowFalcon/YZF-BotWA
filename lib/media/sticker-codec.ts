/** WhatsApp renders stickers on a fixed square canvas. */
export const STICKER_SIZE = 512

/** Clients silently drop animated stickers longer than this. */
const MAX_ANIMATION_SECONDS = 10

const FPS = 15

export interface StickerEncodeOptions {
  readonly animated: boolean
}

/**
 * ffmpeg argv for input on stdin, WebP on stdout.
 *
 * Returned as an argv array and spawned without a shell, so nothing a user
 * sends can become an ffmpeg flag or a shell token (SECURITY.md §3). The
 * caller supplies no strings at all: the only variable is `animated`.
 *
 * `force_original_aspect_ratio=decrease` + `pad` letterboxes into the square
 * instead of cropping, so faces never lose their edges; padding is fully
 * transparent rather than black.
 */
export function stickerArgs(options: StickerEncodeOptions): readonly string[] {
  const square = `${String(STICKER_SIZE)}:${String(STICKER_SIZE)}`
  const fit = [
    `scale=${square}:force_original_aspect_ratio=decrease`,
    ...(options.animated ? [`fps=${String(FPS)}`] : []),
    'format=rgba',
    `pad=${square}:(ow-iw)/2:(oh-ih)/2:color=#00000000`,
  ].join(',')

  return [
    '-hide_banner',
    '-loglevel',
    'error',
    ...(options.animated ? ['-t', String(MAX_ANIMATION_SECONDS)] : []),
    '-i',
    'pipe:0',
    '-vf',
    fit,
    '-c:v',
    options.animated ? 'libwebp_anim' : 'libwebp',
    ...(options.animated ? ['-loop', '0', '-q:v', '50'] : ['-frames:v', '1', '-q:v', '75']),
    '-preset',
    'default',
    '-an',
    '-vsync',
    '0',
    '-f',
    'webp',
    'pipe:1',
  ]
}

export interface StickerMetadata {
  readonly pack: string
  readonly author: string
}

/**
 * The RIFF `EXIF` chunk payload WhatsApp reads for the pack name shown in the
 * sticker tray. Layout is a little-endian TIFF header whose sole IFD entry
 * points at a JSON blob; the 0x5741 tag is what the client looks for.
 */
export function buildStickerExif(metadata: StickerMetadata): Uint8Array {
  const json = new TextEncoder().encode(
    JSON.stringify({
      'sticker-pack-id': 'com.zapo.funbot',
      'sticker-pack-name': metadata.pack,
      'sticker-pack-publisher': metadata.author,
      emojis: [],
    }),
  )

  const header = new Uint8Array([
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
  ])
  new DataView(header.buffer).setUint32(14, json.byteLength, true)

  const exif = new Uint8Array(header.byteLength + json.byteLength)
  exif.set(header, 0)
  exif.set(json, header.byteLength)
  return exif
}
