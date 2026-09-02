import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import sharp from 'sharp'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  ProfileBrandingInputError,
  createProfileBrandingService,
  resizeProfileJpeg,
} from '../../lib/profile/branding.js'

const tempPaths: string[] = []

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'zapo-branding-'))
  tempPaths.push(directory)
  return directory
}

async function png(width = 12, height = 8): Promise<Uint8Array> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 20, g: 80, b: 140 } },
  })
    .png()
    .toBuffer()
}

function fakeProfile() {
  return {
    setPushName: vi.fn(() => Promise.resolve()),
    setProfilePicture: vi.fn((imageBytes: Uint8Array) => {
      void imageBytes
      return Promise.resolve('picture-id')
    }),
    deleteProfilePicture: vi.fn(() => Promise.resolve()),
    setStatus: vi.fn(() => Promise.resolve()),
  }
}

function imageMessage(mimetype = 'image/png') {
  return { imageMessage: { mimetype } }
}

afterEach(async () => {
  await Promise.all(tempPaths.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('profile branding service', () => {
  it('center-crops profile media to a deterministic 640px JPEG before calling Zapo', async () => {
    const input = await png()
    const profile = fakeProfile()
    const service = createProfileBrandingService({
      profile,
      download: () => Promise.resolve(Readable.from([input])),
      resize: resizeProfileJpeg,
      thumbnailPath: path.join(await temporaryDirectory(), 'menu-thumbnail.jpg'),
    })

    await service.setProfilePicture(imageMessage())

    const uploaded = profile.setProfilePicture.mock.calls[0]?.[0]
    expect(uploaded).toBeInstanceOf(Uint8Array)
    const metadata = await sharp(uploaded).metadata()
    expect(metadata).toMatchObject({ format: 'jpeg', width: 640, height: 640 })
    expect(await resizeProfileJpeg(input)).toEqual(await resizeProfileJpeg(input))
  })

  it('validates push names and About text before calling the coordinator', async () => {
    const profile = fakeProfile()
    const service = createProfileBrandingService({
      profile,
      download: () => Promise.resolve(Readable.from([])),
      resize: (input) => Promise.resolve(input),
      thumbnailPath: path.join(await temporaryDirectory(), 'menu-thumbnail.jpg'),
    })

    await service.setName('YZF Bot')
    await service.setAbout('Bot siap membantu.')
    expect(profile.setPushName).toHaveBeenCalledWith('YZF Bot')
    expect(profile.setStatus).toHaveBeenCalledWith('Bot siap membantu.')

    await expect(service.setName(' '.repeat(4))).rejects.toBeInstanceOf(ProfileBrandingInputError)
    await expect(service.setName('x'.repeat(26))).rejects.toBeInstanceOf(ProfileBrandingInputError)
    await expect(service.setAbout('x'.repeat(140))).rejects.toBeInstanceOf(ProfileBrandingInputError)
    expect(profile.setPushName).toHaveBeenCalledOnce()
    expect(profile.setStatus).toHaveBeenCalledOnce()
  })

  it('rejects non-image, mismatched, and oversized media before resize or coordinator calls', async () => {
    const profile = fakeProfile()
    const resize = vi.fn((input: Uint8Array) => Promise.resolve(input))
    const validPng = await png()
    const service = createProfileBrandingService({
      profile,
      download: () => Promise.resolve(Readable.from([validPng])),
      resize,
      maxImageBytes: validPng.byteLength - 1,
      thumbnailPath: path.join(await temporaryDirectory(), 'menu-thumbnail.jpg'),
    })

    await expect(service.setProfilePicture(imageMessage('video/mp4'))).rejects.toBeInstanceOf(ProfileBrandingInputError)
    await expect(service.setProfilePicture(imageMessage('image/jpeg'))).rejects.toBeInstanceOf(ProfileBrandingInputError)
    await expect(service.setProfilePicture(imageMessage('image/png'))).rejects.toBeInstanceOf(ProfileBrandingInputError)
    expect(resize).not.toHaveBeenCalled()
    expect(profile.setProfilePicture).not.toHaveBeenCalled()
  })

  it('stores and deletes the menu thumbnail atomically with private permissions', async () => {
    const directory = await temporaryDirectory()
    const thumbnailPath = path.join(directory, 'assets', 'menu-thumbnail.jpg')
    const input = await png()
    const output = new Uint8Array([0xff, 0xd8, 0xff, 0xd9])
    const profile = fakeProfile()
    const service = createProfileBrandingService({
      profile,
      download: () => Promise.resolve(Readable.from([input])),
      resize: () => Promise.resolve(output),
      thumbnailPath,
    })

    await service.setThumbnail(imageMessage())

    expect(await readFile(thumbnailPath)).toEqual(Buffer.from(output))
    expect((await stat(path.dirname(thumbnailPath))).mode & 0o777).toBe(0o700)
    expect((await stat(thumbnailPath)).mode & 0o777).toBe(0o600)
    expect(profile.setProfilePicture).not.toHaveBeenCalled()
    expect((await stat(path.dirname(thumbnailPath))).isDirectory()).toBe(true)

    await service.deleteThumbnail()
    await expect(stat(thumbnailPath)).rejects.toMatchObject({ code: 'ENOENT' })
    expect(profile.deleteProfilePicture).not.toHaveBeenCalled()
  })

  it('replaces an existing thumbnail without inheriting broad permissions', async () => {
    const directory = await temporaryDirectory()
    const thumbnailPath = path.join(directory, 'assets', 'menu-thumbnail.jpg')
    await mkdir(path.dirname(thumbnailPath), { recursive: true })
    await writeFile(thumbnailPath, 'old')
    await chmod(thumbnailPath, 0o644)
    const input = await png()
    const service = createProfileBrandingService({
      profile: fakeProfile(),
      download: () => Promise.resolve(Readable.from([input])),
      resize: () => Promise.resolve(new Uint8Array([0xff, 0xd8, 0xff, 0xd9])),
      thumbnailPath,
    })

    await service.setThumbnail(imageMessage())

    expect((await stat(thumbnailPath)).mode & 0o777).toBe(0o600)
  })

  it('keeps profile deletion separate from thumbnail deletion', async () => {
    const profile = fakeProfile()
    const thumbnailPath = path.join(await temporaryDirectory(), 'menu-thumbnail.jpg')
    const service = createProfileBrandingService({
      profile,
      download: () => Promise.resolve(Readable.from([])),
      resize: (input) => Promise.resolve(input),
      thumbnailPath,
    })

    await service.deleteProfilePicture()

    expect(profile.deleteProfilePicture).toHaveBeenCalledOnce()
    await expect(stat(thumbnailPath)).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
