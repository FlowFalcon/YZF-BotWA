import { describe, expect, it, vi } from 'vitest'

import { qrcodeUrl } from '../../plugins/tools/qrcode.js'
import { screenshotUrl } from '../../plugins/tools/ssweb.js'
import { upscale } from '../../plugins/tools/hd.js'
import { assertHttpUrl } from '../../lib/net/fetch-bytes.js'

describe('qrcodeUrl', () => {
  it('encodes the payload into the query string', () => {
    const url = new URL(qrcodeUrl('hello world'))
    expect(url.searchParams.get('text')).toBe('hello world')
    expect(url.searchParams.get('size')).toBe('512')
  })

  it('escapes characters that would otherwise break the query', () => {
    expect(qrcodeUrl('a&b=c')).toContain('text=a%26b%3Dc')
  })
})

describe('screenshotUrl', () => {
  it('accepts a bare host and adds https', () => {
    expect(screenshotUrl('example.com')).toContain('https://example.com')
  })

  it('keeps an explicit scheme', () => {
    expect(screenshotUrl('http://example.com/x')).toContain('http://example.com/x')
  })

  it('rejects a non-http scheme', () => {
    expect(() => screenshotUrl('file:///etc/passwd')).toThrow(/http/)
  })
})

describe('assertHttpUrl', () => {
  it('rejects data URLs', () => {
    expect(() => assertHttpUrl('data:text/plain,hi')).toThrow(/http/)
  })

  it('rejects malformed input', () => {
    expect(() => assertHttpUrl('not a url')).toThrow(/valid/)
  })
})

describe('upscale', () => {
  const PAGE = `<html><meta name="csrf-token" content="CSRF1">
    <script>var ilovepdfConfig = {"token":"TOKEN1"};</script></html>`

  function requestUrl(input: string | URL | Request): string {
    if (typeof input === 'string') return input
    return input instanceof URL ? input.href : input.url
  }

  interface Sent {
    readonly url: string
    readonly init?: RequestInit
  }

  function fakeFetch(overrides: Record<string, () => Response> = {}) {
    const sent: Sent[] = []
    const impl = vi.fn((input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const url = requestUrl(input)
      sent.push({ url, ...(init === undefined ? {} : { init }) })
      const respond = (response: Response): Promise<Response> => Promise.resolve(response)
      const override = Object.entries(overrides).find(([key]) => url.includes(key))
      if (override !== undefined) return respond(override[1]())
      if (url.includes('upscale-image')) return respond(new Response(PAGE, { status: 200 }))
      if (url.includes('/v1/start/')) {
        return respond(Response.json({ server: 'api1g.iloveimg.com', task: 'TASK1' }))
      }
      if (url.includes('/v1/upload')) return respond(Response.json({ server_filename: 'f.jpg' }))
      if (url.includes('/v1/upscale')) {
        return respond(
          new Response(new Uint8Array([0xff, 0xd8, 0xff]), {
            status: 200,
            headers: { 'content-type': 'image/jpeg' },
          }),
        )
      }
      throw new Error(`unexpected request: ${url}`)
    })
    return { impl, sent }
  }

  it('returns the upscaled bytes', async () => {
    const { impl: fetchImpl } = fakeFetch()

    const result = await upscale(new Uint8Array([1, 2, 3]), 2, { fetchImpl })

    expect(result.byteLength).toBe(3)
  })

  it('carries the bearer token and csrf cookie on the upload', async () => {
    const { impl: fetchImpl, sent } = fakeFetch()

    await upscale(new Uint8Array([1]), 2, { fetchImpl })

    const upload = sent.find((request) => request.url.includes('/v1/upload'))
    const headers = (upload?.init?.headers ?? {}) as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer TOKEN1')
    expect(headers['Cookie']).toBe('_csrf=CSRF1')
  })

  it('fails with a clear message when the page layout changes', async () => {
    const { impl: fetchImpl } = fakeFetch({ 'upscale-image': () => new Response('<html></html>') })

    await expect(upscale(new Uint8Array([1]), 2, { fetchImpl })).rejects.toThrow(/token/i)
  })

  it('fails when the upscale response is not an image', async () => {
    const { impl: fetchImpl } = fakeFetch({
      '/v1/upscale': () =>
        new Response('{"error":"nope"}', { status: 200, headers: { 'content-type': 'application/json' } }),
    })

    await expect(upscale(new Uint8Array([1]), 2, { fetchImpl })).rejects.toThrow(/gambar/i)
  })

  it('rejects a scale the service does not offer', async () => {
    const { impl: fetchImpl } = fakeFetch()

    await expect(upscale(new Uint8Array([1]), 8 as 2, { fetchImpl })).rejects.toThrow(/skala/i)
  })
})
