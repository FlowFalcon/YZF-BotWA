import sharp from 'sharp'

/**
 * Mengecilkan gambar apa pun menjadi JPEG yang pasti masuk batas byte.
 *
 * zapo-js tidak punya codec gambar: `width`/`height` pada payload hanyalah
 * label, dan field thumbnail yang melewati batas dibuang tanpa peringatan.
 * Jadi ukuran harus diselesaikan di sisi kita sebelum byte-nya dikirim.
 */

/** Turun bertahap; kualitas pertama yang masuk budget dipakai. */
const QUALITY_LADDER = [82, 72, 62, 50, 40] as const
/** Bila kualitas terendah masih terlalu besar, dimensi dikecilkan sebanyak ini. */
const EDGE_STEP = 0.75
/** Batas bawah dimensi; di bawah ini gambar tidak lagi berguna sebagai preview. */
const MIN_EDGE = 96
/** Guard dekompresi: menolak gambar yang piksel-nya tidak wajar besar. */
const MAX_INPUT_PIXELS = 40_000_000

export interface FittedJpeg {
  readonly bytes: Uint8Array
  readonly width: number
  readonly height: number
}

/**
 * @param input Byte gambar sumber (JPEG, PNG, atau WebP).
 * @param maxEdge Batas sisi terpanjang; gambar yang sudah lebih kecil tidak diperbesar.
 * @param maxBytes Anggaran byte hasil akhir.
 * @throws bila input tidak bisa didekode, atau anggaran tidak tercapai bahkan pada dimensi minimum.
 */
export async function fitJpeg(
  input: Uint8Array,
  maxEdge: number,
  maxBytes: number,
): Promise<FittedJpeg> {
  let smallest = Number.POSITIVE_INFINITY

  for (let edge = maxEdge; edge >= MIN_EDGE; edge = Math.floor(edge * EDGE_STEP)) {
    const resized = sharp(input, { failOn: 'error', limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .resize(edge, edge, { fit: 'inside', withoutEnlargement: true })

    for (const quality of QUALITY_LADDER) {
      const encoded = await resized
        .clone()
        .jpeg({ quality, chromaSubsampling: '4:2:0', progressive: false, mozjpeg: false })
        .toBuffer()

      if (encoded.byteLength <= maxBytes) {
        const { width, height } = await sharp(encoded).metadata()
        // Metadata JPEG selalu membawa dimensi; fallback hanya menjaga tipe.
        return { bytes: new Uint8Array(encoded), width: width ?? edge, height: height ?? edge }
      }
      smallest = Math.min(smallest, encoded.byteLength)
    }
  }

  throw new Error(
    `Gambar tidak bisa masuk ${String(maxBytes)} byte pada sisi maksimum ${String(maxEdge)}px; terkecil ${String(smallest)} byte.`,
  )
}
