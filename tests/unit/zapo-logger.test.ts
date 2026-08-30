import { describe, expect, it } from 'vitest'

import { toZapoLogger } from '../../src/shared/zapo-logger.js'

interface Call {
  readonly fields: object
  readonly message: string
}

function fakePino(calls: Call[]): Parameters<typeof toZapoLogger>[0] {
  const record =
    () =>
    (fields: object, message: string): void => {
      calls.push({ fields, message })
    }

  const logger = {
    level: 'info',
    trace: record(),
    debug: record(),
    info: record(),
    warn: record(),
    error: record(),
    child: () => logger,
  }

  return logger as unknown as Parameters<typeof toZapoLogger>[0]
}

describe('toZapoLogger', () => {
  it('reorders zapo (message, context) into pino (fields, message)', () => {
    const calls: Call[] = []
    const logger = toZapoLogger(fakePino(calls), 'info')

    logger.info('connected', { sessionId: 'abc' })

    expect(calls).toEqual([{ fields: { sessionId: 'abc' }, message: 'connected' }])
  })

  it('passes an empty object when zapo omits the context', () => {
    const calls: Call[] = []
    const logger = toZapoLogger(fakePino(calls), 'info')

    logger.warn('retrying')

    expect(calls).toEqual([{ fields: {}, message: 'retrying' }])
  })

  it('reports the zapo log level, not pino levels like fatal', () => {
    expect(toZapoLogger(fakePino([]), 'debug').level).toBe('debug')
  })

  it('keeps the adapter on derived child loggers', () => {
    const calls: Call[] = []
    const child = toZapoLogger(fakePino(calls), 'info').child({ scope: 'auth' })

    child.error('failed', { attempt: 2 })

    expect(calls).toEqual([{ fields: { attempt: 2 }, message: 'failed' }])
  })
})
