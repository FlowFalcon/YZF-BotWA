import { describe, expect, it, vi } from 'vitest'
import { createDinoCommand } from '../../../src/features/fun/dino.js'
import type { CommandContext } from '../../../src/commands/command.js'
import type { HtmlPrimitiveContent } from '../../../src/messages/ai-rich.js'
import type { RichInteractiveContent } from '../../../src/messages/rich.js'

const context = (parts: Record<string, unknown> = {}): CommandContext =>
  ({
    prefix: '.',
    isOwner: true,
    isGroup: false,
    reply: vi.fn((text: string) => {
      void text
      return Promise.resolve()
    }),
    replyRaw: vi.fn((content: HtmlPrimitiveContent) => {
      void content
      return Promise.resolve()
    }),
    replyContent: vi.fn((content: RichInteractiveContent) => {
      void content
      return Promise.resolve()
    }),
    ...parts,
  }) as unknown as CommandContext

describe('dino command', () => {
  it('sends the html primitive when the feature flag is on', async () => {
    const replyRaw = vi.fn((content: HtmlPrimitiveContent) => {
      void content
      return Promise.resolve()
    })
    const dino = createDinoCommand({ enabled: true })

    await dino.run(context({ replyRaw }))

    const sent = replyRaw.mock.calls[0]?.[0]
    expect(sent).toBeDefined()
    expect(sent?.botForwardedMessage.message.richResponseMessage.submessages[0]?.messageText).toBe(
      'Dino Run',
    )
  })

  it('is owner-only and off by default, because rendering is unproven', () => {
    const dino = createDinoCommand({ enabled: false })
    expect(dino.permission).toBe('owner')
  })

  it('explains how to enable it instead of sending anything when the flag is off', async () => {
    const replyRaw = vi.fn((content: HtmlPrimitiveContent) => {
      void content
      return Promise.resolve()
    })
    const reply = vi.fn((text: string) => {
      void text
      return Promise.resolve()
    })
    const dino = createDinoCommand({ enabled: false })

    await dino.run(context({ replyRaw, reply }))

    expect(replyRaw).not.toHaveBeenCalled()
    expect(reply.mock.calls[0]?.[0]).toContain('BOT_HTML_GAMES')
  })

  it('refuses to send in a group even for the owner', async () => {
    const replyRaw = vi.fn((content: HtmlPrimitiveContent) => {
      void content
      return Promise.resolve()
    })
    const reply = vi.fn((text: string) => {
      void text
      return Promise.resolve()
    })
    const dino = createDinoCommand({ enabled: true })

    await dino.run(context({ isGroup: true, replyRaw, reply }))

    // An unrendered payload in a community group is exactly the exposure to avoid.
    expect(replyRaw).not.toHaveBeenCalled()
    expect(reply).toHaveBeenCalled()
  })

  it('gives each send its own response id', async () => {
    const seen: string[] = []
    const replyRaw = vi.fn((content: HtmlPrimitiveContent) => {
      seen.push(content.messageContextInfo.botMetadata.botResponseId)
      return Promise.resolve()
    })
    const dino = createDinoCommand({ enabled: true })

    await dino.run(context({ replyRaw }))
    await dino.run(context({ replyRaw }))

    expect(seen[0]).not.toBe(seen[1])
  })
})
