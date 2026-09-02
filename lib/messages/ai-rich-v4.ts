import { buildRichResponseMessage } from './ai-rich.js'
import type { AIRichContent } from './ai-rich.js'

type JsonObject = Readonly<Record<string, unknown>>

interface AirichSection {
  readonly view_model: {
    readonly primitive?: JsonObject
    readonly primitives?: readonly JsonObject[]
    readonly __typename: string
  }
}

export interface AirichV4Content extends AIRichContent {
  readonly messageContextInfo: {
    readonly deviceListMetadata: Record<string, never>
    readonly deviceListMetadataVersion: number
    readonly botMetadata: {
      readonly messageDisclaimerText: string
      readonly botResponseId: string
    }
  }
  readonly botForwardedMessage: {
    readonly message: {
      readonly richResponseMessage: {
        readonly messageType: number
        readonly submessages: { readonly messageType: number; readonly messageText: string }[]
        readonly unifiedResponse: { readonly data: Uint8Array }
      }
    }
  }
}

const IMAGE = 'https://cdn.ornzora.eu.cc/2a639cd2-5c33-49e3-982f-77f471c9313f-FIORA.jpg'
const PROFILE = 'https://cdn.ornzora.eu.cc/bd0d65c6-8a44-4418-8d40-ae0ac00a2386-FIORA.jpg'
const POST = 'https://cdn.ornzora.eu.cc/69551181-48c0-4466-b22d-235a93db8a63-FIORA.jpg'
const GIST = 'https://gist.github.com/ValdazGT/adc8b767a082d18d12ff3e7f01b78651'

const layout = (name: 'Single' | 'HScroll' | 'ActionRow', data: JsonObject | readonly JsonObject[]): AirichSection => ({
  view_model: {
    ...(Array.isArray(data) ? { primitives: data } : { primitive: data as JsonObject }),
    __typename: `GenAI${name}LayoutViewModel`,
  },
})

const markdown = (text: string): AirichSection =>
  layout('Single', { text, __typename: 'GenAIMarkdownTextUXPrimitive' })

const image = (status: 'GENERATING' | 'READY'): AirichSection =>
  layout('Single', {
    media: status === 'READY' ? { url: IMAGE, mime_type: 'image/jpeg' } : { url: '', mime_type: 'image/jpeg' },
    imagine_type: 'IMAGE',
    status: {
      status,
      ...(status === 'GENERATING' ? { update_text: 'Generating image…' } : {}),
    },
    __typename: 'GenAIImaginePrimitive',
  })

const code = (): AirichSection =>
  layout('Single', {
    language: 'javascript',
    code_blocks: [
      {
        content: "function greet(name) {\n  return `Hello, ${name}!`\n}\n\ngreet('YZF')",
        type: 'DEFAULT',
      },
    ],
    __typename: 'GenAICodeUXPrimitive',
  })

const table = (): AirichSection =>
  layout('Single', {
    rows: [
      { is_header: true, cells: ['Name', 'Role'] },
      { is_header: false, cells: ['YZF-BotWA', 'Zapo demo'] },
      { is_header: false, cells: ['MessageBuilderV4.7', 'Reference'] },
    ],
    __typename: 'GenATableUXPrimitive',
  })

const suggestions = (): AirichSection =>
  layout(
    'HScroll',
    ['AIRich V4', 'Dynamic edit', 'zapo-js'].map((text) => ({
      prompt_text: text,
      prompt_type: 'SUGGESTED_PROMPT',
      __typename: 'GenAIFollowUpSuggestionPillPrimitive',
    })),
  )

