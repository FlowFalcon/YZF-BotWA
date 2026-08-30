import { describe, expect, it } from 'vitest'
import type { WaSendMessageContent } from 'zapo-js'
import {
  createMessageRouter,
  OWNER_ONLY_REPLY,
  rateLimitReply,
} from '../../src/messages/router.js'
import type { CommandReport, MessageRouterOptions } from '../../src/messages/router.js'
import { createCommandRegistry } from '../../src/commands/registry.js'
import type { Command, CommandContext } from '../../src/commands/command.js'
import { GENERIC_ERROR_REPLY } from '../../src/commands/middleware/error-boundary.js'
import type { CommandErrorReport } from '../../src/commands/middleware/error-boundary.js'
import {
  buildIncomingMessageEvent,
  groupPnParticipantEvent,
  PEER_PN_JID,
  privatePnEvent,
  textMessage,
} from '../fixtures/messages.js'

interface SentMessage {
  readonly to: string
  readonly content: WaSendMessageContent
}

interface Harness {
  readonly options: MessageRouterOptions
  readonly sent: SentMessage[]
  /** Canonical names of the commands that actually executed, in order. */
  readonly ran: string[]
  readonly contexts: CommandContext[]
}

function recording(harnessState: { ran: string[]; contexts: CommandContext[] }, name: string) {
  return (context: CommandContext): Promise<void> => {
    harnessState.ran.push(name)
    harnessState.contexts.push(context)
    return Promise.resolve()
  }
}

function harness(
  build: (state: { ran: string[]; contexts: CommandContext[] }) => readonly Command[],
  overrides?: Partial<MessageRouterOptions>,
): Harness {
  const state = { ran: [] as string[], contexts: [] as CommandContext[] }
  const commands = build(state)
  const sent: SentMessage[] = []
  return {
    ran: state.ran,
    contexts: state.contexts,
    sent,
    options: {
      registry: createCommandRegistry([...commands]),
      prefixes: ['.'],
      sender: {
        message: {
          send: (to, content) => {
            sent.push({ to, content })
            return Promise.resolve()
          },
        },
      },
      clock: { now: () => 1_000, schedule: () => () => undefined },
      random: { next: () => 0.5 },
      flood: { check: () => ({ allowed: true }) },
      cooldown: { check: () => ({ allowed: true }) },
      reporter: { command: () => undefined, error: () => undefined },
      ...overrides,
    },
  }
}

function pingWithAlias(state: { ran: string[]; contexts: CommandContext[] }): Command {
  return {
    name: 'ping',
    aliases: ['p'],
    category: 'general',
    description: 'ping',
    run: recording(state, 'ping'),
  }
}

