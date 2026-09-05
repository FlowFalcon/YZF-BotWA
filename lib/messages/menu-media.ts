import { readFile, stat } from 'node:fs/promises'

/**
 * Menu media. Live render matrix (2026-09-03) menetapkan satu-satunya jalur yang
 * menampilkan gambar DAN tombol pada Phone maupun Web:
 * `interactiveMessage.header.imageMessage` dengan media yang benar-benar
 * di-upload ke CDN.
 *
 * Dua aset terpisah: header menu memakai `menuImagePath`, kartu reply memakai
 * `replyImagePath`. `.setthumbnail` hanya menimpa yang menu — kartu reply punya
 * rasio dan komposisi sendiri, jadi satu file untuk keduanya selalu salah di
 * salah satu surface.
 *
 * Upload di-cache: satu descriptor CDN dipakai ulang untuk semua pengiriman
 * berikutnya, dan hanya dibuat lagi ketika file sumbernya berganti.
 */

const BOT_NAME = 'YZF-BotWA'
/** Sisi terpanjang media yang di-upload; cukup tajam untuk header, hemat untuk CDN. */
const HEADER_MAX_EDGE = 720
const HEADER_MAX_BYTES = 400 * 1024
/** Sisi terpanjang thumbnail inline. */
const THUMBNAIL_MAX_EDGE = 240
/** Batas inline zapo (`link-preview.js`); di atas ini field thumbnail dibuang tanpa peringatan. */
const THUMBNAIL_MAX_BYTES = 64 * 1024

/** Descriptor CDN dari `client.message.upload`, subset yang dipakai proto pesan. */
export interface UploadedMedia {
  readonly url: string
  readonly directPath: string
  readonly mediaKey: Uint8Array
  readonly fileSha256: Uint8Array
  readonly fileEncSha256: Uint8Array
  readonly fileLength: number
  readonly mediaKeyTimestamp: number
}

export interface FittedImage {
  readonly bytes: Uint8Array
  readonly width: number
  readonly height: number
}

export interface MenuMediaDependencies {
  /** Thumbnail menu yang ditulis `.setthumbnail`; menimpa `menuImagePath` bila ada. */
  readonly thumbnailPath: string
  /** Aset menu bawaan repo (`lib/images/mn.png`). */
  readonly menuImagePath: string
  /** Aset kartu reply (`lib/images/rp.png`); tidak ikut ditimpa `.setthumbnail`. */
  readonly replyImagePath: string
  /** Meng-upload JPEG ke CDN WhatsApp tanpa mengirim pesan. */
  readonly upload: (bytes: Uint8Array) => Promise<UploadedMedia>
  /** Mengecilkan JPEG agar masuk batas byte; zapo tidak punya codec gambar sendiri. */
  readonly fitJpeg: (bytes: Uint8Array, maxEdge: number, maxBytes: number) => Promise<FittedImage>
}

/** `InteractiveMessage.Header` dengan media nyata; satu-satunya bentuk yang render lintas klien. */
export interface MenuHeader {
  readonly title: string
  readonly subtitle: string
  readonly hasMediaAttachment: true
  readonly imageMessage: {
    readonly url: string
    readonly directPath: string
    readonly mediaKey: Uint8Array
    readonly fileSha256: Uint8Array
    readonly fileEncSha256: Uint8Array
    readonly fileLength: number
    readonly mediaKeyTimestamp: number
    readonly mimetype: 'image/jpeg'
    readonly width: number
    readonly height: number
    readonly jpegThumbnail: Uint8Array
  }
}

export interface MenuMediaService {
  /**
   * Header bergambar untuk surface menu. `undefined` bila asetnya tidak ada
   * atau upload gagal — pesan tetap terkirim tanpa gambar, tidak pernah dengan
   * gambar rusak.
   */
  header(subtitle: string): Promise<MenuHeader | undefined>
  /** Thumbnail inline untuk kartu reply; tidak memakai upload. */
  compact(): Promise<FittedImage | undefined>
}

