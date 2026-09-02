import path from 'node:path'

const AUTH_METHODS = ['auto', 'qr', 'pairing'] as const
const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error'] as const

export type AuthMethod = (typeof AUTH_METHODS)[number]
export type LogLevel = (typeof LOG_LEVELS)[number]

export interface BotConfig {
  readonly prefixes: readonly string[]
  readonly ownerNumber: string
  readonly authMethod: AuthMethod
  readonly pairingNumber?: string
  readonly sessionId: string
  readonly storePath: string
  readonly menuThumbnailPath: string
  readonly logLevel: LogLevel
  readonly nodeEnv: string
  readonly isProduction: boolean
}

type Env = Record<string, string | undefined>

function parsePrefixes(raw: string | undefined): readonly string[] {
  const prefixes = (raw ?? '.').split(',').map((entry) => entry.trim())
  if (prefixes.some((prefix) => prefix === '')) {
    throw new Error('BOT_PREFIXES must not contain an empty entry')
  }
  if (new Set(prefixes).size !== prefixes.length) {
    throw new Error('BOT_PREFIXES must not contain duplicate entries')
  }
  return prefixes
}

function parseEnum<T extends string>(
  name: string,
  raw: string | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  if (raw === undefined || raw === '') return fallback
  const match = allowed.find((candidate) => candidate === raw)
  if (match === undefined) {
    throw new Error(`${name} must be one of ${allowed.join(', ')}; received '${raw}'`)
  }
  return match
}

// Nomor disimpan digit-only agar perbandingan identitas tidak bergantung format input.
function parseNumber(raw: string | undefined): string | undefined {
  const digits = (raw ?? '').replace(/\D/g, '')
  return digits === '' ? undefined : digits
}

function parseOwnerNumber(raw: string | undefined): string {
  const ownerNumber = parseNumber(raw)
  if (ownerNumber === undefined) {
    throw new Error('BOT_OWNER_NUMBER is required and must contain digits')
  }
  return ownerNumber
}

function parseRequired(name: string, raw: string | undefined, fallback: string): string {
  if (raw === undefined) return fallback
  const value = raw.trim()
  if (value === '') {
    throw new Error(`${name} must not be empty`)
  }
  return value
}

export function loadConfig(env: Env): BotConfig {
  const ownerNumber = parseOwnerNumber(env['BOT_OWNER_NUMBER'])
  const pairingNumber = parseNumber(env['BOT_PAIRING_NUMBER'])
  const nodeEnv = parseRequired('NODE_ENV', env['NODE_ENV'], 'development')
  const storePath = parseRequired('BOT_STORE_PATH', env['BOT_STORE_PATH'], '.auth/state.sqlite')

  return {
    prefixes: parsePrefixes(env['BOT_PREFIXES']),
    ownerNumber,
    authMethod: parseEnum('BOT_AUTH_METHOD', env['BOT_AUTH_METHOD'], AUTH_METHODS, 'auto'),
    ...(pairingNumber === undefined ? {} : { pairingNumber }),
    sessionId: parseRequired('BOT_SESSION_ID', env['BOT_SESSION_ID'], 'default'),
    storePath,
    menuThumbnailPath: menuThumbnailPath(storePath),
    logLevel: parseEnum('BOT_LOG_LEVEL', env['BOT_LOG_LEVEL'], LOG_LEVELS, 'info'),
    nodeEnv,
    isProduction: nodeEnv === 'production',
  }
}

export function menuThumbnailPath(storePath: string): string {
  return path.join(path.dirname(storePath), 'assets', 'menu-thumbnail.jpg')
}