const mixedCards = (): AirichSection =>
  layout('HScroll', [
    {
      title: 'YZF-BotWA',
      brand: 'Zapo',
      price: 'V4 experiment',
      product_url: GIST,
      image: { url: IMAGE },
      __typename: 'GenAIProductItemCardPrimitive',
    },
    {
      title: 'Behind the port',
      username: 'YZF-BotWA',
      profile_picture_url: PROFILE,
      thumbnail_url: POST,
      post_caption: 'MessageBuilderV4.7 wire format, rewritten for zapo-js.',
      post_url: GIST,
      source_app: 'GITHUB',
      orientation: 'LANDSCAPE',
      post_type: 'IMAGE',
      __typename: 'GenAIPostPrimitive',
    },
    {
      reels_url: GIST,
      thumbnail_url: IMAGE,
      creator: 'YZF-BotWA',
      avatar_url: PROFILE,
      reels_title: 'AIRich live edit',
      likes_count: 4,
      shares_count: 7,
      view_count: 47,
      reel_source: 'GITHUB',
      is_verified: false,
      __typename: 'GenAIReelPrimitive',
    },
  ])

const source = (): AirichSection =>
  layout('Single', {
    sources: [
      {
        source_type: 'THIRD_PARTY',
        source_display_name: 'MessageBuilderV4.7',
        source_subtitle: 'GitHub Gist · ValdazGT',
        source_url: GIST,
        favicon: { url: PROFILE, mime_type: 'image/jpeg', width: 16, height: 16 },
      },
    ],
    __typename: 'GenAISearchResultPrimitive',
  })

const widget = (): AirichSection =>
  layout('Single', {
    header: { __typename: 'GenAI3PExtWidgetStandardHeader', title: 'Quick Actions' },
    body: {
      __typename: 'GenAI3PExtCalendarEventList',
      sections: [],
      ctas: [
        {
          __typename: 'GenAI3PExtWidgetCTA',
          label: 'Open source',
          state: 'PENDING',
          kind: 'OTHER',
          tool_call_id: 'open-source',
        },
      ],
    },
    __typename: 'GenAI3PExtWidgetPrimitive',
  })

const footerAction = (): AirichSection =>
  layout('Single', {
    cta_text: 'Open MessageBuilderV4.7 Gist',
    cta_type: 'OPEN_URL',
    cta_url: GIST,
    __typename: 'GenAIFooterActionPrimitive',
  })

const buildFrame = (responseId: string, sections: readonly AirichSection[]): AirichV4Content => {
  const payload = buildV4Payload(responseId, sections)
  return buildRichResponseMessage({
    responseId,
    disclaimer: 'YZF-BotWA · V4 experiment',
    sections: [
      {
        kind: 'v4',
        payload,
        caption: 'YZF-BotWA V4 AIRich live tour. Update WhatsApp jika kartu tidak tampil.',
      },
    ],
  })
}

/**
 * Encodes V4 typed sections into the unified-response `data` bytes shared by
 * the AIRich wrapper. Exported so other consumers can reuse the same payload
 * shape through the shared builder in `ai-rich.ts`.
 */
export function buildV4Payload(responseId: string, sections: readonly AirichSection[]): Uint8Array {
  return new TextEncoder().encode(JSON.stringify({ response_id: responseId, sections }))
}

/**
 * Compact adaptation of ValdazGT's V4.7 example. Each item is the complete next
 * state of one message; the command publishes frame zero and edits it in place.
 */
export function v4TourFrames(responseId: string): readonly AirichV4Content[] {
  const intro = markdown('Hey! Welcome to MessageBuilderV4.7 on zapo-js 👋')
  const frames: readonly (readonly AirichSection[])[] = [
    [intro, suggestions()],
    [intro, markdown('Loading states can be replaced inside the same message.'), image('GENERATING'), suggestions()],
    [intro, image('READY'), markdown('Code blocks and tables:'), code(), table(), suggestions()],
    [intro, image('READY'), code(), table(), markdown('Mixed cards from separate content:'), mixedCards()],
    [intro, image('READY'), code(), table(), mixedCards(), source()],
    [
      intro,
      image('READY'),
      code(),
      table(),
      mixedCards(),
      source(),
      widget(),
      footerAction(),
      markdown('Full V4 tour complete — created and edited live through zapo-js.'),
    ],
  ]
  return frames.map((sections) => buildFrame(responseId, sections))
}