/** Identitas file sumber. Path ikut dibandingkan: berpindah antara override dan
 * aset bawaan bisa kebetulan sama ukuran, dan cache basi berarti gambar salah. */
interface SourceKey {
  readonly path: string
  readonly size: number
  readonly mtimeMs: number
}

interface SourceState extends SourceKey {
  readonly bytes: Uint8Array
}

interface HeaderCache extends SourceKey {
  readonly media: UploadedMedia
  readonly image: FittedImage
  readonly thumbnail: Uint8Array
}

interface CompactCache extends SourceKey {
  readonly image: FittedImage
}

/** Kandidat pertama yang ada dipakai; sisanya diabaikan. */
async function readSource(candidates: readonly string[]): Promise<SourceState | undefined> {
  for (const candidate of candidates) {
    try {
      const info = await stat(candidate)
      return {
        path: candidate,
        bytes: new Uint8Array(await readFile(candidate)),
        size: info.size,
        mtimeMs: info.mtimeMs,
      }
    } catch {
      // Belum dipasang, baru dihapus lewat `.delthumbnail`, atau tidak ikut dipublikasikan.
    }
  }
  return undefined
}

function isStale(cache: SourceKey, source: SourceKey): boolean {
  return (
    cache.path !== source.path ||
    cache.size !== source.size ||
    cache.mtimeMs !== source.mtimeMs
  )
}

export function createMenuMediaService(deps: MenuMediaDependencies): MenuMediaService {
  let headerCache: HeaderCache | undefined
  let compactCache: CompactCache | undefined

  return {
    async header(subtitle) {
      const source = await readSource([deps.thumbnailPath, deps.menuImagePath])
      if (source === undefined) return undefined

      let cached = headerCache
      if (cached === undefined || isStale(cached, source)) {
        const image = await deps.fitJpeg(source.bytes, HEADER_MAX_EDGE, HEADER_MAX_BYTES)
        const thumbnail = await deps.fitJpeg(source.bytes, THUMBNAIL_MAX_EDGE, THUMBNAIL_MAX_BYTES)
        let media: UploadedMedia
        try {
          media = await deps.upload(image.bytes)
        } catch {
          // Upload gagal (media_conn/CDN): kirim tanpa header, dan coba lagi
          // pada pemanggilan berikutnya — kegagalan tidak di-cache.
          return undefined
        }
        cached = {
          path: source.path,
          size: source.size,
          mtimeMs: source.mtimeMs,
          media,
          image,
          thumbnail: thumbnail.bytes,
        }
        headerCache = cached
      }

      const { media, image, thumbnail } = cached
      return {
        title: BOT_NAME,
        subtitle,
        hasMediaAttachment: true,
        imageMessage: {
          url: media.url,
          directPath: media.directPath,
          mediaKey: media.mediaKey,
          fileSha256: media.fileSha256,
          fileEncSha256: media.fileEncSha256,
          fileLength: media.fileLength,
          mediaKeyTimestamp: media.mediaKeyTimestamp,
          mimetype: 'image/jpeg',
          width: image.width,
          height: image.height,
          jpegThumbnail: thumbnail,
        },
      }
    },

    async compact() {
      const source = await readSource([deps.replyImagePath])
      if (source === undefined) return undefined

      let cached = compactCache
      if (cached === undefined || isStale(cached, source)) {
        // Aset sumber berukuran megabyte; re-encode setiap reply itu pemborosan
        // CPU yang terlihat pada balasan beruntun.
        cached = {
          path: source.path,
          size: source.size,
          mtimeMs: source.mtimeMs,
          image: await deps.fitJpeg(source.bytes, THUMBNAIL_MAX_EDGE, THUMBNAIL_MAX_BYTES),
        }
        compactCache = cached
      }

      return cached.image
    },
  }
}
