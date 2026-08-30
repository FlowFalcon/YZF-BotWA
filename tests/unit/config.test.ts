import { describe, expect, it } from 'vitest'

import { loadConfig } from '../../src/config.js'

describe('loadConfig', () => {
  it('applies safe defaults for an empty environment', () => {
    const config = loadConfig({})

    expect(config).toEqual({
      prefixes: ['.'],
      authMethod: 'auto',
      sessionId: 'default',
      storePath: '.auth/state.sqlite',
      logLevel: 'info',
      nodeEnv: 'development',
      isProduction: false,
    })
  })

  it('splits BOT_PREFIXES on comma and trims each entry', () => {
    expect(loadConfig({ BOT_PREFIXES: ' . , ! ' }).prefixes).toEqual(['.', '!'])
  })

  it('rejects an empty prefix entry', () => {
    expect(() => loadConfig({ BOT_PREFIXES: '., ,!' })).toThrow(/BOT_PREFIXES/)
  })

  it('rejects duplicate prefixes', () => {
    expect(() => loadConfig({ BOT_PREFIXES: '., .' })).toThrow(/duplicate/i)
  })

  it('rejects an unknown auth method naming the value and allowed set', () => {
    expect(() => loadConfig({ BOT_AUTH_METHOD: 'sms' })).toThrow(
      "BOT_AUTH_METHOD must be one of auto, qr, pairing; received 'sms'",
    )
  })

  it('rejects an unknown log level naming the value and allowed set', () => {
    expect(() => loadConfig({ BOT_LOG_LEVEL: 'verbose' })).toThrow(
      "BOT_LOG_LEVEL must be one of trace, debug, info, warn, error; received 'verbose'",
    )
  })

  it('normalizes BOT_OWNER_NUMBER to digits only', () => {
    expect(loadConfig({ BOT_OWNER_NUMBER: '+62 812-3456-789' }).ownerNumber).toBe('628123456789')
  })

  it('omits ownerNumber when BOT_OWNER_NUMBER has no digits', () => {
    expect(loadConfig({ BOT_OWNER_NUMBER: '  ' }).ownerNumber).toBeUndefined()
  })

  it('normalizes BOT_PAIRING_NUMBER to digits only without requiring pairing mode', () => {
    const config = loadConfig({ BOT_AUTH_METHOD: 'pairing', BOT_PAIRING_NUMBER: '+62 811 222' })

    expect(config.authMethod).toBe('pairing')
    expect(config.pairingNumber).toBe('62811222')
  })

  it('accepts pairing mode without a pairing number', () => {
    expect(loadConfig({ BOT_AUTH_METHOD: 'pairing' }).pairingNumber).toBeUndefined()
  })

  it('rejects an empty BOT_SESSION_ID', () => {
    expect(() => loadConfig({ BOT_SESSION_ID: '   ' })).toThrow('BOT_SESSION_ID must not be empty')
  })

  it('rejects an empty BOT_STORE_PATH', () => {
    expect(() => loadConfig({ BOT_STORE_PATH: '   ' })).toThrow('BOT_STORE_PATH must not be empty')
  })

  it('derives isProduction from NODE_ENV', () => {
    expect(loadConfig({ NODE_ENV: 'production' })).toMatchObject({
      nodeEnv: 'production',
      isProduction: true,
    })
    expect(loadConfig({ NODE_ENV: 'test' })).toMatchObject({
      nodeEnv: 'test',
      isProduction: false,
    })
  })
})
