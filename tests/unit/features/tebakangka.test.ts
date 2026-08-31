import { describe, expect, it, vi } from 'vitest'
import type { CommandContext } from '../../../src/commands/command.js'
import tebakangka, { evaluateGuess } from '../../../src/features/fun/tebakangka.js'
import type { RichInteractiveContent } from '../../../src/messages/rich.js'

const ids = (content: RichInteractiveContent): readonly unknown[] =>
  content.interactiveMessage.nativeFlowMessage.buttons.map(
    (button) => (JSON.parse(button.buttonParamsJson) as Record<string, unknown>)['id'],
  )

describe('evaluateGuess', () => {
  it('reports an exact hit', () => {
    expect(evaluateGuess(7, 7)).toBe('hit')
  })

  it('reports direction for a miss', () => {
    expect(evaluateGuess(3, 7)).toBe('higher')
    expect(evaluateGuess(9, 7)).toBe('lower')
  })
})

describe('tebakangka command', () => {
  it('offers tappable guesses when called with no argument', async () => {
    const replyContent = vi.fn((content: RichInteractiveContent) => {
      void content
      return Promise.resolve()
    })
    await tebakangka.run({ prefix: '.', args: [], replyContent } as unknown as CommandContext)

    const sent = replyContent.mock.calls[0]?.[0]
    expect(sent).toBeDefined()
    expect(ids(sent as RichInteractiveContent)).toEqual([
      '.tebakangka 1',
      '.tebakangka 2',
      '.tebakangka 3',
      '.tebakangka 4',
      '.tebakangka 5',
    ])
  })

  it('congratulates an exact guess', async () => {
    const reply = vi.fn((text: string) => { void text; return Promise.resolve() })
    // random() === 0 puts the secret at the low end of the range: 1.
    await tebakangka.run({
      prefix: '.',
      args: ['1'],
      random: () => 0,
      reply,
    } as unknown as CommandContext)
    expect((reply.mock.calls[0]?.[0] ?? '').toLowerCase()).toContain('tepat')
  })

  it('nudges the player up or down on a miss', async () => {
    const reply = vi.fn((text: string) => { void text; return Promise.resolve() })
    await tebakangka.run({
      prefix: '.',
      args: ['5'],
      random: () => 0,
      reply,
    } as unknown as CommandContext)
    expect((reply.mock.calls[0]?.[0] ?? '').toLowerCase()).toContain('besar')
  })

  it('rejects a non-numeric or out-of-range guess', async () => {
    const reply = vi.fn((text: string) => { void text; return Promise.resolve() })
    await tebakangka.run({
      prefix: '.',
      args: ['abc'],
      random: () => 0,
      reply,
    } as unknown as CommandContext)
    expect(reply.mock.calls[0]?.[0]).toContain('1 sampai 5')

    const reply2 = vi.fn((text: string) => { void text; return Promise.resolve() })
    await tebakangka.run({
      prefix: '.',
      args: ['9'],
      random: () => 0,
      reply: reply2,
    } as unknown as CommandContext)
    expect(reply2.mock.calls[0]?.[0]).toContain('1 sampai 5')
  })
})
