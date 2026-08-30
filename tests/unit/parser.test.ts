import { describe, expect, it } from 'vitest'

import { MAX_COMMAND_BODY_BYTES, parseCommand } from '../../src/commands/parser.js'

describe('parseCommand', () => {
  it('parses a simple command without arguments', () => {
    expect(parseCommand('.ping', ['.'])).toEqual({
      prefix: '.',
      name: 'ping',
      args: [],
      text: '',
    })
  })

  it('normalizes an uppercase command name to lowercase', () => {
    expect(parseCommand('.PING', ['.'])?.name).toBe('ping')
  })

  it('splits args on whitespace and keeps the remainder text intact', () => {
    expect(parseCommand('.rate  kopi   susu  ', ['.'])).toEqual({
      prefix: '.',
      name: 'rate',
      args: ['kopi', 'susu'],
      text: 'kopi   susu',
    })
  })

  it('allows whitespace between the prefix and the command name', () => {
    expect(parseCommand('.  ping', ['.'])).toEqual({
      prefix: '.',
      name: 'ping',
      args: [],
      text: '',
    })
  })

  it('rejects a bare prefix', () => {
    expect(parseCommand('.', ['.'])).toBeUndefined()
    expect(parseCommand('.   ', ['.'])).toBeUndefined()
  })

  it('rejects text without a configured prefix', () => {
    expect(parseCommand('ping', ['.'])).toBeUndefined()
  })

  it('picks the matching prefix from a multi-prefix list', () => {
    expect(parseCommand('!dice', ['.', '!', '/'])?.prefix).toBe('!')
    expect(parseCommand('/dice', ['.', '!', '/'])?.name).toBe('dice')
  })

  it('rejects input longer than the configured body limit', () => {
    const oversized = `.echo ${'a'.repeat(MAX_COMMAND_BODY_BYTES)}`
    expect(parseCommand(oversized, ['.'])).toBeUndefined()
  })
})
