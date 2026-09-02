import { describe, expect, it } from 'vitest'

import type { Command } from '../../lib/commands/command.js'
import { createCommandRegistry } from '../../lib/commands/registry.js'
import { createMessageRouter } from '../../lib/messages/router.js'
import type { CommandReport } from '../../lib/messages/router.js'
import type { BotMode } from '../../lib/settings.js'
import { buildIncomingMessageEvent, GROUP_JID, OWNER_PN_JID, PEER_PN_JID, textMessage } from '../fixtures/messages.js'

const OWNER_NUMBER = OWNER_PN_JID.split('@')[0] ?? ''

const commands: readonly Command[] = [
  { name: 'ping', category: 'tools', description: 'ping', run: (ctx) => ctx.reply('pong') },
  { name: 'botmode', category: 'tools', description: 'mode', permission: 'owner', run: (ctx) => ctx.reply('mode-ran') },
]

function harness(initialMode: BotMode) {
  const sent: string[] = []
  const reports: CommandReport[] = []
  let mode = initialMode
  const route = createMessageRouter({
    registry: createCommandRegistry(commands),
    prefixes: ['.'],
    sender: { message: { send: (_to, content) => { sent.push(typeof content === 'string' ? content : JSON.stringify(content)); return Promise.resolve() } } },
    clock: { now: () => 0, schedule: () => () => {} },
    random: { next: () => 0 },
    flood: { check: () => ({ allowed: true }) },
    cooldown: { check: () => ({ allowed: true }) },
    reporter: { command: (report) => reports.push(report), error: () => {} },
    ownerNumber: OWNER_NUMBER,
    settings: { getMode: () => mode },
    menuThumbnailPath: '.auth/assets/menu-thumbnail.jpg',
  })
  return { route, sent, reports, setMode: (next: BotMode) => { mode = next } }
}

function privateEvent(owner: boolean, body = '.ping') {
  return buildIncomingMessageEvent({ remoteJid: owner ? OWNER_PN_JID : PEER_PN_JID, message: textMessage(body) })
}

function groupEvent(owner: boolean, body = '.ping') {
  return buildIncomingMessageEvent({
    remoteJid: GROUP_JID,
    isGroup: true,
    participant: owner ? OWNER_PN_JID : PEER_PN_JID,
    message: textMessage(body),
  })
}

describe('router bot modes', () => {
  it('public answers non-owners in private chats and groups', async () => {
    const h = harness('public')
    await h.route(privateEvent(false))
    await h.route(groupEvent(false))
    expect(h.sent).toEqual(['pong', 'pong'])
  })

  it('group-only ignores non-owner private chat but answers groups', async () => {
    const h = harness('group-only')
    await h.route(privateEvent(false))
    await h.route(groupEvent(false))
    expect(h.sent).toEqual(['pong'])
  })

  it('group-only keeps owner private control open', async () => {
    const h = harness('group-only')
    await h.route(privateEvent(true))
    expect(h.sent).toEqual(['pong'])
  })

  it('owner-only ignores non-owners in both chat kinds and answers owner', async () => {
    const h = harness('owner-only')
    await h.route(privateEvent(false))
    await h.route(groupEvent(false))
    await h.route(privateEvent(true))
    await h.route(groupEvent(true))
    expect(h.sent).toEqual(['pong', 'pong'])
  })

  it('reads mode per message so runtime changes apply without restart', async () => {
    const h = harness('owner-only')
    await h.route(privateEvent(false))
    h.setMode('public')
    await h.route(privateEvent(false))
    expect(h.sent).toEqual(['pong'])
  })

  it('keeps owner botmode available as an emergency control path', async () => {
    const h = harness('owner-only')
    await h.route(privateEvent(true, '.botmode'))
    expect(h.sent).toEqual(['mode-ran'])
  })

  it('does not label an access-denied unknown trigger as a canonical command', async () => {
    const h = harness('owner-only')

    await h.route(privateEvent(false, '.attacker-controlled-trigger'))

    expect(h.sent).toEqual([])
    expect(h.reports).toHaveLength(1)
    expect(h.reports[0]?.command).toBeUndefined()
    expect(JSON.stringify(h.reports[0])).not.toContain('attacker-controlled-trigger')
  })
})
