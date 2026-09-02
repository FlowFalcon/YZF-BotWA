import { describe, expect, it } from 'vitest'
import { proto } from 'zapo-js'
import {
  buildRichResponseMessage,
  htmlPrimitiveMessage,
  HTML_PRIMITIVE_TYPENAME,
  type RichSection,
} from '../../lib/messages/ai-rich.js'
import { buildV4Payload } from '../../lib/messages/ai-rich-v4.js'

const decodeUnified = (bytes: Uint8Array): { response_id: string; sections: readonly unknown[] } =>
  JSON.parse(new TextDecoder().decode(bytes)) as { response_id: string; sections: readonly unknown[] }

describe('buildRichResponseMessage (shared builder)', () => {
  it('produces a message that round-trips through the real zapo protobuf', () => {
    const section: RichSection = { kind: 'html', html: '<div>hi</div>', caption: 'Dino' }
    const message = buildRichResponseMessage({ responseId: 'shared-id', disclaimer: '', sections: [section] })

    const encoded = proto.Message.encode(message).finish()
    const decoded = proto.Message.decode(encoded)
    expect(decoded.botForwardedMessage?.message?.richResponseMessage).toBeDefined()
    const data = decoded.botForwardedMessage?.message?.richResponseMessage?.unifiedResponse?.data
    expect(data).toBeDefined()
    const unified = decodeUnified(data ?? new Uint8Array())
    expect(unified.response_id).toBe('shared-id')
  })

  it('produces an HTML primitive identical to the existing htmlPrimitiveMessage shape', () => {
    const section: RichSection = { kind: 'html', html: '<div>hi</div>', caption: 'Dino' }
    const shared = buildRichResponseMessage({ responseId: 'fixed-id', disclaimer: '', sections: [section] })
    const direct = htmlPrimitiveMessage({ html: '<div>hi</div>', caption: 'Dino', responseId: 'fixed-id' })

    const sharedUnified = decodeUnified(
      shared.botForwardedMessage.message.richResponseMessage.unifiedResponse.data,
    ) as { sections: readonly { view_model: { primitive: Record<string, unknown> } }[] }
    const directUnified = decodeUnified(
      direct.botForwardedMessage.message.richResponseMessage.unifiedResponse.data,
    ) as { sections: readonly { view_model: { primitive: Record<string, unknown> } }[] }

    expect(sharedUnified).toEqual(directUnified)
    expect(sharedUnified.sections[0]?.view_model.primitive['__typename']).toBe(HTML_PRIMITIVE_TYPENAME)
  })

  it('wraps V4 typed sections via the shared builder used by v4TourFrames', () => {
    const shared = buildRichResponseMessage({
      responseId: 'fixed-id',
      disclaimer: 'YZF-BotWA · V4 experiment',
      sections: [
        {
          kind: 'v4',
          payload: buildV4Payload('fixed-id', []),
          caption: 'YZF-BotWA V4 AIRich live tour. Update WhatsApp jika kartu tidak tampil.',
        },
      ],
    })
    const unified = decodeUnified(
      shared.botForwardedMessage.message.richResponseMessage.unifiedResponse.data,
    )

    expect(unified.response_id).toBe('fixed-id')
    expect(shared.messageContextInfo.botMetadata.botResponseId).toBe('fixed-id')
    expect(shared.messageContextInfo.botMetadata.messageDisclaimerText).toBe('YZF-BotWA · V4 experiment')
    expect(shared.botForwardedMessage.message.richResponseMessage.submessages[0]?.messageText).toBe(
      'YZF-BotWA V4 AIRich live tour. Update WhatsApp jika kartu tidak tampil.',
    )
  })

  it('returns a structurally identical wrapper for both renderer kinds', () => {
    const htmlSection: RichSection = { kind: 'html', html: '<i></i>', caption: 'c' }
    const v4Section: RichSection = {
      kind: 'v4',
      payload: buildV4Payload('shared-id', []),
      caption: 'c',
    }

    const htmlMessage = buildRichResponseMessage({ responseId: 'shared-id', disclaimer: '', sections: [htmlSection] })
    const v4Message = buildRichResponseMessage({ responseId: 'shared-id', disclaimer: '', sections: [v4Section] })

    expect(Object.keys(htmlMessage).sort()).toEqual(Object.keys(v4Message).sort())
    expect(Object.keys(htmlMessage.messageContextInfo).sort()).toEqual(Object.keys(v4Message.messageContextInfo).sort())
    expect(Object.keys(htmlMessage.botForwardedMessage.message.richResponseMessage).sort()).toEqual(
      Object.keys(v4Message.botForwardedMessage.message.richResponseMessage).sort(),
    )
  })
})