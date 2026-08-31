import type { Command, CommandContext } from '../../commands/command.js'
import { parseRawPayload } from '../../messages/raw-payload.js'

export interface RawOptions {
  /** `BOT_RAW_SEND=1`. Default off: this sends unvalidated protocol payloads. */
  readonly enabled: boolean
}

const DISABLED_REPLY = 'Command .raw mati. Nyalakan dengan BOT_RAW_SEND=1 di .env lalu restart bot.'

const USAGE = [
  'Kirim payload Proto.IMessage sebagai JSON.',
  '',
  'Contoh:',
  '.raw {"locationMessage":{"degreesLatitude":-6.2,"degreesLongitude":106.8}}',
  '',
  'Field bytes (unifiedResponse.data, signature) pakai {"__bytes":"<base64>"}.',
].join('\n')

/**
 * Sends a raw protocol payload pasted into chat.
 *
 * Parsed with `JSON.parse`, never executed: SECURITY.md §2 forbids running
 * source from a message. Payloads for the shapes this exists for
 * (`interactiveMessage`, `botForwardedMessage`, `locationMessage`) are pure
 * data, so parsing loses nothing while removing the code-execution surface
 * entirely.
 */
export function createRawCommand(options: RawOptions): Command {
  return {
    name: 'raw',
    category: 'general',
    description: 'Kirim payload Proto.IMessage mentah (owner)',
    usage: '.raw {"conversation":"hi"}',
    permission: 'owner',
    cooldownMs: 2_000,
    run: async (context: CommandContext): Promise<void> => {
      if (!options.enabled) {
        await context.reply(DISABLED_REPLY)
        return
      }

      // `text` keeps the payload intact including newlines; `args` would split it.
      const payload = context.text.trim()
      if (payload === '') {
        await context.reply(USAGE)
        return
      }

      const parsed = parseRawPayload(payload)
      if (!parsed.ok) {
        await context.reply(`❌ ${parsed.error}`)
        return
      }

      try {
        await context.replyRaw(parsed.value)
      } catch {
        // The underlying error can carry protocol internals; the router logs it.
        await context.reply('❌ Gagal mengirim payload. Cek log untuk detail.')
        return
      }

      // Field names only: the payload itself is never echoed back.
      await context.reply(`✅ Terkirim. Field: ${parsed.fields.join(', ')}`)
    },
  }
}

const raw = createRawCommand({ enabled: process.env['BOT_RAW_SEND'] === '1' })

export default raw
