import { describe, expect, it } from 'vitest'

import { createLogger, commandLogFields } from '../../lib/shared/logger.js'

interface Capture {
  readonly lines: () => readonly Record<string, unknown>[]
  readonly stream: { write: (chunk: string) => void }
}

function capture(): Capture {
  const raw: string[] = []
  return {
    lines: () =>
      raw
        .join('')
        .split('\n')
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line) as Record<string, unknown>),
    stream: {
      write: (chunk: string): void => {
        raw.push(chunk)
      },
    },
  }
}

describe('createLogger', () => {
  it('emits only records at or above the configured level', () => {
    const sink = capture()
    const logger = createLogger({ level: 'warn', json: true }, sink.stream)

    logger.info({ step: 'ignored' }, 'below level')
    logger.warn({ step: 'kept' }, 'at level')

    const lines = sink.lines()
    expect(lines).toHaveLength(1)
    expect(lines[0]?.msg).toBe('at level')
    expect(lines[0]?.step).toBe('kept')
  })

  it('redacts secret-bearing fields at top level and one level deep', () => {
    const sink = capture()
    const logger = createLogger({ level: 'info', json: true }, sink.stream)

    logger.info(
      {
        credentials: 'SECRET-CREDS',
        qr: 'SECRET-QR',
        pairingCode: 'SECRET-PAIR',
        err: { mediaKey: 'SECRET-MEDIAKEY', signature: 'SECRET-SIG' },
      },
      'connection update',
    )

    const raw = JSON.stringify(sink.lines())
    expect(raw).not.toContain('SECRET-CREDS')
    expect(raw).not.toContain('SECRET-QR')
    expect(raw).not.toContain('SECRET-PAIR')
    expect(raw).not.toContain('SECRET-MEDIAKEY')
    expect(raw).not.toContain('SECRET-SIG')
    expect(lines0(sink).credentials).toBe('[REDACTED]')
  })

  it('redacts raw message content fields even when nested in an event-like object', () => {
    const sink = capture()
    const logger = createLogger({ level: 'info', json: true }, sink.stream)

    logger.info(
      {
        messageId: 'ABC123',
        body: 'RAW-BODY',
        payload: { text: 'RAW-TEXT', conversation: 'RAW-CONVERSATION' },
      },
      'command received',
    )

    const line = lines0(sink)
    expect(JSON.stringify(line)).not.toMatch(/RAW-(BODY|TEXT|CONVERSATION)/)
    expect(line.body).toBe('[REDACTED]')
    expect(line.messageId).toBe('ABC123')
  })

  it('emits only the safe structured fields from the command log helper', () => {
    const sink = capture()
    const logger = createLogger({ level: 'info', json: true }, sink.stream)

    logger.info(
      commandLogFields({
        messageId: 'MSG-1',
        command: 'ping',
        chatKind: 'group',
        durationMs: 12,
        outcome: 'ok',
      }),
      'command handled',
    )

    const line = lines0(sink)
    expect(line.messageId).toBe('MSG-1')
    expect(line.command).toBe('ping')
    expect(line.chatKind).toBe('group')
    expect(line.durationMs).toBe(12)
    expect(line.outcome).toBe('ok')
    expect(Object.keys(line).sort()).toEqual([
      'chatKind',
      'command',
      'durationMs',
      'hostname',
      'level',
      'messageId',
      'msg',
      'outcome',
      'pid',
      'time',
    ])
  })

  it('honors production JSON mode with epoch time and uses human time otherwise', () => {
    const prod = capture()
    createLogger({ level: 'info', json: true }, prod.stream).info('prod')
    const dev = capture()
    createLogger({ level: 'info', json: false }, dev.stream).info('dev')

    expect(typeof lines0(prod).time).toBe('number')
    expect(lines0(dev).time).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})

function lines0(sink: Capture): Record<string, unknown> {
  const line = sink.lines()[0]
  if (line === undefined) {
    throw new Error('no log line captured')
  }
  return line
}
