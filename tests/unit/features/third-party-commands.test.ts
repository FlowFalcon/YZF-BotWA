import { describe, expect, it } from 'vitest'

import type { Command } from '../../../lib/commands/command.js'
import { createHdCommand } from '../../../plugins/tools/hd.js'
import qrcode from '../../../plugins/tools/qrcode.js'
import ssweb from '../../../plugins/tools/ssweb.js'
import { fakeContext } from '../../fixtures/context.js'
import { Readable } from 'node:stream'

interface Sent {
  readonly bytes: Uint8Array
  readonly mimetype: string
  readonly caption?: string
}

function harness(parts: {
  readonly args?: readonly string[]
  readonly text?: string
  readonly message?: object
} = {}) {
  const replies: string[] = []
  const images: Sent[] = []
  const reactions: string[] = []
  const context = fakeContext({
    args: parts.args ?? [],
    text: parts.text ?? (parts.args ?? []).join(' '),
    reply: (content) => { replies.push(content); return Promise.resolve() },
    replyImage: (bytes, options) => {
      images.push({ bytes, mimetype: options.mimetype, ...(options.caption === undefined ? {} : { caption: options.caption }) })
      return Promise.resolve()
    },
    react: (emoji) => { reactions.push(emoji); return Promise.resolve() },
    ...(parts.message === undefined ? {} : { message: parts.message }),
  })
  return { context, replies, images, reactions }
}

describe('qrcode', () => {
  it('asks for text when none is given', async () => {
    const h = harness()

    await qrcode.run(h.context)

    expect(h.replies[0]).toContain('qrcode')
    expect(h.images).toEqual([])
  })

  it('refuses text longer than a QR code can hold', async () => {
    const h = harness({ text: 'x'.repeat(1_000) })

    await qrcode.run(h.context)

    expect(h.replies[0]).toContain('karakter')
    expect(h.images).toEqual([])
  })
})

describe('ssweb', () => {
  it('asks for a URL when none is given', async () => {
    const h = harness()

    await ssweb.run(h.context)

    expect(h.replies[0]).toContain('ssweb')
  })

  it('rejects a non-http scheme before any request', async () => {
    const h = harness({ text: 'file:///etc/passwd' })

    await ssweb.run(h.context)

    expect(h.replies[0]).toContain('http')
    expect(h.reactions).toEqual([])
  })
})

describe('hd', () => {
  const IMAGE = { imageMessage: { url: 'https://mmg.whatsapp.net/x', mimetype: 'image/jpeg' } }

  function hd(overrides: {
    readonly enhance?: (image: Uint8Array, scale: 2 | 4) => Promise<Uint8Array>
    readonly bytes?: Uint8Array
  } = {}): Command {
    return createHdCommand({
      download: () => Promise.resolve(Readable.from([overrides.bytes ?? new Uint8Array([1, 2, 3])])),
      enhance: overrides.enhance ?? (() => Promise.resolve(new Uint8Array([9, 9]))),
    })
  }

  it('explains usage when no image is attached', async () => {
    const h = harness()

    await hd().run(h.context)

    expect(h.replies[0]).toContain('.hd')
    expect(h.images).toEqual([])
  })

  it('upscales an attached image at 2x by default', async () => {
    const scales: number[] = []
    const h = harness({ message: IMAGE })

    await hd({ enhance: (_image, scale) => { scales.push(scale); return Promise.resolve(new Uint8Array([7])) } })
      .run(h.context)

    expect(scales).toEqual([2])
    expect(h.images[0]?.bytes).toEqual(new Uint8Array([7]))
    expect(h.images[0]?.caption).toContain('2x')
  })

  it('honours an explicit 4x request', async () => {
    const scales: number[] = []
    const h = harness({ args: ['4'], message: IMAGE })

    await hd({ enhance: (_image, scale) => { scales.push(scale); return Promise.resolve(new Uint8Array([7])) } })
      .run(h.context)

    expect(scales).toEqual([4])
  })

  it('reports a service failure instead of throwing', async () => {
    const h = harness({ message: IMAGE })

    await hd({ enhance: () => Promise.reject(new Error('upstream 502')) }).run(h.context)

    expect(h.replies[0]).toContain('Gagal')
    // The upstream message must not reach the chat (SECURITY.md §5).
    expect(h.replies[0]).not.toContain('502')
  })

  it('refuses media that is not a still image', async () => {
    const h = harness({ message: { videoMessage: { url: 'https://mmg.whatsapp.net/v' } } })

    await hd().run(h.context)

    expect(h.replies[0]).toContain('.hd')
    expect(h.images).toEqual([])
  })
})
