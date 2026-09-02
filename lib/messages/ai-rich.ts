/**
 * The typename WhatsApp's client maps to its HTML renderer. Discovered from a
 * third-party payload; the string itself is an identifier, not copied code.
 */
export const HTML_PRIMITIVE_TYPENAME = 'GenAIaeacdsnwHtmlPrimitive'

/** Ceiling on the HTML payload. A half-sent page renders as a blank card. */
const MAX_HTML_BYTES = 128 * 1024

export interface HtmlPrimitiveInput {
  readonly html: string
  /** Shown by clients that cannot render the primitive. */
  readonly caption: string
  readonly responseId: string
}

/** Structural proto payload returned by the typed AIRich builders in this module. */
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

/**
 * One renderer entry. Each renderer decides how it serializes into the
 * unified-response payload; the wrapper below stays the single owner of the
 * surrounding `botForwardedMessage` shape.
 */
export type RichSection =
  | {
      readonly kind: 'html'
      readonly html: string
      readonly caption: string
    }
  | {
      readonly kind: 'v4'
      /** Pre-built V4 unified-response payload (already JSON-encoded). */
      readonly payload: Uint8Array
      /** Caption / fallback submessage rendered when the primitive is unavailable. */
      readonly caption: string
    }

export interface BuildRichResponseMessageInput {
  readonly responseId: string
  readonly disclaimer: string
  readonly sections: readonly RichSection[]
}

/**
 * Shared builder for every AIRich renderer (HTML primitives, V4 typed sections,
 * future primitives). Each section contributes one `unifiedResponse.data`
 * entry; the surrounding `botForwardedMessage` shape is owned here so the
 * proof-free wire contract stays in one place.
 */
export function buildRichResponseMessage(input: BuildRichResponseMessageInput): AIRichContent {
  const unifiedSections = input.sections.map((section) => {
    if (section.kind === 'html') {
      return {
        view_model: {
          primitive: { __typename: HTML_PRIMITIVE_TYPENAME, payload: section.html },
        },
      }
    }
    return JSON.parse(new TextDecoder().decode(section.payload)) as { response_id: string; sections: readonly unknown[] }
  }).flatMap((entry) => ('sections' in entry ? entry.sections : [entry]))

  const data = new TextEncoder().encode(
    JSON.stringify({
      response_id: input.responseId,
      sections: unifiedSections,
    }),
  )

  const fallback = input.sections.find((section) => section.caption.length > 0)

  return {
    messageContextInfo: {
      deviceListMetadata: {},
      deviceListMetadataVersion: 2,
      botMetadata: {
        messageDisclaimerText: input.disclaimer,
        botResponseId: input.responseId,
      },
    },
    botForwardedMessage: {
      message: {
        richResponseMessage: {
          messageType: 1,
          submessages: fallback === undefined
            ? [{ messageType: 2, messageText: '' }]
            : [{ messageType: 2, messageText: fallback.caption }],
          unifiedResponse: { data },
        },
      },
    },
  }
}

/**
 * Stock clients suppress AIRich sent as the dispatcher default `type=media`.
 * The public Zapo escape hatches mirror the companion node used by working
 * Baileys/whatsmeow implementations and force the stanza to advertise text.
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

export type HtmlPrimitiveContent = {
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

/**
 * Builds a `botForwardedMessage` carrying an HTML view model.
 *
 * Deliberately proof-free: no `verificationMetadata`, no certificate chain, no
 * `botJid`. CREATIVE_MESSAGES.md §7 forbids reusing another party's certificates
 * or posing as an official bot, and the disclaimer text stays empty rather than
 * asserting an identity the bot does not have.
 *
 * `unifiedResponse.data` is protobuf `bytes`, so the JSON is encoded to a
 * `Uint8Array` with no extra base64 layer. Delegates to the shared
 * `buildRichResponseMessage` so HTML and V4 consumers share one wrapper.
 */
export function htmlPrimitiveMessage(input: HtmlPrimitiveInput): HtmlPrimitiveContent {
  const html = new TextEncoder().encode(input.html)
  if (html.byteLength > MAX_HTML_BYTES) {
    throw new Error(`html payload too large: ${String(html.byteLength)} bytes`)
  }

  return buildRichResponseMessage({
    responseId: input.responseId,
    disclaimer: '',
    sections: [{ kind: 'html', html: input.html, caption: input.caption }],
  })
}
