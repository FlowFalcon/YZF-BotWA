/**
 * Native-flow interactive payloads (quick-reply buttons and single-select
 * lists) built as raw `Proto.IMessage` shapes, which is the documented API for
 * content zapo has no typed builder for yet (see docs/CREATIVE_MESSAGES.md).
 *
 * Only the low-risk interactive surface lives here. The AI-rich-response /
 * botForwardedMessage family stays out: it needs `verificationMetadata` proofs
 * we cannot legitimately produce, and SECURITY.md forbids borrowing another
 * party's certificate chain or claiming a Meta AI identity.
 */

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
): RichInteractiveContent => ({
  interactiveMessage: {
    body: { text },
    ...(footer === undefined ? {} : { footer: { text: footer } }),
    nativeFlowMessage: { messageVersion: 1, buttons },
  },
})

export function richButtons(input: {
  readonly text: string
  readonly footer?: string
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
