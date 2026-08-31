import { describe, expect, it } from 'vitest'
import { createRawCommand } from '../../../src/features/general/raw.js'
import type { Command, CommandContext } from '../../../src/commands/command.js'

interface Harness {
  readonly command: Command
  readonly sent: Record<string, unknown>[]
  readonly texts: string[]
  run(text: string, parts?: Partial<CommandContext>): Promise<void>
}

const harness = (options: { enabled?: boolean; fail?: Error } = {}): Harness => {
  const sent: Record<string, unknown>[] = []
  const texts: string[] = []
  const command = createRawCommand({ enabled: options.enabled ?? true })

  const run = async (text: string, parts: Partial<CommandContext> = {}): Promise<void> => {
    const context = {
      chatJid: 'chat@s.whatsapp.net',
      senderJid: 'owner@s.whatsapp.net',
      prefix: '.',
      commandName: 'raw',
      args: text.split(' ').filter((part) => part !== ''),
      text,
      isGroup: false,
      isOwner: true,
      reply: (value: string) => {
        texts.push(value)
        return Promise.resolve()
      },
      replyRaw: (value: Readonly<Record<string, unknown>>) => {
        if (options.fail !== undefined) return Promise.reject(options.fail)
        sent.push({ ...value })
        return Promise.resolve()
      },
      replyContent: () => Promise.resolve(),
      replyMedia: () => Promise.resolve(),
      react: () => Promise.resolve(),
      now: () => 1_000,
      random: () => 0.5,
      ...parts,
    } as unknown as CommandContext

    await command.run(context)
  }

  return { command, sent, texts, run }
}

describe('raw command', () => {
  it('is owner-only, because it sends arbitrary protocol payloads', () => {
    expect(harness().command.permission).toBe('owner')
  })

  it('sends the parsed payload verbatim', async () => {
    const h = harness()
    await h.run('{"conversation":"hi"}')

    expect(h.sent).toEqual([{ conversation: 'hi' }])
  })

  it('confirms the send by naming the fields, never echoing the payload', async () => {
    const h = harness()
    await h.run('{"conversation":"rahasia"}')

    expect(h.texts.join()).toContain('conversation')
    expect(h.texts.join()).not.toContain('rahasia')
  })

  it('reports a parse error instead of sending anything', async () => {
    const h = harness()
    await h.run('{broken')

    expect(h.sent).toHaveLength(0)
    expect(h.texts.join()).toMatch(/json/i)
  })

  it('shows usage when called with no payload', async () => {
    const h = harness()
    await h.run('')

    expect(h.sent).toHaveLength(0)
    expect(h.texts.join()).toContain('.raw')
  })

  it('reports a send failure rather than claiming success', async () => {
    const h = harness({ fail: new Error('boom') })
    await h.run('{"conversation":"hi"}')

    expect(h.texts.join()).toMatch(/gagal/i)
  })

  it('does not leak the underlying error text to chat', async () => {
    // Zapo errors can carry protocol internals; SECURITY.md keeps them in logs.
    const h = harness({ fail: new Error('sensitive-internal-detail') })
    await h.run('{"conversation":"hi"}')

    expect(h.texts.join()).not.toContain('sensitive-internal-detail')
  })

  it('refuses everything while the flag is off', async () => {
    const h = harness({ enabled: false })
    await h.run('{"conversation":"hi"}')

    expect(h.sent).toHaveLength(0)
    expect(h.texts.join()).toContain('BOT_RAW_SEND')
  })

  it('keeps the payload intact when it spans multiple lines', async () => {
    const h = harness()
    await h.run('{\n  "conversation": "hi"\n}')

    expect(h.sent).toEqual([{ conversation: 'hi' }])
  })
})
