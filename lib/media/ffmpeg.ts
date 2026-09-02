import { spawn } from 'node:child_process'
import { buildStickerExif, stickerArgs, type StickerMetadata } from './sticker-codec.js'
import { attachExifChunk } from './webp-exif.js'

/** Refuse oversized input before spawning anything. */
const MAX_INPUT_BYTES = 8 * 1024 * 1024
const TIMEOUT_MS = 25_000

export interface EncodeStickerOptions {
  readonly animated: boolean
  readonly metadata: StickerMetadata
}

/**
 * Runs ffmpeg with a fixed argv and no shell.
 *
 * SECURITY.md §2 forbids shell commands from messages: nothing here is a shell
 * string, the binary name is a constant, and every argument comes from
 * `stickerArgs` — user bytes only ever reach stdin. `shell: false` is the
 * spawn default and is what keeps that true.
 */
function runFfmpeg(input: Uint8Array, args: readonly string[]): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', [...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: TIMEOUT_MS,
    })

    const chunks: Uint8Array[] = []
    let stderr = ''
    let size = 0

    child.stdout.on('data', (chunk: Buffer) => {
      size += chunk.byteLength
      chunks.push(chunk)
    })
    child.stderr.on('data', (chunk: Buffer) => {
      // Capped: ffmpeg can be chatty and this string ends up in an Error.
      if (stderr.length < 2000) stderr += chunk.toString('utf8')
    })

    child.on('error', (error: Error) => {
      reject(new Error(`ffmpeg could not be started: ${error.message}`))
    })

    child.on('close', (code) => {
      if (code !== 0 || size === 0) {
        reject(new Error(`ffmpeg exited with code ${String(code)}: ${stderr.trim()}`))
        return
      }
      const out = new Uint8Array(size)
      let offset = 0
      for (const chunk of chunks) {
        out.set(chunk, offset)
        offset += chunk.byteLength
      }
      resolve(out)
    })

    child.stdin.on('error', () => {
      // ffmpeg closes stdin early on undecodable input; the close handler reports it.
    })
    child.stdin.end(input)
  })
}

/** Media bytes to a WhatsApp-ready sticker: 512x512 WebP with pack metadata. */
export async function encodeSticker(
  input: Uint8Array,
  options: EncodeStickerOptions,
): Promise<Uint8Array> {
  if (input.byteLength > MAX_INPUT_BYTES) {
    throw new Error(`input too large: ${String(input.byteLength)} bytes`)
  }

  const webp = await runFfmpeg(input, stickerArgs({ animated: options.animated }))
  return attachExifChunk(webp, buildStickerExif(options.metadata))
}
