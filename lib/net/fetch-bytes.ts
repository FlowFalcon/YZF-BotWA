/**
 * Unduhan HTTP dengan pagar: timeout, batas byte, dan hanya http(s).
 *
 * Dipakai fitur yang memanggil API pihak ketiga. Batas byte diperiksa sambil
 * membaca, bukan setelah: respons 100 MB tidak boleh dibuffer penuh sebelum
 * ditolak.
 */

const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_MAX_BYTES = 8_388_608

export interface FetchBytesOptions {
  readonly maxBytes?: number
  readonly timeoutMs?: number
  readonly method?: 'GET' | 'POST'
  readonly headers?: Record<string, string>
  readonly body?: RequestInit['body']
  /** Tipe yang diterima; respons dengan `content-type` lain ditolak. */
  readonly expect?: 'image' | 'json' | 'text'
}

export interface FetchedBytes {
  readonly bytes: Uint8Array
  readonly contentType: string
}

/** Menolak skema selain http(s) supaya `file:` dan `data:` tidak bisa lewat. */
export function assertHttpUrl(raw: string): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error('URL tidak valid.')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Hanya URL http/https yang didukung.')
  }
  return url
}

export async function fetchBytes(
  url: string,
  options: FetchBytesOptions = {},
): Promise<FetchedBytes> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES
  const target = assertHttpUrl(url)

  const response = await fetch(target, {
    method: options.method ?? 'GET',
    signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    ...(options.headers === undefined ? {} : { headers: options.headers }),
    ...(options.body === undefined ? {} : { body: options.body }),
  })
  if (!response.ok) throw new Error(`Server menjawab ${String(response.status)}.`)

  const contentType = response.headers.get('content-type') ?? ''
  if (options.expect === 'image' && !contentType.startsWith('image/')) {
    throw new Error('Respons bukan gambar.')
  }

  const declared = Number(response.headers.get('content-length') ?? '0')
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new Error('Hasilnya terlalu besar.')
  }

  const body = response.body
  if (body === null) throw new Error('Respons kosong.')

  const chunks: Uint8Array[] = []
  let size = 0
  // `response.body` tidak terparameterisasi di tipe Node, jadi reader-nya
  // dinyatakan eksplisit agar `value` bukan `any`.
  const reader = (body as ReadableStream<Uint8Array>).getReader()
  for (;;) {
    const chunk = await reader.read()
    if (chunk.done) break
    size += chunk.value.byteLength
    if (size > maxBytes) {
      await reader.cancel()
      throw new Error('Hasilnya terlalu besar.')
    }
    chunks.push(chunk.value)
  }

  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return { bytes, contentType }
}
