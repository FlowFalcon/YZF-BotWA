import { describe, expect, it } from 'vitest'

import type { GroupGateway, GroupMetadata, ParticipantResult } from '../../../lib/group/gateway.js'
import { fakeContext } from '../../fixtures/context.js'
import kick from '../../../plugins/group/kick.js'
import add from '../../../plugins/group/add.js'
import promote from '../../../plugins/group/promote.js'
import demote from '../../../plugins/group/demote.js'
import group from '../../../plugins/group/group.js'
import linkgroup from '../../../plugins/group/linkgroup.js'
import hidetag from '../../../plugins/group/hidetag.js'
import tagall from '../../../plugins/group/tagall.js'

const GROUP = '120363000000000000@g.us'
const SENDER = '628111@s.whatsapp.net'
const BOT = '628999@s.whatsapp.net'
const TARGET = '628222@s.whatsapp.net'

function metadata(overrides: Partial<GroupMetadata> = {}): GroupMetadata {
  return {
    jid: GROUP,
    subject: 'Test Group',
    announce: false,
    restrict: false,
    participants: [
      { jid: SENDER, isAdmin: true, isSuperAdmin: false },
      { jid: BOT, isAdmin: true, isSuperAdmin: false },
      { jid: TARGET, isAdmin: false, isSuperAdmin: false },
    ],
    ...overrides,
  }
}

interface Calls {
  readonly add: string[][]
  readonly remove: string[][]
  readonly promote: string[][]
  readonly demote: string[][]
  readonly announce: boolean[]
  readonly subject: string[]
  readonly description: string[]
  revoked: number
}

function gateway(meta: GroupMetadata, results: readonly ParticipantResult[] = []): {
  group: GroupGateway
  calls: Calls
} {
  const calls: Calls = {
    add: [],
    remove: [],
    promote: [],
    demote: [],
    announce: [],
    subject: [],
    description: [],
    revoked: 0,
  }
  const group: GroupGateway = {
    metadata: () => Promise.resolve(meta),
    add: (_jid, jids) => {
      calls.add.push([...jids])
      return Promise.resolve(results)
    },
    remove: (_jid, jids) => {
      calls.remove.push([...jids])
      return Promise.resolve(results)
    },
    promote: (_jid, jids) => {
      calls.promote.push([...jids])
      return Promise.resolve(results)
    },
    demote: (_jid, jids) => {
      calls.demote.push([...jids])
      return Promise.resolve(results)
    },
    setAnnounce: (_jid, enabled) => {
      calls.announce.push(enabled)
      return Promise.resolve()
    },
    setSubject: (_jid, subject) => {
      calls.subject.push(subject)
      return Promise.resolve()
    },
    setDescription: (_jid, description) => {
      calls.description.push(description)
      return Promise.resolve()
    },
    inviteCode: () => Promise.resolve('OLDCODE'),
    revokeInvite: () => {
      calls.revoked += 1
      return Promise.resolve('NEWCODE')
    },
  }
  return { group, calls }
}

function harness(parts: {
  readonly meta?: GroupMetadata
  readonly results?: readonly ParticipantResult[]
  readonly isGroup?: boolean
  readonly mentionedJids?: readonly string[]
  readonly args?: readonly string[]
  readonly text?: string
  readonly withGateway?: boolean
} = {}) {
  const replies: string[] = []
  const mentions: (readonly string[] | undefined)[] = []
  const { group: gw, calls } = gateway(parts.meta ?? metadata(), parts.results)
  const context = fakeContext({
    chatJid: GROUP,
    senderJid: SENDER,
    isGroup: parts.isGroup ?? true,
    botJids: [BOT],
    mentionedJids: parts.mentionedJids ?? [],
    args: parts.args ?? [],
    text: parts.text ?? (parts.args ?? []).join(' '),
    reply: (content, options) => {
      replies.push(content)
      mentions.push(options?.mentions)
      return Promise.resolve()
    },
    Reply: (content) => {
      replies.push(content)
      return Promise.resolve()
    },
    ...(parts.withGateway === false ? {} : { group: gw }),
  })
  return { context, replies, mentions, calls }
}

describe('group command guards', () => {
  it('refuses outside a group', async () => {
    const h = harness({ isGroup: false })

    await kick.run(h.context)

    expect(h.replies).toEqual(['Perintah ini hanya bisa dipakai di dalam grup.'])
    expect(h.calls.remove).toEqual([])
  })

  it('refuses when the sender is not a group admin', async () => {
    const meta = metadata({
      participants: [
        { jid: SENDER, isAdmin: false, isSuperAdmin: false },
        { jid: BOT, isAdmin: true, isSuperAdmin: false },
      ],
    })
    const h = harness({ meta, mentionedJids: [TARGET] })

    await kick.run(h.context)

    expect(h.replies).toEqual(['Perintah ini hanya untuk admin grup.'])
    expect(h.calls.remove).toEqual([])
  })

  it('refuses when the bot itself is not admin', async () => {
    const meta = metadata({
      participants: [
        { jid: SENDER, isAdmin: true, isSuperAdmin: false },
        { jid: BOT, isAdmin: false, isSuperAdmin: false },
      ],
    })
    const h = harness({ meta, mentionedJids: [TARGET] })

    await kick.run(h.context)

    expect(h.replies).toEqual(['Bot harus jadi admin grup dulu untuk menjalankan perintah ini.'])
    expect(h.calls.remove).toEqual([])
  })

  it('matches admin status through the LID form of the same account', async () => {
    const meta = metadata({
      participants: [
        { jid: '111@lid', isAdmin: true, isSuperAdmin: false, phoneNumber: SENDER },
        { jid: '999@lid', isAdmin: true, isSuperAdmin: false, phoneNumber: BOT },
      ],
    })
    const h = harness({ meta, mentionedJids: [TARGET] })

    await kick.run(h.context)

    expect(h.calls.remove).toEqual([[TARGET]])
  })
})

