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

/**
 * Any raw `Proto.IMessage`-shaped payload. Used by the `.raw` command, where the
 * fields are only known at runtime, and satisfied by the typed builders here.
 */
export type RawProtoContent = Readonly<Record<string, unknown>>

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
 * `Uint8Array` with no extra base64 layer.
 */
export function htmlPrimitiveMessage(input: HtmlPrimitiveInput): HtmlPrimitiveContent {
  const html = new TextEncoder().encode(input.html)
  if (html.byteLength > MAX_HTML_BYTES) {
    throw new Error(`html payload too large: ${String(html.byteLength)} bytes`)
  }

  const data = new TextEncoder().encode(
    JSON.stringify({
      response_id: input.responseId,
      sections: [
        {
          view_model: {
            primitive: { __typename: HTML_PRIMITIVE_TYPENAME, payload: input.html },
          },
        },
      ],
    }),
  )

  return {
    messageContextInfo: {
      deviceListMetadata: {},
      deviceListMetadataVersion: 2,
      botMetadata: { messageDisclaimerText: '', botResponseId: input.responseId },
    },
    botForwardedMessage: {
      message: {
        richResponseMessage: {
          messageType: 1,
          submessages: [{ messageType: 2, messageText: input.caption }],
          unifiedResponse: { data },
        },
      },
    },
  }
}
