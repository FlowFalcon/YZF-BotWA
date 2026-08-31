import { beforeEach, describe, expect, it } from 'vitest'

import type { Command, CommandContext } from '../../../src/commands/command.js'
import menu, { setMenuSource } from '../../../src/features/general/menu.js'

interface Recorder {
  readonly ctx: CommandContext
  readonly replies: string[]
}

function makeContext(prefix = '.'): Recorder {
  const replies: string[] = []
  const ctx: CommandContext = {
    chatJid: 'chat@s.whatsapp.net',
    senderJid: 'sender@s.whatsapp.net',
    isGroup: false,
    isOwner: false,
    prefix,
    commandName: 'menu',
    args: [],
    text: '',
    receivedAtMs: 0,
    now: () => 0,
    random: () => 0,
    reply: (content) => {
      replies.push(content)
      return Promise.resolve()
    },
    replyContent: async () => {},
    react: async () => {},
  }
  return { ctx, replies }
}

function makeCommand(name: string, category: Command['category'], description: string): Command {
  return { name, category, description, run: async () => {} }
}

describe('menu command', () => {
  beforeEach(() => {
    setMenuSource({
      list: () => [
        makeCommand('ping', 'general', 'Cek bot hidup.'),
        makeCommand('dice', 'fun', 'Lempar dadu.'),
        makeCommand('menu', 'general', 'Tampilkan daftar command.'),
        makeCommand('coinflip', 'fun', 'Lempar koin.'),
      ],
    })
  })

  it('declares menu metadata with the help alias', () => {
    expect(menu.name).toBe('menu')
    expect(menu.aliases).toEqual(['help'])
    expect(menu.category).toBe('general')
  })

  it('lists canonical commands grouped by category, sorted category then name', async () => {
    const { ctx, replies } = makeContext('.')

    await menu.run(ctx)

    expect(replies).toEqual([
      [
        '*Daftar Command*',
        '',
        '*fun*',
        '• .coinflip — Lempar koin.',
        '• .dice — Lempar dadu.',
        '',
        '*general*',
        '• .menu — Tampilkan daftar command.',
        '• .ping — Cek bot hidup.',
      ].join('\n'),
    ])
  })

  it('uses the active prefix from context', async () => {
    const { ctx, replies } = makeContext('!')

    await menu.run(ctx)

    expect(replies[0]).toContain('• !dice — Lempar dadu.')
    expect(replies[0]).not.toContain('• .dice')
  })

  it('replies that the menu is not ready when no source is wired', async () => {
    setMenuSource(undefined)
    const { ctx, replies } = makeContext('.')

    await menu.run(ctx)

    expect(replies).toEqual(['Menu belum siap.'])
  })
})
