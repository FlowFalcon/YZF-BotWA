/**
 * Reusable presentation builders. Native-flow uses raw `Proto.IMessage`
 * shapes because zapo has no typed convenience builder for it yet. AIRich HTML
 * remains isolated in `ai-rich.ts`; neither path borrows verification metadata
 * or claims a Meta AI identity.
 */

/**
 * `ContextInfo.ExternalAdReplyInfo` subset this project uses. `mediaType: 1`
 * is `MediaType.IMAGE` in the installed proto; the bytes travel inline, so no
 * credential-bearing direct path is ever attached.
 */
export interface ExternalAdReplyCard {
  readonly title: string
  readonly body?: string
  readonly sourceUrl?: string
  /** Raw image bytes; never use a credential-bearing direct path. */
  readonly thumbnail?: Uint8Array
  readonly renderLargerThumbnail?: boolean
  readonly showAdAttribution?: boolean
}

interface ExternalAdReplyProto {
  readonly title: string
  readonly body?: string
  readonly sourceUrl?: string
  readonly thumbnail?: Uint8Array
  readonly mediaType: 1
  readonly renderLargerThumbnail: boolean
  readonly showAdAttribution: boolean
}

function externalAdReplyProto(card: ExternalAdReplyCard): ExternalAdReplyProto {
  return {
    title: card.title,
    ...(card.body === undefined ? {} : { body: card.body }),
    ...(card.sourceUrl === undefined ? {} : { sourceUrl: card.sourceUrl }),
    ...(card.thumbnail === undefined ? {} : { thumbnail: card.thumbnail }),
    mediaType: 1,
    renderLargerThumbnail: card.renderLargerThumbnail ?? false,
    showAdAttribution: card.showAdAttribution ?? false,
  }
}

export interface ExternalAdReplyTextInput extends ExternalAdReplyCard {
  readonly text: string
}

/**
 * Compact text reply carrying a link-preview-style card. `contextInfo.raw` is
 * the public zapo escape hatch for proto fields its typed builder omits.
 */
export function externalAdReplyText(input: ExternalAdReplyTextInput): RichTextContent {
  return {
    type: 'text',
    text: input.text,
    contextInfo: { raw: { externalAdReply: externalAdReplyProto(input) } },
  }
}

/**
 * Structural mirror of zapo's `WaSendTextMessage` for the card path, declared
 * here so `lib/commands/command.ts` stays free of a zapo-js import. Assignability
 * to the real send contract is enforced where `lib/messages/context.ts` passes
 * it to `message.send`.
 */
export interface RichTextContent {
  readonly type: 'text'
  readonly text: string
  readonly contextInfo: { readonly raw: { readonly externalAdReply: ExternalAdReplyProto } }
}

/** Everything `CommandContext.replyContent` accepts. */
export type RichReplyContent = RichInteractiveContent | RichTextContent

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
 * Structural result type. Declared explicitly rather than inferred so the
 * router and tests can read the payload without casts; it stays assignable to
 * `Proto.IMessage` because every proto field it names is optional there.
 */
export interface RichInteractiveContent {
  readonly interactiveMessage: {
    readonly body: { readonly text: string }
    readonly footer?: { readonly text: string }
    readonly contextInfo?: { readonly externalAdReply: ExternalAdReplyProto }
    readonly nativeFlowMessage: {
      readonly messageVersion: 1
      readonly buttons: NativeFlowButton[]
    }
  }
}

const buildContent = (
  text: string,
  footer: string | undefined,
  buttons: NativeFlowButton[],
  card?: ExternalAdReplyCard,
): RichInteractiveContent => ({
  interactiveMessage: {
    body: { text },
    ...(footer === undefined ? {} : { footer: { text: footer } }),
    ...(card === undefined ? {} : { contextInfo: { externalAdReply: externalAdReplyProto(card) } }),
    nativeFlowMessage: { messageVersion: 1, buttons },
  },
})

export function richButtons(input: {
  readonly text: string
  readonly footer?: string
  /** Thumbnail/branding card; the native header is not used (see DECISIONS D-019). */
  readonly externalAdReply?: ExternalAdReplyCard
  readonly buttons: readonly RichButton[]
}): RichInteractiveContent {
  // A card with no buttons renders as dead text on the phone; fail loudly instead.
  if (input.buttons.length === 0) {
    throw new Error('richButtons requires at least one button')
  }
  return buildContent(
    input.text,
    input.footer,
    input.buttons.map((button) => ({
      name: 'quick_reply',
      buttonParamsJson: JSON.stringify({ display_text: button.text, id: button.id }),
    })),
    input.externalAdReply,
  )
}

export function richList(input: {
  readonly text: string
  readonly footer?: string
  readonly title: string
  readonly buttonText: string
  readonly sections: readonly RichListSection[]
}): RichInteractiveContent {
  for (const section of input.sections) {
    if (section.rows.length === 0) {
      throw new Error(`richList section "${section.title}" requires at least one row`)
    }
  }
  return buildContent(input.text, input.footer, [
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
  ])
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
 * Returns the command text a tap produced, so a button press can enter the
 * exact same router path as a typed message — no parallel dispatch to keep in
 * sync, and every access gate still applies.
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
