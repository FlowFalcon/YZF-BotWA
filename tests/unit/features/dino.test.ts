import { describe, expect, it } from 'vitest'
import { createDinoCommand } from '../../../src/features/fun/dino.js'
import type { Command, CommandContext } from '../../../src/commands/command.js'
import type { HtmlPrimitiveContent } from '../../../src/messages/ai-rich.js'
import type { RichInteractiveContent } from '../../../src/messages/rich.js'

interface Harness {
  readonly command: Command
  readonly cards: RichInteractiveContent[]
  readonly texts: string[]
  readonly raw: HtmlPrimitiveContent[]
  play(text: string, parts?: Partial<CommandContext>): Promise<void>
}

const harness = (options: { html?: boolean; random?: () => number } = {}): Harness => {
  const cards: RichInteractiveContent[] = []
  const texts: string[] = []
  const raw: HtmlPrimitiveContent[] = []
  const command = createDinoCommand({ htmlEnabled: options.html ?? false })

  const play = async (text: string, parts: Partial<CommandContext> = {}): Promise<void> => {
    const args = text.split(' ').filter((part) => part !== '')
    const context = {
      chatJid: 'chat@s.whatsapp.net',
      senderJid: 'sender@s.whatsapp.net',
      prefix: '.',
      commandName: 'dino',
      args,
      text,
      isGroup: false,
      isOwner: true,
      now: () => 1_000,
      random: options.random ?? ((): number => 1),
      reply: (value: string) => {
        texts.push(value)
        return Promise.resolve()
      },
      replyContent: (value: RichInteractiveContent) => {
        cards.push(value)
        return Promise.resolve()
      },
      replyRaw: (value: HtmlPrimitiveContent) => {
        raw.push(value)
        return Promise.resolve()
      },
      replyMedia: () => Promise.resolve(),
      react: () => Promise.resolve(),
      ...parts,
    } as unknown as CommandContext

    await command.run(context)
  }

  return { command, cards, texts, raw, play }
}

const lastCard = (h: Harness): RichInteractiveContent => {
  const card = h.cards[h.cards.length - 1]
  if (card === undefined) throw new Error('no interactive card was sent')
  return card
}

const bodyOf = (h: Harness): string => lastCard(h).interactiveMessage.body.text

const buttonIds = (h: Harness): readonly string[] =>
  lastCard(h).interactiveMessage.nativeFlowMessage.buttons.map((button) => {
    const params = JSON.parse(button.buttonParamsJson) as { id?: string }
    return params.id ?? ''
  })

describe('dino command', () => {
  it('opens a run as a tappable card, not plain text', async () => {
    const h = harness()
    await h.play('')

    expect(h.cards).toHaveLength(1)
    expect(h.texts).toHaveLength(0)
    expect(bodyOf(h)).toContain('🦖')
  })

  it('offers jump and run as the two moves', async () => {
    const h = harness()
    await h.play('')

    expect(buttonIds(h)).toContain('.dino jump')
    expect(buttonIds(h)).toContain('.dino run')
  })

  it('advances the score when the player keeps moving', async () => {
    const h = harness()
    await h.play('')
    await h.play('run')

    expect(bodyOf(h)).toContain('1')
  })

  it('keeps a separate run per player in the same chat', async () => {
    const h = harness()
    await h.play('')
    await h.play('run')
    await h.play('run')
    await h.play('', { senderJid: 'other@s.whatsapp.net' })

    // The second player starts fresh rather than inheriting a score of 2.
    expect(bodyOf(h)).toContain('Skor: 0')
  })

  it('ends the run and offers a restart when the dino is hit', async () => {
    // random() === 0 always spawns, so a running dino is hit within one lane.
    const h = harness({ random: () => 0 })
    await h.play('')
    await runUntilCrash(h)

    expect(bodyOf(h)).toMatch(/kaktus|selesai|game over/i)
    expect(buttonIds(h)).toContain('.dino')
  })

  it('starts a brand new run after a crash instead of staying dead', async () => {
    const h = harness({ random: () => 0 })
    await h.play('')
    await runUntilCrash(h)
    const crashed = bodyOf(h)
    await h.play('')

    expect(bodyOf(h)).not.toBe(crashed)
    expect(bodyOf(h)).toContain('Skor: 0')
  })

  it('treats a move with no run in progress as a fresh start', async () => {
    const h = harness()
    await h.play('jump')

    expect(h.cards).toHaveLength(1)
    expect(bodyOf(h)).toContain('Skor: 0')
  })

  it('never sends the html payload while the flag is off', async () => {
    const h = harness({ html: false })
    await h.play('')
    await h.play('run')

    expect(h.raw).toHaveLength(0)
  })

  it('sends the html payload once when the flag is on', async () => {
    const h = harness({ html: true })
    await h.play('')

    expect(h.raw).toHaveLength(1)
    expect(h.cards).toHaveLength(1)
  })

  it('also sends the html payload in a group, since only allowlisted groups get here', async () => {
    const h = harness({ html: true })
    await h.play('', { isGroup: true })

    expect(h.raw).toHaveLength(1)
    expect(h.cards).toHaveLength(1)
  })

  it('is available to everyone, because the button route is proven', () => {
    const h = harness()
    expect(h.command.permission ?? 'everyone').toBe('everyone')
  })
})

/**
 * Keeps running until the dino is hit, detected by the restart button rather
 * than by board text (the live board also mentions kaktus in its hint).
 * Asserts a crash actually happened, so a bug that makes the game unlosable
 * fails here rather than passing silently.
 */
const runUntilCrash = async (h: Harness): Promise<void> => {
  for (let index = 0; index < 40; index += 1) {
    await h.play('run')
    if (buttonIds(h).includes('.dino')) return
  }
  throw new Error('the dino never crashed; the game cannot be lost')
}
