import { describe, expect, it } from 'vitest'

import type { Command, CommandContext } from '../../src/commands/command.js'
import {
  GENERIC_ERROR_REPLY,
  runWithErrorBoundary,
  type CommandErrorReport,
} from '../../src/commands/middleware/error-boundary.js'

function buildContext(overrides: Partial<CommandContext> = {}): CommandContext {
  return {
    chatJid: '62800-1@g.us',
    senderJid: '62800@s.whatsapp.net',
    isGroup: true,
    isOwner: false,
    prefix: '.',
    commandName: 'dice',
    args: [],
    text: '',
    receivedAtMs: 1_000,
    now: () => 1_050,
    random: () => 0.5,
    reply: () => Promise.resolve(),
    replyContent: () => Promise.resolve(),
    replyMedia: () => Promise.resolve(),
    replyRaw: () => Promise.resolve(),
    react: () => Promise.resolve(),
    ...overrides,
  }
}

function buildCommand(run: Command['run']): Command {
  return { name: 'dice', category: 'fun', description: 'Melempar dadu.', run }
}

describe('runWithErrorBoundary', () => {
  it('mengembalikan ok tanpa reply tambahan saat command sukses', async () => {
    const replies: string[] = []
    const reports: CommandErrorReport[] = []
    const context = buildContext({
      reply: (content) => {
        replies.push(content)
        return Promise.resolve()
      },
    })

    const outcome = await runWithErrorBoundary(
      buildCommand(async (ctx) => {
        await ctx.reply('ok dari command')
      }),
      context,
      { reporter: (report) => reports.push(report) },
    )

    expect(outcome).toBe('ok')
    expect(replies).toEqual(['ok dari command'])
    expect(reports).toEqual([])
  })

  it('membalas generic tanpa detail internal dan melaporkan error terstruktur', async () => {
    const replies: string[] = []
    const reports: CommandErrorReport[] = []
    const failure = new Error('koneksi sqlite gagal di /root/.auth/state.sqlite')
    const context = buildContext({
      reply: (content) => {
        replies.push(content)
        return Promise.resolve()
      },
    })

    const outcome = await runWithErrorBoundary(buildCommand(() => Promise.reject(failure)), context, {
      reporter: (report) => reports.push(report),
    })

    expect(outcome).toBe('error')
    expect(replies).toEqual([GENERIC_ERROR_REPLY])
    expect(replies[0]).not.toContain('sqlite')
    expect(replies[0]).not.toContain('Error')
    expect(reports).toEqual([{ stage: 'run', command: 'dice', error: failure }])
  })

  it('menangani reply gagal tanpa retry atau rekursi', async () => {
    const reports: CommandErrorReport[] = []
    const runFailure = new Error('run meledak')
    const replyFailure = new Error('send gagal')
    let replyCalls = 0
    const context = buildContext({
      reply: () => {
        replyCalls += 1
        return Promise.reject(replyFailure)
      },
    })

    const outcome = await runWithErrorBoundary(
      buildCommand(() => Promise.reject(runFailure)),
      context,
      { reporter: (report) => reports.push(report) },
    )

    expect(outcome).toBe('error')
    expect(replyCalls).toBe(1)
    expect(reports).toEqual([
      { stage: 'run', command: 'dice', error: runFailure },
      { stage: 'reply', command: 'dice', error: replyFailure },
    ])
  })

  it('melaporkan throw non-Error apa adanya', async () => {
    const reports: CommandErrorReport[] = []

    const outcome = await runWithErrorBoundary(
      buildCommand(() => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error -- command bisa melempar apa saja.
        throw 'string mentah'
      }),
      buildContext(),
      { reporter: (report) => reports.push(report) },
    )

    expect(outcome).toBe('error')
    expect(reports).toEqual([{ stage: 'run', command: 'dice', error: 'string mentah' }])
  })
})
