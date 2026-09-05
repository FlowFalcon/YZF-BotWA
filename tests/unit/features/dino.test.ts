import { describe, expect, it } from 'vitest'

import type { CommandContext } from '../../../lib/commands/command.js'
import dinoCommand from '../../../plugins/games/dino.js'
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
  it('sends the lightweight framed Dino Runner with clean caption', async () => {
    const h = harness()

    await dinoCommand.run(h.context)

    expect(h.raw).toHaveLength(1)
    expect(h.nativeCards()).toBe(0)
    const richMessage = h.raw[0]?.botForwardedMessage.message.richResponseMessage
    expect(richMessage?.submessages[0]?.messageText).toBe('🦖 Dino Runner')

    // Verify contextInfo structure
    expect(richMessage?.contextInfo).toEqual({
      forwardingScore: 1,
      isForwarded: true,
      forwardedAiBotMessageInfo: { botJid: '0@bot' },
      forwardOrigin: 4,
    })

    // Verify HTML content
    const dataBytes = richMessage?.unifiedResponse.data
    expect(dataBytes).toBeDefined()
    const decodedJson = JSON.parse(new TextDecoder().decode(dataBytes)) as {
      sections: [{ view_model: { primitive: { payload: string } } }]
    }
    const htmlPayload = decodedJson.sections[0]?.view_model.primitive.payload ?? ''
    expect(htmlPayload).toContain('interstitial-wrapper')
    expect(htmlPayload).toContain('offline-resources')
  })

  it('uses the business node and text stanza required by stock clients', async () => {
    const h = harness()

    await dinoCommand.run(h.context)

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

    await dinoCommand.run(group.context)

    expect(group.raw).toHaveLength(1)
    expect(dinoCommand.permission ?? 'everyone').toBe('everyone')
  })
})
