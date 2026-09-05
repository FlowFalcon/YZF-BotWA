import { describe, expect, it } from 'vitest'
import { proto } from 'zapo-js'
import {
  htmlPrimitiveMessage,
  htmlPrimitiveSendOptions,
  HTML_PRIMITIVE_TYPENAME,
} from '../../lib/messages/ai-rich.js'

const decodeUnified = (content: ReturnType<typeof htmlPrimitiveMessage>): Record<string, unknown> => {
  const data = content.botForwardedMessage.message.richResponseMessage.unifiedResponse.data
  return JSON.parse(new TextDecoder().decode(data)) as Record<string, unknown>
}

describe('htmlPrimitiveMessage', () => {
  it('wraps the html in the primitive the client renders', () => {
    const content = htmlPrimitiveMessage({
      html: '<div>hi</div>',
      caption: 'Dino',
      responseId: 'fixed-id',
    })

    const unified = decodeUnified(content) as {
      sections: readonly { view_model: { primitive: Record<string, unknown> } }[]
    }
    const primitive = unified.sections[0]?.view_model.primitive
    expect(primitive?.['__typename']).toBe(HTML_PRIMITIVE_TYPENAME)
    expect(primitive?.['payload']).toBe('<div>hi</div>')
  })

  it('carries the caption as a submessage when provided', () => {
    const content = htmlPrimitiveMessage({ html: '<i></i>', caption: 'Dino', responseId: 'x' })
    const submessages = content.botForwardedMessage.message.richResponseMessage.submessages
    expect(submessages?.[0]?.messageText).toBe('Dino')
  })

  it('omits submessages when no caption is provided to avoid fallback leakage', () => {
    const content = htmlPrimitiveMessage({ html: '<i></i>', responseId: 'x' })
    const submessages = content.botForwardedMessage.message.richResponseMessage.submessages
    expect(submessages).toEqual([])
  })

  it('includes the forwarded info and forwardOrigin required by the Meta AI renderer', () => {
    const content = htmlPrimitiveMessage({ html: '<i></i>', responseId: 'x' })
    expect(content.botForwardedMessage.message.richResponseMessage.contextInfo).toEqual({
      forwardingScore: 1,
      isForwarded: true,
      forwardedAiBotMessageInfo: { botJid: '0@bot' },
      forwardOrigin: 4,
    })
  })

  it('leaves messageDisclaimerText empty so no GenAI text leaks', () => {
    const content = htmlPrimitiveMessage({ html: '<i></i>', responseId: 'x' })
    expect(content.messageContextInfo.botMetadata.messageDisclaimerText).toBe('')
  })

  it('encodes and decodes losslessly through the real zapo protobuf', () => {
    const content = htmlPrimitiveMessage({
      html: '<div id="game">x</div>',
      caption: 'Dino',
      responseId: 'roundtrip',
    })

    const bytes = proto.Message.encode(content).finish()
    expect(bytes.byteLength).toBeGreaterThan(0)

    const decoded = proto.Message.decode(bytes)
    const data = decoded.botForwardedMessage?.message?.richResponseMessage?.unifiedResponse?.data
    expect(data).toBeDefined()
    const unified = JSON.parse(new TextDecoder().decode(data ?? new Uint8Array())) as {
      sections: readonly { view_model: { primitive: { payload: string } } }[]
    }
    expect(unified.sections[0]?.view_model.primitive.payload).toBe('<div id="game">x</div>')
    expect(decoded.botForwardedMessage?.message?.richResponseMessage?.submessages?.[0]?.messageText).toBe(
      'Dino',
    )
  })

  it('rejects html above the payload ceiling rather than sending a truncated page', () => {
    expect(() =>
      htmlPrimitiveMessage({ html: 'x'.repeat(200_000), caption: 'c', responseId: 'x' }),
    ).toThrow(/too large/i)
  })
})

describe('htmlPrimitiveSendOptions', () => {
  it('forces type=text, because type=media makes stock clients suppress AIRich', () => {
    expect(htmlPrimitiveSendOptions().additionalAttributes).toEqual({ type: 'text' })
  })

  it('includes the native flow mixed customNodes', () => {
    expect(htmlPrimitiveSendOptions().customNodes).toEqual([
      {
        tag: 'biz',
        attrs: {},
        content: [
          {
            tag: 'interactive',
            attrs: { type: 'native_flow', v: '1' },
            content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }],
          },
        ],
      },
    ])
  })
})
