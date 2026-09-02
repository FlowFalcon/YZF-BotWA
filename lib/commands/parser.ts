export interface ParsedCommand {
  readonly prefix: string
  readonly name: string
  readonly args: readonly string[]
  readonly text: string
}

/** docs/SECURITY.md §3: command body dibatasi sebelum parsing. */
export const MAX_COMMAND_BODY_BYTES = 4096

export function parseCommand(
  raw: string,
  prefixes: readonly string[],
): ParsedCommand | undefined {
  if (Buffer.byteLength(raw, 'utf8') > MAX_COMMAND_BODY_BYTES) return undefined

  const prefix = prefixes.find((candidate) => candidate !== '' && raw.startsWith(candidate))
  if (prefix === undefined) return undefined

  // Whitespace setelah prefix diizinkan dan dinormalisasi (COMMAND_SPEC §3).
  const rest = raw.slice(prefix.length).trim()
  if (rest === '') return undefined

  const separator = rest.search(/\s/)
  const token = separator === -1 ? rest : rest.slice(0, separator)
  const text = separator === -1 ? '' : rest.slice(separator).trim()

  return {
    prefix,
    name: token.toLowerCase(),
    args: text === '' ? [] : text.split(/\s+/),
    text,
  }
}
