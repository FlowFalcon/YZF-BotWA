import type { Command } from '../../lib/commands/command.js'
import { fetchBytes } from '../../lib/net/fetch-bytes.js'

const ENDPOINT = 'https://quickchart.io/qr'
export const QRCODE_MAX_LENGTH = 900

export function qrcodeUrl(text: string, size = 512): string {
  const url = new URL(ENDPOINT)
  url.searchParams.set('text', text)
  url.searchParams.set('size', String(size))
  url.searchParams.set('margin', '2')
  return url.href
}

const qrcode = {
  name: 'qrcode',
  aliases: ['qr'],
  category: 'tools',
  description: 'Membuat QR code dari teks.',
  usage: 'qrcode <teks>',
  cooldownMs: 5_000,
  async run(context) {
    const text = context.text.trim()
    if (text === '') {
      await context.reply(`Tulis teksnya. Contoh: ${context.prefix}qrcode https://example.com`)
      return
    }
    if (text.length > QRCODE_MAX_LENGTH) {
      await context.reply(`Teks maksimum ${String(QRCODE_MAX_LENGTH)} karakter.`)
      return
    }

    await context.react('⏳')
    try {
      const { bytes } = await fetchBytes(qrcodeUrl(text), { expect: 'image', maxBytes: 1_048_576 })
      await context.replyImage(bytes, { mimetype: 'image/png', caption: 'QR code' })
    } catch {
      await context.reply('Gagal membuat QR code. Coba lagi nanti.')
    }
  },
} satisfies Command

export default qrcode