describe('createMessageRouter', () => {
  it('ignores messages the bot itself sent', async () => {
    const { options, ran, sent } = harness((state) => [pingWithAlias(state)])
    const route = createMessageRouter(options)

    await route(
      buildIncomingMessageEvent({
        remoteJid: PEER_PN_JID,
        fromMe: true,
        message: textMessage('.ping'),
      }),
    )

    expect(ran).toEqual([])
    expect(sent).toEqual([])
  })

  it('runs the canonical command when the user types an alias', async () => {
    const { options, ran } = harness((state) => [pingWithAlias(state)])
    const route = createMessageRouter(options)

    await route(privatePnEvent(textMessage('.p')))

    expect(ran).toEqual(['ping'])
  })

  it('ignores newsletter and unsupported broadcast messages', async () => {
    const { options, ran, sent } = harness((state) => [pingWithAlias(state)])
    const route = createMessageRouter(options)
    const base = privatePnEvent(textMessage('.ping'))

    await route({ ...base, key: { ...base.key, isNewsletter: true } })
    await route({ ...base, key: { ...base.key, isBroadcast: true } })

    expect(ran).toEqual([])
    expect(sent).toEqual([])
  })

  it('ignores text that is not a command and unknown commands, without replying', async () => {
    const { options, ran, sent } = harness((state) => [pingWithAlias(state)])
    const route = createMessageRouter(options)

    await route(privatePnEvent(textMessage('halo bot')))
    await route(privatePnEvent(textMessage('.tidakada')))
    await route(privatePnEvent(undefined))

    expect(ran).toEqual([])
    expect(sent).toEqual([])
  })

  it('passes prefix, args and text through to the command', async () => {
    const { options, contexts } = harness((state) => [
      {
        name: 'rate',
        category: 'fun',
        description: 'rate',
        run: recording(state, 'rate'),
      },
    ])
    const route = createMessageRouter(options)

    await route(privatePnEvent(textMessage('.rate kopi susu')))

    const context = contexts[0]
    expect(context?.prefix).toBe('.')
    expect(context?.commandName).toBe('rate')
    expect(context?.args).toEqual(['kopi', 'susu'])
    expect(context?.text).toBe('kopi susu')
  })

  it('denies an owner-only command for a non-owner without consuming the cooldown', async () => {
    const cooldownCalls: string[] = []
    const { options, ran, sent } = harness(
      (state) => [
        {
          name: 'shutdown',
          category: 'general',
          description: 'shutdown',
          permission: 'owner',
          run: recording(state, 'shutdown'),
        },
      ],
      {
        cooldown: {
          check: (senderJid) => {
            cooldownCalls.push(senderJid)
            return { allowed: true }
          },
        },
      },
    )
    const route = createMessageRouter(options)

    await route(privatePnEvent(textMessage('.shutdown')))

    expect(ran).toEqual([])
    expect(cooldownCalls).toEqual([])
    expect(sent).toEqual([{ to: PEER_PN_JID, content: OWNER_ONLY_REPLY }])
  })

  it('runs an owner-only command for the configured owner', async () => {
    const { options, ran } = harness(
      (state) => [
        {
          name: 'shutdown',
          category: 'general',
          description: 'shutdown',
          permission: 'owner',
          run: recording(state, 'shutdown'),
        },
      ],
      { ownerNumber: '6289876543210' },
    )
    const route = createMessageRouter(options)

    await route(privatePnEvent(textMessage('.shutdown')))

    expect(ran).toEqual(['shutdown'])
  })

  it('replies with the remaining wait when the flood gate blocks', async () => {
    const { options, ran, sent } = harness((state) => [pingWithAlias(state)], {
      flood: { check: () => ({ allowed: false, retryAfterMs: 2_400 }) },
    })
    const route = createMessageRouter(options)

    await route(privatePnEvent(textMessage('.ping')))

    expect(ran).toEqual([])
    expect(sent).toEqual([{ to: PEER_PN_JID, content: rateLimitReply(2_400) }])
  })

  it('replies with the remaining wait when the cooldown gate blocks', async () => {
    const { options, ran, sent } = harness((state) => [pingWithAlias(state)], {
      cooldown: { check: () => ({ allowed: false, retryAfterMs: 1_500 }) },
    })
    const route = createMessageRouter(options)

    await route(privatePnEvent(textMessage('.ping')))

    expect(ran).toEqual([])
    expect(sent).toEqual([{ to: PEER_PN_JID, content: rateLimitReply(1_500) }])
  })

  it('checks the cooldown against the canonical command, not the alias typed', async () => {
    const seen: string[] = []
    const { options } = harness((state) => [pingWithAlias(state)], {
      cooldown: {
        check: (_senderJid, command) => {
          seen.push(command.name)
          return { allowed: true }
        },
      },
    })
    const route = createMessageRouter(options)

    await route(privatePnEvent(textMessage('.p')))

    expect(seen).toEqual(['ping'])
  })

  it('replies generically when a command throws and still routes the next event', async () => {
    const ran: string[] = []
    const errors: CommandErrorReport[] = []
    const { options, sent } = harness(
      () => [
        {
          name: 'boom',
          category: 'fun',
          description: 'boom',
          run: () => Promise.reject(new Error('kaboom')),
        },
        {
          name: 'ping',
          category: 'general',
          description: 'ping',
          run: () => {
            ran.push('ping')
            return Promise.resolve()
          },
        },
      ],
      {
        reporter: {
          command: () => undefined,
          error: (report) => errors.push(report),
        },
      },
    )
    const route = createMessageRouter(options)

    await route(privatePnEvent(textMessage('.boom')))
    await route(privatePnEvent(textMessage('.ping')))

    expect(sent).toEqual([{ to: PEER_PN_JID, content: GENERIC_ERROR_REPLY }])
    expect(errors.map((report) => report.command)).toEqual(['boom'])
    expect(ran).toEqual(['ping'])
  })

  it('reports duration and outcome without any message body', async () => {
    const reports: CommandReport[] = []
    let nowMs = 1_000
    const { options } = harness((state) => [pingWithAlias(state)], {
      clock: {
        now: () => {
          nowMs += 5
          return nowMs
        },
        schedule: () => () => undefined,
      },
      reporter: {
        command: (report) => reports.push(report),
        error: () => undefined,
      },
    })
    const route = createMessageRouter(options)

    await route(privatePnEvent(textMessage('.p halo dunia')))

    const report = reports[0]
    expect(reports).toHaveLength(1)
    expect(report?.command).toBe('ping')
    expect(report?.chatKind).toBe('private')
    expect(report?.outcome).toBe('ok')
    expect(report?.messageId).toBe('MSG-1')
    expect(report?.durationMs).toBeGreaterThanOrEqual(0)
    expect(JSON.stringify(report)).not.toContain('halo dunia')
  })

  it('reports denied and rate_limited outcomes, and group chat kind', async () => {
    const reports: CommandReport[] = []
    const reporter = {
      command: (report: CommandReport) => reports.push(report),
      error: () => undefined,
    }
    const denied = harness(
      (state) => [
        {
          name: 'shutdown',
          category: 'general',
          description: 'shutdown',
          permission: 'owner',
          run: recording(state, 'shutdown'),
        },
      ],
      { reporter },
    )
    const limited = harness((state) => [pingWithAlias(state)], {
      reporter,
      flood: { check: () => ({ allowed: false, retryAfterMs: 100 }) },
    })

    await createMessageRouter(denied.options)(privatePnEvent(textMessage('.shutdown')))
    await createMessageRouter(limited.options)(groupPnParticipantEvent(textMessage('.ping')))

    expect(reports.map((report) => [report.command, report.outcome, report.chatKind])).toEqual([
      ['shutdown', 'denied', 'private'],
      ['ping', 'rate_limited', 'group'],
    ])
  })
})
