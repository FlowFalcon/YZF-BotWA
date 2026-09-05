import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { createMenuMediaService } from '../../lib/messages/menu-media.js'
import type { MenuMediaDependencies, UploadedMedia } from '../../lib/messages/menu-media.js'

const SOURCE = new Uint8Array([0xff, 0xd8, 0xff, 0x01, 0x02, 0x03])
/** Aset bawaan repo; byte-nya berbeda supaya asal gambar bisa dibedakan di test. */
const MENU_ASSET = new Uint8Array([0xff, 0xd8, 0xff, 0x11, 0x11, 0x11, 0x11])
const REPLY_ASSET = new Uint8Array([0xff, 0xd8, 0xff, 0x22, 0x22, 0x22, 0x22, 0x22])

function descriptor(seed: number): UploadedMedia {
  return {
    url: `https://mmg.whatsapp.net/${String(seed)}`,
    directPath: `/o1/v/t24/${String(seed)}`,
    mediaKey: new Uint8Array([seed]),
    fileSha256: new Uint8Array([seed, 1]),
    fileEncSha256: new Uint8Array([seed, 2]),
    fileLength: 1_000 + seed,
    mediaKeyTimestamp: 1_700_000_000 + seed,
  }
}

interface Harness {
  readonly deps: MenuMediaDependencies
  readonly thumbnailPath: string
  readonly menuImagePath: string
  readonly replyImagePath: string
  readonly directory: string
  readonly uploads: number[]
  readonly fits: { maxEdge: number; maxBytes: number }[]
}

async function harness(overrides: Partial<MenuMediaDependencies> = {}): Promise<Harness> {
  const directory = await mkdtemp(path.join(tmpdir(), 'yzf-menu-media-'))
  const thumbnailPath = path.join(directory, 'menu-thumbnail.jpg')
  const menuImagePath = path.join(directory, 'mn.png')
  const replyImagePath = path.join(directory, 'rp.png')
  await writeFile(thumbnailPath, SOURCE)
  await writeFile(menuImagePath, MENU_ASSET)
  await writeFile(replyImagePath, REPLY_ASSET)

  const uploads: number[] = []
  const fits: { maxEdge: number; maxBytes: number }[] = []
  const deps: MenuMediaDependencies = {
    thumbnailPath,
    menuImagePath,
    replyImagePath,
    upload: (bytes) => {
      uploads.push(bytes.byteLength)
      return Promise.resolve(descriptor(uploads.length))
    },
    fitJpeg: (bytes, maxEdge, maxBytes) => {
      fits.push({ maxEdge, maxBytes })
      return Promise.resolve({
        bytes: bytes.slice(0, 4),
        width: maxEdge,
        height: maxEdge,
      })
    },
    ...overrides,
  }
  return { deps, thumbnailPath, menuImagePath, replyImagePath, directory, uploads, fits }
}

