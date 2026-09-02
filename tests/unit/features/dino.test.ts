import { describe, expect, it } from 'vitest'

import type { CommandContext } from '../../../lib/commands/command.js'
import { createDinoCommand } from '../../../plugins/games/dino.js'
import type { HtmlPrimitiveContent, AIRichSendOptions } from '../../../lib/messages/ai-rich.js'

function harness(parts: Partial<CommandContext> = {}) {
  const raw: HtmlPrimitiveContent[] = []
  const options: (AIRichSendOptions | undefined)[] = []
  let nativeCards = 0
  const context = {
    chatJid: 'chat@s.whatsapp.net',
    senderJid: 'sender@s.whatsapp.net',
    prefix: '.',
    commandName: 'dino',
    args: [],
    text: '',
    isGroup: false,
    isOwner: false,
    reply: () => Promise.resolve(),
    replyContent: () => { nativeCards += 1; return Promise.resolve() },
    replyAIRich: (content: HtmlPrimitiveContent, sendOptions?: AIRichSendOptions) => {
      raw.push(content)
      options.push(sendOptions)
      return Promise.resolve()
    },
    replyMedia: () => Promise.resolve(),
    react: () => Promise.resolve(),
    settings: { getMode: () => 'owner-only' },
    commands: { list: () => [] },
    now: () => 0,
    random: () => 0,
    ...parts,
  } as unknown as CommandContext
  return { context, raw, options, nativeCards: () => nativeCards }
}

describe('dino command', () => {
  it('sends the AIRich HTML Dino without the old emoji renderer', async () => {
    const h = harness()

    await createDinoCommand().run(h.context)

    expect(h.raw).toHaveLength(1)
    expect(h.nativeCards()).toBe(0)
    expect(h.raw[0]?.botForwardedMessage.message.richResponseMessage.submessages[0]?.messageText).toBe('Dino Run')
  })

  it('uses the business node and text stanza required by stock clients', async () => {
    const h = harness()

    await createDinoCommand().run(h.context)

    expect(h.options[0]).toEqual({
      additionalAttributes: { type: 'text' },
      customNodes: [{
        tag: 'biz',
        attrs: {},
        content: [{
          tag: 'interactive',
          attrs: { type: 'native_flow', v: '1' },
          content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }],
        }],
      }],
    })
  })

  it('remains available in private and group chats subject to the shared access gate', async () => {
    const group = harness({ isGroup: true })

    await createDinoCommand().run(group.context)

    expect(group.raw).toHaveLength(1)
    expect(createDinoCommand().permission ?? 'everyone').toBe('everyone')
  })
})
