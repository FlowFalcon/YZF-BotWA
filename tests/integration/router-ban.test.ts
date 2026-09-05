import { describe, expect, it } from 'vitest'

import type { Command } from '../../lib/commands/command.js'
import { createCommandRegistry } from '../../lib/commands/registry.js'
import { createMessageRouter } from '../../lib/messages/router.js'
import type { CommandReport } from '../../lib/messages/router.js'
import type { UserStore } from '../../lib/users/store.js'
import {
  buildIncomingMessageEvent,
  GROUP_JID,
  OWNER_PN_JID,
  PEER_PN_JID,
  textMessage,
} from '../fixtures/messages.js'

const OWNER_NUMBER = OWNER_PN_JID.split('@')[0] ?? ''

const commands: readonly Command[] = [
  { name: 'ping', category: 'tools', description: 'ping', run: (ctx) => ctx.reply('pong') },
]

function harness(banned: { users?: readonly string[]; chats?: readonly string[] } = {}) {
  const sent: string[] = []
  const reports: CommandReport[] = []
  const users: UserStore = {
    isBannedUser: (jid) => (banned.users ?? []).includes(jid),
    isBannedChat: (jid) => (banned.chats ?? []).includes(jid),
    banUser: () => Promise.resolve(),
    unbanUser: () => Promise.resolve(),
    banChat: () => Promise.resolve(),
    unbanChat: () => Promise.resolve(),
    listBannedUsers: () => banned.users ?? [],
    listBannedChats: () => banned.chats ?? [],
  }
  const route = createMessageRouter({
    registry: createCommandRegistry(commands),
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
    settings: { getMode: () => 'public' },
    menuThumbnailPath: '.auth/assets/menu-thumbnail.jpg',
    users,
  })
  return { route, sent, reports }
}

function privateEvent(owner: boolean) {
  return buildIncomingMessageEvent({
    remoteJid: owner ? OWNER_PN_JID : PEER_PN_JID,
    message: textMessage('.ping'),
  })
}

function groupEvent() {
  return buildIncomingMessageEvent({
    remoteJid: GROUP_JID,
    isGroup: true,
    participant: PEER_PN_JID,
    message: textMessage('.ping'),
  })
}

describe('router ban enforcement', () => {
  it('answers a user who is not banned', async () => {
    const h = harness()

    await h.route(privateEvent(false))

    expect(h.sent).toEqual(['pong'])
  })

  it('ignores a banned user without replying', async () => {
    const h = harness({ users: [PEER_PN_JID] })

    await h.route(privateEvent(false))

    // Silent by design: a reply would tell the blocked user the bot is alive
    // and invite retries.
    expect(h.sent).toEqual([])
    expect(h.reports[0]?.outcome).toBe('denied')
  })

  it('ignores every command in a banned chat', async () => {
    const h = harness({ chats: [GROUP_JID] })

    await h.route(groupEvent())

    expect(h.sent).toEqual([])
    expect(h.reports[0]?.outcome).toBe('denied')
  })

  it('never locks the owner out of their own bot', async () => {
    const h = harness({ users: [OWNER_PN_JID], chats: [OWNER_PN_JID] })

    await h.route(privateEvent(true))

    expect(h.sent).toEqual(['pong'])
  })

  it('does not name the attempted command when denying a banned sender', async () => {
    const h = harness({ users: [PEER_PN_JID] })

    await h.route(privateEvent(false))

    expect(h.reports[0]?.command).toBeUndefined()
  })
})