describe('createMenuMediaService', () => {
  it('builds an interactive header carrying real uploaded media plus an inline thumbnail', async () => {
    const h = await harness()
    try {
      const service = createMenuMediaService(h.deps)
      const header = await service.header('WhatsApp bot modular')

      expect(header).toEqual({
        title: 'YZF-BotWA',
        subtitle: 'WhatsApp bot modular',
        hasMediaAttachment: true,
        imageMessage: {
          url: 'https://mmg.whatsapp.net/1',
          directPath: '/o1/v/t24/1',
          mediaKey: new Uint8Array([1]),
          fileSha256: new Uint8Array([1, 1]),
          fileEncSha256: new Uint8Array([1, 2]),
          fileLength: 1_001,
          mediaKeyTimestamp: 1_700_000_001,
          mimetype: 'image/jpeg',
          width: 720,
          height: 720,
          jpegThumbnail: SOURCE.slice(0, 4),
        },
      })
    } finally {
      await rm(h.directory, { recursive: true, force: true })
    }
  })

  it('uploads once and reuses the descriptor while the file is unchanged', async () => {
    const h = await harness()
    try {
      const service = createMenuMediaService(h.deps)

      await service.header('a')
      await service.header('b')
      await service.header('c')

      expect(h.uploads).toHaveLength(1)
    } finally {
      await rm(h.directory, { recursive: true, force: true })
    }
  })

  it('re-uploads after .setthumbnail replaces the file', async () => {
    const h = await harness()
    try {
      const service = createMenuMediaService(h.deps)
      await service.header('a')

      // A new thumbnail changes size and mtime; the cached CDN copy is stale.
      await writeFile(h.thumbnailPath, new Uint8Array([0xff, 0xd8, 0xff, 0x09, 0x09, 0x09, 0x09]))
      await service.header('b')

      expect(h.uploads).toHaveLength(2)
    } finally {
      await rm(h.directory, { recursive: true, force: true })
    }
  })

  it('falls back to the bundled menu asset when no thumbnail is installed', async () => {
    const h = await harness()
    try {
      await rm(h.thumbnailPath, { force: true })
      const service = createMenuMediaService(h.deps)

      const header = await service.header('x')

      expect(header?.imageMessage.jpegThumbnail).toEqual(MENU_ASSET.slice(0, 4))
      expect(h.uploads).toHaveLength(1)
    } finally {
      await rm(h.directory, { recursive: true, force: true })
    }
  })

  it('re-uploads when .setthumbnail overrides the bundled asset', async () => {
    const h = await harness()
    try {
      await rm(h.thumbnailPath, { force: true })
      const service = createMenuMediaService(h.deps)
      await service.header('x')

      // Switching source file must invalidate the cache even when size matches.
      await writeFile(h.thumbnailPath, SOURCE)
      const header = await service.header('x')

      expect(header?.imageMessage.jpegThumbnail).toEqual(SOURCE.slice(0, 4))
      expect(h.uploads).toHaveLength(2)
    } finally {
      await rm(h.directory, { recursive: true, force: true })
    }
  })

  it('returns undefined when neither the override nor the bundled asset exists', async () => {
    const h = await harness()
    try {
      await rm(h.thumbnailPath, { force: true })
      await rm(h.menuImagePath, { force: true })
      await rm(h.replyImagePath, { force: true })
      const service = createMenuMediaService(h.deps)

      expect(await service.header('x')).toBeUndefined()
      expect(await service.compact()).toBeUndefined()
      expect(h.uploads).toHaveLength(0)
    } finally {
      await rm(h.directory, { recursive: true, force: true })
    }
  })

  it('degrades to no header when the CDN upload fails', async () => {
    const h = await harness({ upload: () => Promise.reject(new Error('media_conn timeout')) })
    try {
      const service = createMenuMediaService(h.deps)

      expect(await service.header('x')).toBeUndefined()
    } finally {
      await rm(h.directory, { recursive: true, force: true })
    }
  })

  it('retries the upload on the next call after a failure', async () => {
    const h = await harness()
    let attempts = 0
    const service = createMenuMediaService({
      ...h.deps,
      upload: (bytes) => {
        attempts += 1
        if (attempts === 1) return Promise.reject(new Error('media_conn timeout'))
        return Promise.resolve(descriptor(bytes.byteLength))
      },
    })
    try {
      expect(await service.header('x')).toBeUndefined()
      expect(await service.header('x')).toBeDefined()
      expect(attempts).toBe(2)
    } finally {
      await rm(h.directory, { recursive: true, force: true })
    }
  })

  it('fits the inline thumbnail under the 64 KiB inline cap and the upload under 720px', async () => {
    const h = await harness()
    try {
      const service = createMenuMediaService(h.deps)
      await service.header('x')

      expect(h.fits).toEqual([
        { maxEdge: 720, maxBytes: 400 * 1024 },
        { maxEdge: 240, maxBytes: 64 * 1024 },
      ])
    } finally {
      await rm(h.directory, { recursive: true, force: true })
    }
  })

  it('builds the reply thumbnail from the reply asset, not the menu one', async () => {
    const h = await harness()
    try {
      const service = createMenuMediaService(h.deps)

      const compact = await service.compact()

      expect(compact).toEqual({ bytes: REPLY_ASSET.slice(0, 4), width: 240, height: 240 })
      expect(h.uploads).toHaveLength(0)
    } finally {
      await rm(h.directory, { recursive: true, force: true })
    }
  })

  it('fits the reply thumbnail once and reuses it while the file is unchanged', async () => {
    const h = await harness()
    try {
      const service = createMenuMediaService(h.deps)

      await service.compact()
      await service.compact()
      await service.compact()

      // Re-encoding a multi-megabyte PNG on every reply is the cost this guards.
      expect(h.fits).toEqual([{ maxEdge: 240, maxBytes: 64 * 1024 }])
    } finally {
      await rm(h.directory, { recursive: true, force: true })
    }
  })

  it('re-fits the reply thumbnail after the asset changes', async () => {
    const h = await harness()
    try {
      const service = createMenuMediaService(h.deps)
      await service.compact()

      await writeFile(h.replyImagePath, new Uint8Array([0xff, 0xd8, 0xff, 0x33, 0x33]))
      const compact = await service.compact()

      expect(compact?.bytes).toEqual(new Uint8Array([0xff, 0xd8, 0xff, 0x33]))
      expect(h.fits).toHaveLength(2)
    } finally {
      await rm(h.directory, { recursive: true, force: true })
    }
  })
})
