import { pino, type DestinationStream, type Logger } from 'pino'

/**
 * Field names that can carry credential material or raw message content.
 * SECURITY.md §5 forbids these in output, so they are censored at the top level and up to
 * two nested levels (covers `err.*` and `err.cause.*`). Side effect accepted deliberately:
 * `message` and `code` are censored on serialized errors too, so diagnose errors with
 * `err.type`/`err.stack` plus the structured fields from `commandLogFields`.
 *
 * ponytail: `err.stack` still reproduces the error message verbatim, so censoring
 * `message` narrows exposure rather than eliminating it. Never put a secret in an Error
 * message. Add a stack-stripping serializer if a caller ever needs to log an error whose
 * message is genuinely sensitive.
 */
const SECRET_FIELDS = [
  'credentials',
  'qr',
  'pairingCode',
  'code',
  'signature',
  'certificateChain',
  'mediaKey',
  'body',
  'message',
  'text',
  'conversation',
] as const

const REDACT_PATHS: readonly string[] = SECRET_FIELDS.flatMap((field) => [
  field,
  `*.${field}`,
  `*.*.${field}`,
])

export interface LoggerOptions {
  readonly level: string
  /**
   * `true` is the production JSON-lines path. `false` only relaxes the timestamp/level
   * rendering: pretty printing is unavailable because `pino-pretty` is not a dependency,
   * so development output stays JSON rather than pulling in a transport.
   */
  readonly json: boolean
}

export type ChatKind = 'group' | 'private'
export type CommandOutcome = 'ok' | 'error' | 'denied' | 'rate_limited'

/** No body/text/quoted field by construction: raw message content cannot be passed here. */
export interface CommandLogInput {
  readonly messageId: string
  /** Present only after registry lookup, and always canonical. */
  readonly command?: string
  readonly chatKind: ChatKind
  readonly durationMs: number
  readonly outcome: CommandOutcome
}

export function commandLogFields(input: CommandLogInput): CommandLogInput {
  return {
    messageId: input.messageId,
    ...(input.command === undefined ? {} : { command: input.command }),
    chatKind: input.chatKind,
    durationMs: input.durationMs,
    outcome: input.outcome,
  }
}

export function createLogger(options: LoggerOptions, destination?: DestinationStream): Logger {
  const base = {
    level: options.level,
    redact: { paths: [...REDACT_PATHS], censor: '[REDACTED]' },
    // Only knob `json: false` can change without pino-pretty: readable ISO timestamps.
    ...(options.json ? {} : { timestamp: pino.stdTimeFunctions.isoTime }),
  }
  return destination === undefined ? pino(base) : pino(base, destination)
}
