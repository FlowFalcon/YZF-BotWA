import { describe, expect, it } from 'vitest'

import { createMessageRouter } from '../../src/messages/router.js'
import type { CommandReport } from '../../src/messages/router.js'
import { createCommandRegistry } from '../../src/commands/registry.js'
import type { Command } from '../../src/commands/command.js'
import { buildIncomingMessageEvent, GROUP_JID, OWNER_PN_JID, PEER_PN_JID, textMessage } from '../fixtures/messages.js'

const OWNER_NUMBER = OWNER_PN_JID.split('@')[0] ?? ''
const ALLOWED_GROUP = GROUP_JID
const OTHER_GROUP = '120363999999999999@g.us'

const ping = {
  name: 'ping',
  category: 'general',
  description: 'ping',
  async run(ctx) {
    await ctx.reply('pong')
  },
} satisfies Command

/** Stands in for the real access command; only the routing gate is under test. */
const access = {
  name: 'access',
  category: 'general',
  description: 'access',
  permission: 'owner',
  async run(ctx) {
    await ctx.reply('access-ran')
  },
} satisfies Command

interface Harness {
  readonly route: ReturnType<typeof createMessageRouter>
  readonly sent: string[]
  readonly reports: CommandReport[]
}

function harness(allowedGroups: readonly string[]): Harness {
  const sent: string[] = []
  const reports: CommandReport[] = []

  const route = createMessageRouter({
    registry: createCommandRegistry([ping, access]),
    prefixes: ['.'],
    sender: {
      message: {
        send: (_to, content) => {
          sent.push(typeof content === 'string' ? content : JSON.stringify(content))
          return Promise.resolve()
        },
      },
    },
    clock: { now: () => 0, schedule: () => () => {} },
    random: { next: () => 0 },
    flood: { check: () => ({ allowed: true }) },
    cooldown: { check: () => ({ allowed: true }) },
    reporter: { command: (report) => reports.push(report), error: () => {} },
    ownerNumber: OWNER_NUMBER,
    access: { has: (jid) => allowedGroups.includes(jid) },
  })

  return { route, sent, reports }
}

describe('router private-mode access', () => {
  it('answers the owner in a private chat', async () => {
    const h = harness([])

    await h.route(buildIncomingMessageEvent({ remoteJid: OWNER_PN_JID, message: textMessage('.ping') }))

    expect(h.sent).toEqual(['pong'])
  })

  it('stays silent for a stranger in a private chat', async () => {
    const h = harness([])

    await h.route(buildIncomingMessageEvent({ remoteJid: PEER_PN_JID, message: textMessage('.ping') }))

    expect(h.sent).toEqual([])
  })

  it('answers a non-owner inside an allowlisted group', async () => {
    const h = harness([ALLOWED_GROUP])

    await h.route(
      buildIncomingMessageEvent({
        remoteJid: ALLOWED_GROUP,
        isGroup: true,
        participant: PEER_PN_JID,
        message: textMessage('.ping'),
      }),
    )

    expect(h.sent).toEqual(['pong'])
  })

  it('stays silent for a non-owner in a group that is not allowlisted', async () => {
    const h = harness([ALLOWED_GROUP])

    await h.route(
      buildIncomingMessageEvent({
        remoteJid: OTHER_GROUP,
        isGroup: true,
        participant: PEER_PN_JID,
        message: textMessage('.ping'),
      }),
    )

    expect(h.sent).toEqual([])
  })

  it('stays silent even for the owner in a group that is not allowlisted', async () => {
    const h = harness([])

    await h.route(
      buildIncomingMessageEvent({
        remoteJid: OTHER_GROUP,
        isGroup: true,
        participant: OWNER_PN_JID,
        message: textMessage('.ping'),
      }),
    )

    expect(h.sent).toEqual([])
  })

  // The escape hatch: without it the owner could never enable a group, since the
  // group JID is not reachable from a private chat.
  it('lets the owner run the allowlist command in a group that is not allowlisted', async () => {
    const h = harness([])

    await h.route(
      buildIncomingMessageEvent({
        remoteJid: OTHER_GROUP,
        isGroup: true,
        participant: OWNER_PN_JID,
        message: textMessage('.access list'),
      }),
    )

    expect(h.sent).toEqual(['access-ran'])
  })

  it('reports a blocked chat as denied without leaking the body', async () => {
    const h = harness([])

    await h.route(buildIncomingMessageEvent({ remoteJid: PEER_PN_JID, message: textMessage('.ping rahasia') }))

    expect(h.reports).toEqual([
      { messageId: 'MSG-1', command: 'ping', chatKind: 'private', durationMs: 0, outcome: 'denied' },
    ])
    expect(JSON.stringify(h.reports)).not.toContain('rahasia')
  })
})
