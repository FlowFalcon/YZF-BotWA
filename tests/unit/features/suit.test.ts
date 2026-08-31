import { describe, expect, it, vi } from 'vitest'
import type { CommandContext } from '../../../src/commands/command.js'
import suit, { SUIT_CHOICES, judge } from '../../../src/features/fun/suit.js'
import type { RichInteractiveContent } from '../../../src/messages/rich.js'

const params = (content: RichInteractiveContent): readonly Record<string, unknown>[] =>
  content.interactiveMessage.nativeFlowMessage.buttons.map(
    (button) => JSON.parse(button.buttonParamsJson) as Record<string, unknown>,
  )

describe('judge', () => {
  it('resolves every winning pair', () => {
    expect(judge('batu', 'gunting')).toBe('win')
    expect(judge('gunting', 'kertas')).toBe('win')
    expect(judge('kertas', 'batu')).toBe('win')
  })

  it('resolves every losing pair', () => {
    expect(judge('gunting', 'batu')).toBe('lose')
    expect(judge('kertas', 'gunting')).toBe('lose')
    expect(judge('batu', 'kertas')).toBe('lose')
  })

  it('resolves draws', () => {
    for (const choice of SUIT_CHOICES) expect(judge(choice, choice)).toBe('draw')
  })
})

describe('suit command', () => {
  it('offers three tappable choices when called with no argument', async () => {
    const replyContent = vi.fn((content: RichInteractiveContent) => {
      void content
      return Promise.resolve()
    })
    await suit.run({ prefix: '.', args: [], replyContent } as unknown as CommandContext)

    const sent = replyContent.mock.calls[0]?.[0]
    expect(sent).toBeDefined()
    expect(params(sent as RichInteractiveContent).map((p) => p['id'])).toEqual([
      '.suit batu',
      '.suit gunting',
      '.suit kertas',
    ])
  })

  it('plays the round when a choice is given, using the injected randomness', async () => {
    const reply = vi.fn((text: string) => { void text; return Promise.resolve() })
    // random() === 0 selects the first choice: batu. Player gunting loses.
    await suit.run({
      prefix: '.',
      args: ['gunting'],
      random: () => 0,
      reply,
    } as unknown as CommandContext)

    const text = reply.mock.calls[0]?.[0] ?? ''
    expect(text).toContain('batu')
    expect(text).toContain('gunting')
    expect(text.toLowerCase()).toContain('kalah')
  })

  it('reports a draw', async () => {
    const reply = vi.fn((text: string) => { void text; return Promise.resolve() })
    await suit.run({
      prefix: '.',
      args: ['batu'],
      random: () => 0,
      reply,
    } as unknown as CommandContext)
    expect((reply.mock.calls[0]?.[0] ?? '').toLowerCase()).toContain('seri')
  })

  it('rejects an unknown choice without playing', async () => {
    const reply = vi.fn((text: string) => { void text; return Promise.resolve() })
    await suit.run({
      prefix: '.',
      args: ['bom'],
      random: () => 0,
      reply,
    } as unknown as CommandContext)
    expect(reply.mock.calls[0]?.[0]).toContain('batu, gunting, kertas')
  })
})
