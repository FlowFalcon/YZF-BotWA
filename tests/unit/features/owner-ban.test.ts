import { describe, expect, it } from 'vitest'

import type { UserStore } from '../../../lib/users/store.js'
import { fakeContext } from '../../fixtures/context.js'
import ban from '../../../plugins/owner/ban.js'
import unban from '../../../plugins/owner/unban.js'
import banchat from '../../../plugins/owner/banchat.js'
import unbanchat from '../../../plugins/owner/unbanchat.js'
import banlist from '../../../plugins/owner/banlist.js'

const TARGET = '628222333444@s.whatsapp.net'
const CHAT = '120363000000000000@g.us'

function store(initial: { users?: string[]; chats?: string[] } = {}): UserStore {
  const users = new Set(initial.users ?? [])
  const chats = new Set(initial.chats ?? [])
  return {
    isBannedUser: (jid) => users.has(jid),
    isBannedChat: (jid) => chats.has(jid),
    listBannedUsers: () => [...users].sort(),
    listBannedChats: () => [...chats].sort(),
    banUser: (jid) => { users.add(jid); return Promise.resolve() },
    unbanUser: (jid) => { users.delete(jid); return Promise.resolve() },
    banChat: (jid) => { chats.add(jid); return Promise.resolve() },
    unbanChat: (jid) => { chats.delete(jid); return Promise.resolve() },
  }
}

function harness(parts: {
  readonly users?: UserStore
  readonly mentionedJids?: readonly string[]
  readonly args?: readonly string[]
  readonly withStore?: boolean
  readonly chatJid?: string
} = {}) {
  const replies: string[] = []
  const cards: string[] = []
  const users = parts.users ?? store()
  const context = fakeContext({
    chatJid: parts.chatJid ?? CHAT,
    isOwner: true,
    isGroup: true,
    mentionedJids: parts.mentionedJids ?? [],
    args: parts.args ?? [],
    reply: (text) => { replies.push(text); return Promise.resolve() },
    Reply: (text) => { cards.push(text); return Promise.resolve() },
    ...(parts.withStore === false ? {} : { users }),
  })
  return { context, replies, cards, users }
}

describe('ban and unban', () => {
  it('bans the mentioned user', async () => {
    const h = harness({ mentionedJids: [TARGET] })

    await ban.run(h.context)

    expect(h.users.isBannedUser(TARGET)).toBe(true)
    expect(h.replies[0]).toContain('628222333444')
  })

  it('bans a bare number', async () => {
    const h = harness({ args: ['628222333444'] })

    await ban.run(h.context)

    expect(h.users.isBannedUser(TARGET)).toBe(true)
  })

  it('asks for a target when none is given', async () => {
    const h = harness()

    await ban.run(h.context)

    expect(h.users.listBannedUsers()).toEqual([])
    expect(h.replies[0]).toContain('Tandai')
  })

  it('refuses to ban the owner', async () => {
    const owner = '628111@s.whatsapp.net'
    const h = harness({ mentionedJids: [owner] })
    const context = { ...h.context, senderJid: owner }

    await ban.run(context)

    expect(h.users.isBannedUser(owner)).toBe(false)
    expect(h.replies[0]).toContain('owner')
  })

  it('unban removes an existing entry', async () => {
    const h = harness({ users: store({ users: [TARGET] }), mentionedJids: [TARGET] })

    await unban.run(h.context)

    expect(h.users.isBannedUser(TARGET)).toBe(false)
  })

  it('unban reports when the user was not banned', async () => {
    const h = harness({ mentionedJids: [TARGET] })

    await unban.run(h.context)

    expect(h.replies[0]).toContain('tidak ada')
  })
})

describe('banchat and unbanchat', () => {
  it('banchat blocks the current chat', async () => {
    const h = harness()

    await banchat.run(h.context)

    expect(h.users.isBannedChat(CHAT)).toBe(true)
  })

  it('unbanchat clears the current chat', async () => {
    const h = harness({ users: store({ chats: [CHAT] }) })

    await unbanchat.run(h.context)

    expect(h.users.isBannedChat(CHAT)).toBe(false)
  })
})

describe('banlist', () => {
  it('lists both sets', async () => {
    const h = harness({ users: store({ users: [TARGET], chats: [CHAT] }) })

    await banlist.run(h.context)

    const text = h.cards[0] ?? ''
    expect(text).toContain('628222333444')
    expect(text).toContain(CHAT)
  })

  it('says so when nothing is banned', async () => {
    const h = harness()

    await banlist.run(h.context)

    expect(h.cards[0] ?? '').toContain('kosong')
  })
})

describe('without a user store', () => {
  it('reports the runtime is not ready', async () => {
    const h = harness({ withStore: false, mentionedJids: [TARGET] })

    await ban.run(h.context)

    expect(h.replies).toEqual(['Penyimpanan user belum siap.'])
  })
})
