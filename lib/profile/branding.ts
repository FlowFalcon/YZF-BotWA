import { randomUUID } from 'node:crypto'
import { chmod, mkdir, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Readable } from 'node:stream'
import sharp from 'sharp'

import type { IncomingMessageContent } from '../media/types.js'

const DEFAULT_MAX_IMAGE_BYTES = 8 * 1024 * 1024
const PROFILE_SIZE = 640
const MAX_NAME_LENGTH = 25
const MAX_ABOUT_LENGTH = 139
const DEFAULT_THUMBNAIL_PATH = path.resolve('.auth/assets/menu-thumbnail.jpg')
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/u

export interface ProfileCoordinator {
  setPushName(name: string): Promise<void>
  setProfilePicture(imageBytes: Uint8Array): Promise<string | null>
  deleteProfilePicture(): Promise<void>
  setStatus(text: string): Promise<void>
}

export interface ProfileBrandingService {
  setName(name: string): Promise<void>
  setProfilePicture(message: IncomingMessageContent | undefined): Promise<void>
  deleteProfilePicture(): Promise<void>
  setAbout(text: string): Promise<void>
  setThumbnail(message: IncomingMessageContent | undefined): Promise<void>
  deleteThumbnail(): Promise<void>
}

export interface ProfileBrandingDependencies {
  readonly profile: ProfileCoordinator
  readonly download: (message: IncomingMessageContent) => Promise<Readable>
  readonly resize: (input: Uint8Array) => Promise<Uint8Array>
  readonly thumbnailPath?: string
  readonly maxImageBytes?: number
}

export class ProfileBrandingInputError extends Error {
  override readonly name = 'ProfileBrandingInputError'
}


interface ImageSource {
  readonly message: IncomingMessageContent
  readonly mimetype: string
}

type SupportedImageType = 'jpeg' | 'png' | 'webp'

function codePointLength(value: string): number {
  return [...value].length
}

function requireText(value: string, label: string, maxLength: number): string {
  const trimmed = value.trim()
  if (trimmed === '') throw new ProfileBrandingInputError(`${label} tidak boleh kosong.`)
  if (CONTROL_CHARACTERS.test(trimmed)) {
    throw new ProfileBrandingInputError(`${label} tidak boleh memuat karakter kontrol.`)
  }
  if (codePointLength(trimmed) > maxLength) {
    throw new ProfileBrandingInputError(`${label} maksimal ${String(maxLength)} karakter.`)
  }
  return trimmed
}

function pickImage(message: IncomingMessageContent): ImageSource | undefined {
  const image = message.imageMessage
  if (image === null || image === undefined) return undefined
  const mimetype = image.mimetype
  if (mimetype === null || mimetype === undefined) return undefined
  return { message: { imageMessage: image }, mimetype }
}

function resolveImageSource(message: IncomingMessageContent | undefined): ImageSource {
  if (message === undefined) {
    throw new ProfileBrandingInputError('Kirim atau reply gambar JPEG, PNG, atau WebP.')
  }

  const direct = pickImage(message)
  if (direct !== undefined) return validateDeclaredType(direct)

  const quoted =
    message.extendedTextMessage?.contextInfo?.quotedMessage ??
    message.imageMessage?.contextInfo?.quotedMessage
  const source = quoted === null || quoted === undefined ? undefined : pickImage(quoted)
  if (source === undefined) {
    throw new ProfileBrandingInputError('Kirim atau reply gambar JPEG, PNG, atau WebP.')
  }
  return validateDeclaredType(source)
}

function declaredType(mimetype: string): SupportedImageType | undefined {
  if (mimetype === 'image/jpeg' || mimetype === 'image/jpg') return 'jpeg'
  if (mimetype === 'image/png') return 'png'
  if (mimetype === 'image/webp') return 'webp'
  return undefined
}

function validateDeclaredType(source: ImageSource): ImageSource {
  if (declaredType(source.mimetype) === undefined) {
    throw new ProfileBrandingInputError('Format gambar harus JPEG, PNG, atau WebP.')
  }
  return source
}

function detectedType(bytes: Uint8Array): SupportedImageType | undefined {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpeg'
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'png'
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'webp'
  }
  return undefined
}

async function collectImage(stream: Readable, maxBytes: number): Promise<Uint8Array> {
  const chunks: Uint8Array[] = []
  let size = 0
  for await (const chunk of stream) {
    const bytes = chunk as Uint8Array
    size += bytes.byteLength
    if (size > maxBytes) {
      throw new ProfileBrandingInputError(
        `Gambar terlalu besar. Batasnya ${String(Math.floor(maxBytes / (1024 * 1024)))} MB.`,
      )
    }
    chunks.push(bytes)
  }

  const result = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.byteLength
  }
  return result
}

async function readImage(
  deps: ProfileBrandingDependencies,
  message: IncomingMessageContent | undefined,
  maxBytes: number,
): Promise<Uint8Array> {
  const source = resolveImageSource(message)
  const bytes = await collectImage(await deps.download(source.message), maxBytes)
  const actual = detectedType(bytes)
  if (actual === undefined || actual !== declaredType(source.mimetype)) {
    throw new ProfileBrandingInputError('Isi gambar tidak sesuai format JPEG, PNG, atau WebP.')
  }
  return deps.resize(bytes)
}

async function atomicWritePrivate(file: string, bytes: Uint8Array): Promise<void> {
  const directory = path.dirname(file)
  await mkdir(directory, { recursive: true, mode: 0o700 })
  await chmod(directory, 0o700)
  const temporary = `${file}.${process.pid}-${randomUUID()}.tmp`
  try {
    await writeFile(temporary, bytes, { mode: 0o600, flag: 'wx' })
    await rename(temporary, file)
    await chmod(file, 0o600)
  } catch (error) {
    await rm(temporary, { force: true })
    throw error
  }
}

export async function resizeProfileJpeg(input: Uint8Array): Promise<Uint8Array> {
  const output = await sharp(input, { failOn: 'error', limitInputPixels: 40_000_000 })
    .rotate()
    .resize(PROFILE_SIZE, PROFILE_SIZE, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 82, progressive: false, chromaSubsampling: '4:2:0', mozjpeg: false })
    .toBuffer()
  return new Uint8Array(output)
}

export function createProfileBrandingService(
  deps: ProfileBrandingDependencies,
): ProfileBrandingService {
  const maxImageBytes = deps.maxImageBytes ?? DEFAULT_MAX_IMAGE_BYTES
  const thumbnailPath = deps.thumbnailPath ?? DEFAULT_THUMBNAIL_PATH

  return {
    async setName(name) {
      await deps.profile.setPushName(requireText(name, 'Nama', MAX_NAME_LENGTH))
    },
    async setProfilePicture(message) {
      await deps.profile.setProfilePicture(await readImage(deps, message, maxImageBytes))
    },
    deleteProfilePicture: () => deps.profile.deleteProfilePicture(),
    async setAbout(text) {
      await deps.profile.setStatus(requireText(text, 'About', MAX_ABOUT_LENGTH))
    },
    async setThumbnail(message) {
      await atomicWritePrivate(thumbnailPath, await readImage(deps, message, maxImageBytes))
    },
    async deleteThumbnail() {
      await rm(thumbnailPath, { force: true })
    },
  }
}
