import { describe, expect, it } from 'vitest'

import { loadConfig } from '../../lib/config.js'

const REQUIRED_ENV = { BOT_OWNER_NUMBER: '+62 812-3456-789' }

describe('loadConfig', () => {
  it('rejects a missing or nonnumeric BOT_OWNER_NUMBER', () => {
    expect(() => loadConfig({})).toThrow('BOT_OWNER_NUMBER is required and must contain digits')
    expect(() => loadConfig({ BOT_OWNER_NUMBER: '  ' })).toThrow(
      'BOT_OWNER_NUMBER is required and must contain digits',
    )
  })

  it('applies safe defaults when required environment is present', () => {
    const config = loadConfig(REQUIRED_ENV)

    expect(config).toEqual({
      prefixes: ['.'],
      ownerNumber: '628123456789',
      authMethod: 'auto',
      sessionId: 'default',
      storePath: '.auth/state.sqlite',
      menuThumbnailPath: '.auth/assets/menu-thumbnail.jpg',
      logLevel: 'info',
      nodeEnv: 'development',
      isProduction: false,
    })
  })

  it('splits BOT_PREFIXES on comma and trims each entry', () => {
    expect(loadConfig({ ...REQUIRED_ENV, BOT_PREFIXES: ' . , ! ' }).prefixes).toEqual(['.', '!'])
  })

  it('rejects an empty prefix entry', () => {
    expect(() => loadConfig({ ...REQUIRED_ENV, BOT_PREFIXES: '., ,!' })).toThrow(/BOT_PREFIXES/)
  })

  it('rejects duplicate prefixes', () => {
    expect(() => loadConfig({ ...REQUIRED_ENV, BOT_PREFIXES: '., .' })).toThrow(/duplicate/i)
  })

  it('rejects an unknown auth method naming the value and allowed set', () => {
    expect(() => loadConfig({ ...REQUIRED_ENV, BOT_AUTH_METHOD: 'sms' })).toThrow(
      "BOT_AUTH_METHOD must be one of auto, qr, pairing; received 'sms'",
    )
  })

  it('rejects an unknown log level naming the value and allowed set', () => {
    expect(() => loadConfig({ ...REQUIRED_ENV, BOT_LOG_LEVEL: 'verbose' })).toThrow(
      "BOT_LOG_LEVEL must be one of trace, debug, info, warn, error; received 'verbose'",
    )
  })

  it('normalizes BOT_OWNER_NUMBER to digits only', () => {
    expect(loadConfig({ BOT_OWNER_NUMBER: '+62 812-3456-789' }).ownerNumber).toBe('628123456789')
  })

  it('normalizes BOT_PAIRING_NUMBER to digits only without requiring pairing mode', () => {
    const config = loadConfig({
      ...REQUIRED_ENV,
      BOT_AUTH_METHOD: 'pairing',
      BOT_PAIRING_NUMBER: '+62 811 222',
    })

    expect(config.authMethod).toBe('pairing')
    expect(config.pairingNumber).toBe('62811222')
  })

  it('accepts pairing mode without a pairing number', () => {
    expect(loadConfig({ ...REQUIRED_ENV, BOT_AUTH_METHOD: 'pairing' }).pairingNumber).toBeUndefined()
  })

  it('rejects an empty BOT_SESSION_ID', () => {
    expect(() => loadConfig({ ...REQUIRED_ENV, BOT_SESSION_ID: '   ' })).toThrow(
      'BOT_SESSION_ID must not be empty',
    )
  })

  it('rejects an empty BOT_STORE_PATH', () => {
    expect(() => loadConfig({ ...REQUIRED_ENV, BOT_STORE_PATH: '   ' })).toThrow(
      'BOT_STORE_PATH must not be empty',
    )
  })

  it('derives isProduction from NODE_ENV', () => {
    expect(loadConfig({ ...REQUIRED_ENV, NODE_ENV: 'production' })).toMatchObject({
      nodeEnv: 'production',
      isProduction: true,
    })
    expect(loadConfig({ ...REQUIRED_ENV, NODE_ENV: 'test' })).toMatchObject({
      nodeEnv: 'test',
      isProduction: false,
    })
  })
})
