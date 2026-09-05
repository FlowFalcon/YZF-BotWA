import { downloadMediaMessage } from 'zapo-js'
import type { Readable } from 'node:stream'
import type { Command, CommandContext } from '../../lib/commands/command.js'
import { collectStream } from '../../lib/media/collect.js'
import { resolveImageSource } from '../../lib/media/source.js'
import type { IncomingMessageContent } from '../../lib/media/types.js'

const PAGE_URL = 'https://www.iloveimg.com/upscale-image'
const START_URL = 'https://api.iloveimg.com/v1/start/upscaleimage'
const USER_AGENT = 'Mozilla/5.0'

/** Skala yang dilayani endpoint upscale. */
const UPSCALE_SCALES = [2, 4] as const
type UpscaleScale = (typeof UPSCALE_SCALES)[number]

interface UpscaleOptions {
  /** Diinjeksi di test; produksi memakai `fetch` global. */
  readonly fetchImpl?: typeof fetch
  readonly timeoutMs?: number
}

interface Session {
  readonly token: string
  readonly csrf: string
}

async function readSession(http: typeof fetch, signal: AbortSignal): Promise<Session> {
  const response = await http(PAGE_URL, { headers: { 'User-Agent': USER_AGENT }, signal })
  if (!response.ok) throw new Error(`Halaman layanan menjawab ${String(response.status)}.`)
  const html = await response.text()

  const config = /ilovepdfConfig\s*=\s*(\{.*?\});/s.exec(html)
  const csrf = /<meta name="csrf-token" content="([^"]+)"/.exec(html)
  if (config === null || csrf === null) {
    throw new Error('Token layanan tidak ditemukan; halaman upstream berubah.')
  }

  const [configText = '{}'] = config.slice(1)
  const parsed: unknown = JSON.parse(configText)
  const token =
    typeof parsed === 'object' && parsed !== null && 'token' in parsed
      ? (parsed as { readonly token?: unknown }).token
      : undefined
  if (typeof token !== 'string' || token === '') {
    throw new Error('Token layanan tidak ditemukan; halaman upstream berubah.')
  }
  const [csrfToken = ''] = csrf.slice(1)
  return { token, csrf: csrfToken }
}

function readString(value: unknown, key: string): string | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const { server, task, server_filename: serverFilename } = value as Record<string, unknown>
  const found = key === 'server' ? server : key === 'task' ? task : serverFilename
  return typeof found === 'string' ? found : undefined
}

export async function upscale(
  image: Uint8Array,
  scale: UpscaleScale,
  options: UpscaleOptions = {},
): Promise<Uint8Array> {
  if (!UPSCALE_SCALES.some((allowed) => allowed === scale)) {
    throw new Error(`Skala tidak didukung; pilih ${UPSCALE_SCALES.join(' atau ')}.`)
  }

  const http = options.fetchImpl ?? fetch
  const signal = AbortSignal.timeout(options.timeoutMs ?? 120_000)
  const session = await readSession(http, signal)
  const headers = {
    Authorization: `Bearer ${session.token}`,
    Origin: 'https://www.iloveimg.com',
    Cookie: `_csrf=${session.csrf}`,
    'User-Agent': USER_AGENT,
  }

  const startResponse = await http(START_URL, { headers, signal })
  if (!startResponse.ok) throw new Error(`Gagal memulai task (${String(startResponse.status)}).`)
  const started: unknown = await startResponse.json()
  const server = readString(started, 'server')
  const task = readString(started, 'task')
  if (server === undefined || task === undefined) {
    throw new Error('Respons task tidak lengkap; layanan upstream berubah.')
  }

  // Blob menolak Uint8Array yang bisa didasari SharedArrayBuffer, jadi byte-nya
  // disalin ke ArrayBuffer biasa.
  const payload = new ArrayBuffer(image.byteLength)
  new Uint8Array(payload).set(image)

  const uploadForm = new FormData()
  uploadForm.append('name', 'image.jpg')
  uploadForm.append('chunk', '0')
  uploadForm.append('chunks', '1')
  uploadForm.append('task', task)
  uploadForm.append('preview', '1')
  uploadForm.append('file', new Blob([payload]), 'image.jpg')

  const uploadResponse = await http(`https://${server}/v1/upload`, {
    method: 'POST',
    headers,
    body: uploadForm,
    signal,
  })
  if (!uploadResponse.ok) throw new Error(`Upload gagal (${String(uploadResponse.status)}).`)
  const uploaded: unknown = await uploadResponse.json()
  const serverFilename = readString(uploaded, 'server_filename')
  if (serverFilename === undefined) throw new Error('Nama file hasil upload tidak diterima.')

  const runForm = new FormData()
  runForm.append('task', task)
  runForm.append('server_filename', serverFilename)
  runForm.append('scale', String(scale))

  const result = await http(`https://${server}/v1/upscale`, {
    method: 'POST',
    headers,
    body: runForm,
    signal,
  })
  if (!result.ok) throw new Error(`Proses upscale gagal (${String(result.status)}).`)
  const contentType = result.headers.get('content-type') ?? ''
  if (!contentType.startsWith('image/')) {
    throw new Error('Layanan tidak mengembalikan gambar.')
  }
  return new Uint8Array(await result.arrayBuffer())
}


const MAX_INPUT_BYTES = 5_242_880

const USAGE = 'Kirim atau reply gambar dengan caption .hd (tambahkan 4 untuk 4x).'

export interface HdDeps {
  download(message: IncomingMessageContent): Promise<Readable>
  enhance(image: Uint8Array, scale: UpscaleScale): Promise<Uint8Array>
}

export function createHdCommand(deps: HdDeps): Command {
  return {
    name: 'hd',
    aliases: ['remini', 'upscale'],
    category: 'tools',
    description: 'Menaikkan resolusi gambar 2x atau 4x.',
    usage: 'hd [4] (kirim/reply gambar)',
    cooldownMs: 30_000,
    run: async (context: CommandContext): Promise<void> => {
      const source = resolveImageSource(context.message)
      if (source === undefined) {
        await context.reply(USAGE)
        return
      }

      const [requested] = context.args
      const scale: UpscaleScale = requested === '4' ? 4 : 2

      await context.react('⏳')
      try {
        const bytes = await collectStream(await deps.download(source), MAX_INPUT_BYTES)
        const enhanced = await deps.enhance(bytes, scale)
        await context.replyImage(enhanced, {
          mimetype: 'image/jpeg',
          caption: `Hasil upscale ${String(scale)}x`,
        })
      } catch (error) {
        await context.reply(
          error instanceof RangeError
            ? 'Gambarnya terlalu besar. Coba yang lebih kecil.'
            : 'Gagal menaikkan resolusi gambar itu.',
        )
      }
    },
  }
}

export default createHdCommand({
  download: (message) => downloadMediaMessage(message),
  enhance: (image, scale) => upscale(image, scale),
})
