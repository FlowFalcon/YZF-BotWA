import { describe, expect, it } from 'vitest'
import { proto } from 'zapo-js'
import { v4TourFrames } from '../../lib/messages/ai-rich-v4.js'

const decodeUnified = (frame: ReturnType<typeof v4TourFrames>[number]) => {
  const data = frame.botForwardedMessage.message.richResponseMessage.unifiedResponse.data
  return JSON.parse(new TextDecoder().decode(data)) as {
    response_id: string
    sections: readonly {
      view_model: {
        primitive?: { __typename?: string; status?: { status?: string } }
        primitives?: readonly { __typename?: string }[]
      }
    }[]
  }
}

describe('v4TourFrames', () => {
  it('builds a live tour whose final frame includes the example AIRich primitives', () => {
    const frames = v4TourFrames('fixed-response')
    const finalFrame = frames.at(-1)
    if (finalFrame === undefined) throw new Error('V4 tour has no final frame')
    const unified = decodeUnified(finalFrame)
    const names = unified.sections.flatMap((section) => {
      const model = section.view_model
      return model.primitive === undefined
        ? (model.primitives ?? []).map((primitive) => primitive.__typename)
        : [model.primitive.__typename]
    })

    expect(frames.length).toBeGreaterThanOrEqual(5)
    expect(names).toEqual(
      expect.arrayContaining([
        'GenAIMarkdownTextUXPrimitive',
        'GenAIImaginePrimitive',
        'GenAICodeUXPrimitive',
        'GenATableUXPrimitive',
        'GenAIProductItemCardPrimitive',
        'GenAIPostPrimitive',
        'GenAIReelPrimitive',
        'GenAISearchResultPrimitive',
        'GenAI3PExtWidgetPrimitive',
        'GenAIFooterActionPrimitive',
      ]),
    )
    expect(JSON.stringify(unified)).not.toContain('GENERATING')
  })

  it('keeps one response id and round-trips every frame through zapo protobuf', () => {
    const frames = v4TourFrames('fixed-response')

    for (const frame of frames) {
      expect(decodeUnified(frame).response_id).toBe('fixed-response')
      const bytes = proto.Message.encode(frame).finish()
      expect(bytes.byteLength).toBeGreaterThan(0)
      expect(proto.Message.decode(bytes).botForwardedMessage).toBeDefined()
    }
  })

  it('does not copy the gist fake verification metadata or impersonated bot jid', () => {
    const json = JSON.stringify(v4TourFrames('fixed-response'))
    expect(json).not.toContain('verificationMetadata')
    expect(json).not.toContain('certificateChain')
    expect(json).not.toContain('botJid')
  })
})
