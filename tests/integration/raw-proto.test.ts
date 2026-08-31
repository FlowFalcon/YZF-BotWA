import { describe, expect, it } from 'vitest'
import { proto } from 'zapo-js'
import { parseRawPayload } from '../../src/messages/raw-payload.js'

/**
 * Parses payloads through the same path the command uses, then encodes them with
 * the real zapo protobuf. A shape that parses but cannot be encoded would fail
 * only on a live send, so the encode step is the assertion that matters.
 */
const encode = (json: string): Uint8Array => {
  const parsed = parseRawPayload(json)
  if (!parsed.ok) throw new Error(parsed.error)
  return proto.Message.encode(parsed.value).finish()
}

describe('raw payload → real protobuf', () => {
  it('encodes a location message', () => {
    const bytes = encode('{"locationMessage":{"degreesLatitude":-6.2,"degreesLongitude":106.8}}')
    const decoded = proto.Message.decode(bytes)
    expect(decoded.locationMessage?.degreesLatitude).toBeCloseTo(-6.2)
  })

  it('encodes an interactive native-flow card', () => {
    const payload = JSON.stringify({
      interactiveMessage: {
        body: { text: 'tap' },
        nativeFlowMessage: {
          messageVersion: 1,
          buttons: [
            {
              name: 'cta_url',
              buttonParamsJson: JSON.stringify({ display_text: 'Open', url: 'https://example.com' }),
            },
          ],
        },
      },
    })

    const decoded = proto.Message.decode(encode(payload))
    expect(decoded.interactiveMessage?.nativeFlowMessage?.buttons?.[0]?.name).toBe('cta_url')
  })

  it('puts __bytes content into a protobuf bytes field as real bytes', () => {
    const inner = new TextEncoder().encode('{"response_id":"x"}')
    const base64 = Buffer.from(inner).toString('base64')
    const payload = JSON.stringify({
      botForwardedMessage: {
        message: {
          richResponseMessage: {
            messageType: 1,
            unifiedResponse: { data: { __bytes: base64 } },
          },
        },
      },
    })

    const decoded = proto.Message.decode(encode(payload))
    const data = decoded.botForwardedMessage?.message?.richResponseMessage?.unifiedResponse?.data
    expect(data).toBeInstanceOf(Uint8Array)
    // Decoded bytes must equal the original, with no extra base64 layer.
    expect(new TextDecoder().decode(data ?? new Uint8Array())).toBe('{"response_id":"x"}')
  })

  it('round-trips the user-supplied html primitive shape', () => {
    const unified = new TextEncoder().encode(
      JSON.stringify({
        response_id: 'r1',
        sections: [
          { view_model: { primitive: { __typename: 'GenAIaeacdsnwHtmlPrimitive', payload: '<b>x</b>' } } },
        ],
      }),
    )
    const payload = JSON.stringify({
      messageContextInfo: {
        deviceListMetadataVersion: 2,
        botMetadata: { messageDisclaimerText: '', botResponseId: 'r1' },
      },
      botForwardedMessage: {
        message: {
          richResponseMessage: {
            messageType: 1,
            submessages: [{ messageType: 2, messageText: 'caption' }],
            unifiedResponse: { data: { __bytes: Buffer.from(unified).toString('base64') } },
          },
        },
      },
    })

    const decoded = proto.Message.decode(encode(payload))
    const rich = decoded.botForwardedMessage?.message?.richResponseMessage
    expect(rich?.submessages?.[0]?.messageText).toBe('caption')
    const parsedUnified = JSON.parse(
      new TextDecoder().decode(rich?.unifiedResponse?.data ?? new Uint8Array()),
    ) as { sections: readonly { view_model: { primitive: { payload: string } } }[] }
    expect(parsedUnified.sections[0]?.view_model.primitive.payload).toBe('<b>x</b>')
  })
})