describe('kick', () => {
  it('removes the mentioned participant', async () => {
    const h = harness({
      mentionedJids: [TARGET],
      results: [{ jid: TARGET, status: 'ok', code: 200 }],
    })

    await kick.run(h.context)

    expect(h.calls.remove).toEqual([[TARGET]])
    expect(h.replies[0]).toContain('1 berhasil')
  })

  it('resolves a bare number when nobody is mentioned', async () => {
    const h = harness({ args: ['628222333444'] })

    await kick.run(h.context)

    expect(h.calls.remove).toEqual([['628222333444@s.whatsapp.net']])
  })

  it('ignores an argument too short to be a phone number', async () => {
    const h = harness({ args: ['12'] })

    await kick.run(h.context)

    expect(h.calls.remove).toEqual([])
    expect(h.replies[0]).toContain('Tandai atau balas')
  })

  it('reports per-target failures instead of claiming success', async () => {
    const h = harness({
      mentionedJids: [TARGET],
      results: [{ jid: TARGET, status: 'error', code: 403 }],
    })

    await kick.run(h.context)

    expect(h.replies[0]).toContain('gagal')
    expect(h.replies[0]).toContain('403')
  })

  it('asks for a target when none is given', async () => {
    const h = harness()

    await kick.run(h.context)

    expect(h.replies[0]).toContain('Tandai atau balas')
    expect(h.calls.remove).toEqual([])
  })

  it('refuses to remove the bot itself', async () => {
    const h = harness({ mentionedJids: [BOT] })

    await kick.run(h.context)

    expect(h.calls.remove).toEqual([])
    expect(h.replies[0]).toContain('bot sendiri')
  })
})

describe('add, promote, demote', () => {
  it('add invites the resolved number', async () => {
    const h = harness({
      args: ['628333444555'],
      results: [{ jid: '628333444555@s.whatsapp.net', status: 'ok', code: 200 }],
    })

    await add.run(h.context)

    expect(h.calls.add).toEqual([['628333444555@s.whatsapp.net']])
  })

  it('add explains code 403 as a privacy setting rather than a bot failure', async () => {
    const h = harness({
      args: ['628333444555'],
      results: [{ jid: '628333444555@s.whatsapp.net', status: 'error', code: 403 }],
    })

    await add.run(h.context)

    expect(h.replies[0]).toContain('403')
    expect(h.replies[0]).toContain('privasi')
  })

  it('promote raises the mentioned participant', async () => {
    const h = harness({ mentionedJids: [TARGET], results: [{ jid: TARGET, status: 'ok', code: 200 }] })

    await promote.run(h.context)

    expect(h.calls.promote).toEqual([[TARGET]])
  })

  it('demote lowers the mentioned participant', async () => {
    const h = harness({ mentionedJids: [TARGET], results: [{ jid: TARGET, status: 'ok', code: 200 }] })

    await demote.run(h.context)

    expect(h.calls.demote).toEqual([[TARGET]])
  })
})

describe('group open/close', () => {
  it('close turns announce on', async () => {
    const h = harness({ args: ['close'] })

    await group.run(h.context)

    expect(h.calls.announce).toEqual([true])
  })

  it('open turns announce off', async () => {
    const h = harness({ args: ['open'] })

    await group.run(h.context)

    expect(h.calls.announce).toEqual([false])
  })

  it('shows usage for an unknown argument', async () => {
    const h = harness({ args: ['maybe'] })

    await group.run(h.context)

    expect(h.calls.announce).toEqual([])
    expect(h.replies[0]).toContain('open')
    expect(h.replies[0]).toContain('close')
  })
})

describe('linkgroup', () => {
  it('shows the invite link', async () => {
    const h = harness()

    await linkgroup.run(h.context)

    expect(h.replies[0]).toContain('https://chat.whatsapp.com/OLDCODE')
    expect(h.calls.revoked).toBe(0)
  })

  it('rotates the link only when explicitly asked', async () => {
    const h = harness({ args: ['reset'] })

    await linkgroup.run(h.context)

    expect(h.calls.revoked).toBe(1)
    expect(h.replies[0]).toContain('NEWCODE')
  })
})

describe('hidetag and tagall', () => {
  it('hidetag mentions everyone without printing the numbers', async () => {
    const h = harness({ args: ['kumpul'], text: 'kumpul' })

    await hidetag.run(h.context)

    expect(h.replies).toEqual(['kumpul'])
    expect(h.mentions[0]).toEqual([SENDER, BOT, TARGET])
  })

  it('hidetag works without a message body', async () => {
    const h = harness()

    await hidetag.run(h.context)

    expect(h.mentions[0]).toEqual([SENDER, BOT, TARGET])
  })

  it('tagall lists every participant and mentions them', async () => {
    const h = harness({ args: ['rapat'], text: 'rapat' })

    await tagall.run(h.context)

    const [reply] = h.replies
    expect(reply).toContain('rapat')
    expect(reply).toContain('@628222')
    expect(h.mentions[0]).toEqual([SENDER, BOT, TARGET])
  })
})

describe('group commands without a gateway', () => {
  it('reports the runtime is not ready instead of throwing', async () => {
    const h = harness({ withGateway: false, mentionedJids: [TARGET] })

    await kick.run(h.context)

    expect(h.replies).toEqual(['Layanan grup belum siap.'])
  })
})
