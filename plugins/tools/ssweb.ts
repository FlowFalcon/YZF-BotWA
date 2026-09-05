import type { Command } from '../../lib/commands/command.js'
import { assertHttpUrl, fetchBytes } from '../../lib/net/fetch-bytes.js'

const ENDPOINT = 'https://image.thum.io/get'

export function screenshotUrl(target: string, width = 1280): string {
  const normalized = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(target) ? target : `https://${target}`
  const url = assertHttpUrl(normalized)
  return `${ENDPOINT}/width/${String(width)}/noanimate/${url.href}`
}

const ssweb = {
  name: 'ssweb',
  aliases: ['ss'],
  category: 'tools',
  description: 'Mengambil screenshot sebuah halaman web.',
  usage: 'ssweb <url>',
  cooldownMs: 10_000,
  async run(context) {
    const target = context.text.trim()
    if (target === '') {
      await context.reply(`Tulis URL-nya. Contoh: ${context.prefix}ssweb example.com`)
      return
    }

    let endpoint: string
    try { endpoint = screenshotUrl(target) } catch (error) {
      await context.reply(error instanceof Error ? error.message : 'URL tidak valid.')
      return
    }

    await context.react('⏳')
    try {
      const { bytes } = await fetchBytes(endpoint, { expect: 'image', maxBytes: 4_194_304, timeoutMs: 60_000 })
      await context.replyImage(bytes, { mimetype: 'image/png', caption: target })
    } catch {
      await context.reply('Gagal mengambil screenshot halaman itu.')
    }
  },
} satisfies Command

export default ssweb
