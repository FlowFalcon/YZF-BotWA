/**
 * Shared native-flow and compact-card builders. Interactive images use uploaded
 * header media; compact cards use inline thumbnails without buttons.
 */

import type { MenuHeader } from './menu-media.js'

/** Zapo's inline-thumbnail ceiling; above it the field is dropped without warning. */
const INLINE_THUMBNAIL_MAX_BYTES = 64 * 1024
/**
 * Zero-width padding. The client drops the card when `matchedText` is missing
 * from the body, so the URL stays in the text and is pushed off-screen instead.
 */
const HIDDEN_PADDING = '\u200B'.repeat(400)

export interface RichButton {
  readonly text: string
  readonly id: string
}

export interface RichListRow {
  readonly title: string
  readonly id: string
  readonly description?: string
}

export interface RichListSection {
  readonly title: string
  readonly rows: readonly RichListRow[]
}

interface NativeFlowButton {
  readonly name: string
  readonly buttonParamsJson: string
}

/**
 * Structural result type. Declared explicitly rather than inferred so the router
 * and tests can read the payload without casts; it stays assignable to
 * `Proto.IMessage` because every proto field it names is optional there.
 */
export interface RichInteractiveContent {
  readonly interactiveMessage: {
    readonly header?: MenuHeader
    readonly body: { readonly text: string }
    readonly footer?: { readonly text: string }
    readonly nativeFlowMessage: {
      readonly messageVersion: 1
      readonly buttons: NativeFlowButton[]
    }
  }
}

/** Small link card: raw `extendedTextMessage`, inline thumbnail, no upload. */
export interface RichTextContent {
  readonly extendedTextMessage: {
    readonly text: string
    readonly matchedText: string
    readonly title: string
    readonly description?: string
    /** `PreviewType.NONE`; the thumbnail is what makes the card, not this flag. */
    readonly previewType: 0
    readonly jpegThumbnail: Uint8Array
    readonly thumbnailWidth: number
    readonly thumbnailHeight: number
  }
}

/** Everything `CommandContext.replyContent` accepts. */
export type RichReplyContent = RichInteractiveContent | RichTextContent

interface InteractiveInput {
  readonly text: string
  readonly footer?: string
  readonly header?: MenuHeader
  readonly buttons: NativeFlowButton[]
}

const buildInteractive = (input: InteractiveInput): RichInteractiveContent => ({
  interactiveMessage: {
    ...(input.header === undefined ? {} : { header: input.header }),
    body: { text: input.text },
    ...(input.footer === undefined ? {} : { footer: { text: input.footer } }),
    nativeFlowMessage: { messageVersion: 1, buttons: input.buttons },
  },
})

export function richButtons(input: {
  readonly text: string
  readonly footer?: string
  /** Uploaded media header; the only path that shows an image next to buttons. */
  readonly header?: MenuHeader
  readonly buttons: readonly RichButton[]
}): RichInteractiveContent {
  // A card with no buttons renders as dead text on the phone; fail loudly instead.
  if (input.buttons.length === 0) {
    throw new Error('richButtons requires at least one button')
  }
  return buildInteractive({
    text: input.text,
    ...(input.footer === undefined ? {} : { footer: input.footer }),
    ...(input.header === undefined ? {} : { header: input.header }),
    buttons: input.buttons.map((button) => ({
      name: 'quick_reply',
      buttonParamsJson: JSON.stringify({ display_text: button.text, id: button.id }),
    })),
  })
}

export function richList(input: {
  readonly text: string
  readonly footer?: string
  readonly header?: MenuHeader
  readonly title: string
  readonly buttonText: string
  readonly sections: readonly RichListSection[]
}): RichInteractiveContent {
  for (const section of input.sections) {
    if (section.rows.length === 0) {
      throw new Error(`richList section "${section.title}" requires at least one row`)
    }
  }
  return buildInteractive({
    text: input.text,
    ...(input.footer === undefined ? {} : { footer: input.footer }),
    ...(input.header === undefined ? {} : { header: input.header }),
    buttons: [
      {
        name: 'single_select',
        buttonParamsJson: JSON.stringify({
          title: input.title,
          button_text: input.buttonText,
          sections: input.sections.map((section) => ({
            title: section.title,
            rows: section.rows.map((row) => ({
              title: row.title,
              description: row.description ?? '',
              id: row.id,
            })),
          })),
        }),
      },
    ],
  })
}

/**
 * Compact reply carrying a small link card. The HQ upload fields
 * (`thumbnailDirectPath`, `mediaKey`) are omitted on purpose: they are what
 * force the tall card on the typed `linkPreview` path.
 */
export function compactCardText(input: {
  readonly text: string
  readonly url: string
  readonly title: string
  readonly description?: string
  readonly thumbnail: { readonly bytes: Uint8Array; readonly width: number; readonly height: number }
}): RichTextContent {
  if (input.thumbnail.bytes.byteLength > INLINE_THUMBNAIL_MAX_BYTES) {
    throw new Error(
      `Inline thumbnail ${String(input.thumbnail.bytes.byteLength)} bytes exceeds the 64 KiB cap and would be dropped silently.`,
    )
  }
  return {
    extendedTextMessage: {
      text: `${input.url}${HIDDEN_PADDING}\n\n${input.text}`,
      matchedText: input.url,
      title: input.title,
      ...(input.description === undefined ? {} : { description: input.description }),
      previewType: 0,
      jpegThumbnail: input.thumbnail.bytes,
      thumbnailWidth: input.thumbnail.width,
      thumbnailHeight: input.thumbnail.height,
    },
  }
}

/**
 * Inbound side. Accepts a structural view rather than `Proto.IMessage` so the
 * reader stays testable with literals, while a real decrypted message is
 * assignable (every proto field is optional and nullable).
 */
export interface RichReplySource {
  readonly interactiveResponseMessage?: {
    readonly nativeFlowResponseMessage?: {
      readonly name?: string | null
      readonly paramsJson?: string | null
    } | null
  } | null
  readonly buttonsResponseMessage?: { readonly selectedButtonId?: string | null } | null
  readonly listResponseMessage?: {
    readonly singleSelectReply?: { readonly selectedRowId?: string | null } | null
  } | null
}

/**
 * Returns the command text a tap produced, so a button press can enter the exact
 * same router path as a typed message — no parallel dispatch to keep in sync,
 * and every access gate still applies.
 */
export function readRichReplyId(message: RichReplySource | undefined): string | undefined {
  const flow = message?.interactiveResponseMessage?.nativeFlowResponseMessage
  if (flow?.paramsJson !== undefined && flow?.paramsJson !== null) {
    // A malformed payload is a remote input problem, not a bot fault: ignore it.
    const params = parseParams(flow.paramsJson)
    const id = params?.['id'] ?? params?.['selected_row_id']
    if (typeof id === 'string' && id !== '') return id
  }

  const buttonId = message?.buttonsResponseMessage?.selectedButtonId
  if (typeof buttonId === 'string' && buttonId !== '') return buttonId

  const rowId = message?.listResponseMessage?.singleSelectReply?.selectedRowId
  if (typeof rowId === 'string' && rowId !== '') return rowId

  return undefined
}

function parseParams(json: string): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(json)
    if (typeof parsed !== 'object' || parsed === null) return undefined
    return parsed as Record<string, unknown>
  } catch {
    return undefined
  }
}
