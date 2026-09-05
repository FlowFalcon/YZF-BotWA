/** WhatsApp typename for the HTML renderer. */
export const HTML_PRIMITIVE_TYPENAME = 'GenAIaeacdsnwHtmlPrimitive'

/** Ceiling on the HTML payload. A half-sent page renders as a blank card. */
const MAX_HTML_BYTES = 128 * 1024

export interface HtmlPrimitiveInput {
  readonly html: string
  /** Shown by clients that cannot render the primitive (optional). */
  readonly caption?: string
  readonly responseId: string
}

/** Structural proto payload returned by the typed AIRich builder in this module. */
export type AIRichContent = HtmlPrimitiveContent

export interface AIRichNode {
  readonly tag: string
  readonly attrs: Readonly<Record<string, string>>
  readonly content?: readonly AIRichNode[]
}

export interface AIRichSendOptions {
  readonly customNodes?: readonly AIRichNode[]
  readonly additionalAttributes?: Readonly<Record<string, string>>
  /** Public zapo-js message-edit target. */
  readonly editKey?: { readonly id: string }
}

export type HtmlPrimitiveContent = {
  readonly messageContextInfo: {
    readonly deviceListMetadata: Record<string, never>
    readonly deviceListMetadataVersion: number
    readonly botMetadata: {
      readonly messageDisclaimerText: string
      readonly richResponseSourcesMetadata?: { readonly sources?: never[] }
      readonly botResponseId: string
    }
  }
  readonly botForwardedMessage: {
    readonly message: {
      readonly richResponseMessage: {
        readonly messageType: number
        readonly submessages: { readonly messageType: number; readonly messageText: string }[]
        readonly unifiedResponse: { readonly data: Uint8Array }
        readonly contextInfo?: {
          readonly forwardingScore: number
          readonly isForwarded: boolean
          readonly forwardedAiBotMessageInfo: { readonly botJid: string }
          readonly forwardOrigin: number
        }
      }
    }
  }
}

/**
 * Wraps HTML in the `botForwardedMessage` shape stock clients render:
 * - primitive `__typename`: GenAIaeacdsnwHtmlPrimitive
 * - view_model `__typename`: GenAISingleLayoutViewModel
 * - `messageDisclaimerText` left empty so no GenAI wording leaks into the bubble
 * - contextInfo with isForwarded, forwardOrigin 4 and a neutral `0@bot`
 *
 * No verification metadata and no impersonated bot jid: the bot never claims to
 * be Meta AI.
 */
export function htmlPrimitiveMessage(input: HtmlPrimitiveInput): HtmlPrimitiveContent {
  const encodedHtml = new TextEncoder().encode(input.html)
  if (encodedHtml.byteLength > MAX_HTML_BYTES) {
    throw new Error(`html payload too large: ${String(encodedHtml.byteLength)} bytes`)
  }

  const data = new TextEncoder().encode(
    JSON.stringify({
      response_id: input.responseId,
      sections: [
        {
          view_model: {
            primitive: { __typename: HTML_PRIMITIVE_TYPENAME, payload: input.html },
            __typename: 'GenAISingleLayoutViewModel',
          },
        },
      ],
    }),
  )

  return {
    messageContextInfo: {
      deviceListMetadata: {},
      deviceListMetadataVersion: 2,
      botMetadata: {
        messageDisclaimerText: '',
        richResponseSourcesMetadata: { sources: [] },
        botResponseId: input.responseId,
      },
    },
    botForwardedMessage: {
      message: {
        richResponseMessage: {
          messageType: 1,
          submessages:
            input.caption === undefined ? [] : [{ messageType: 2, messageText: input.caption }],
          unifiedResponse: { data },
          contextInfo: {
            forwardingScore: 1,
            isForwarded: true,
            forwardedAiBotMessageInfo: { botJid: '0@bot' },
            forwardOrigin: 4,
          },
        },
      },
    },
  }
}

/**
 * Send options the live matrix proved necessary: `type: 'text'` (the default
 * `type: 'media'` makes stock clients suppress the card entirely) plus the
 * public `biz > interactive > native_flow` node.
 */
export function htmlPrimitiveSendOptions(): AIRichSendOptions {
  return {
    additionalAttributes: { type: 'text' },
    customNodes: [
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
    ],
  }
}
