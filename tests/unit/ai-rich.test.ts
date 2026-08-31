import { describe, expect, it } from 'vitest'
import { proto } from 'zapo-js'
import { htmlPrimitiveMessage, HTML_PRIMITIVE_TYPENAME } from '../../src/messages/ai-rich.js'

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

  it('carries the caption as a submessage so clients without html show text', () => {
    const content = htmlPrimitiveMessage({ html: '<i></i>', caption: 'Dino', responseId: 'x' })
    const submessages = content.botForwardedMessage.message.richResponseMessage.submessages
    expect(submessages[0]?.messageText).toBe('Dino')
  })

  it('reuses one response id across botMetadata and the unified payload', () => {
    const content = htmlPrimitiveMessage({ html: '<i></i>', caption: 'c', responseId: 'abc123' })
    expect(content.messageContextInfo.botMetadata.botResponseId).toBe('abc123')
    expect(decodeUnified(content)['response_id']).toBe('abc123')
  })

  it('sends no verificationMetadata and no certificate chain', () => {
    // CREATIVE_MESSAGES.md §7: never copy a third party's certificate chain and
    // never claim to be an official bot. The payload must stay proof-free.
    const json = JSON.stringify(htmlPrimitiveMessage({ html: '<i></i>', caption: 'c', responseId: 'x' }))
    expect(json).not.toContain('verificationMetadata')
    expect(json).not.toContain('certificateChain')
    expect(json).not.toContain('botJid')
  })

  it('leaves the disclaimer empty instead of impersonating a vendor bot', () => {
    // §7 again: an empty disclaimer is a bare experiment, a filled one is a
    // claim about who sent the message.
    const content = htmlPrimitiveMessage({ html: '<i></i>', caption: 'c', responseId: 'x' })
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
