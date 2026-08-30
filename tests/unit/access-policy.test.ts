import { describe, expect, it } from 'vitest'

import { ALLOWLIST_COMMAND, evaluateAccess } from '../../src/access/access-policy.js'

const GROUP = '120363000000000000@g.us'
const OTHER_GROUP = '120363999999999999@g.us'
const PEER = '6289876543210@s.whatsapp.net'

function allowlist(jids: readonly string[]): { has(jid: string): boolean } {
  return { has: (jid) => jids.includes(jid) }
}

describe('evaluateAccess', () => {
  it('allows the owner in a private chat', () => {
    const decision = evaluateAccess({
      chatJid: PEER,
      isGroup: false,
      isOwner: true,
      commandName: 'ping',
      allowlist: allowlist([]),
    })

    expect(decision.allowed).toBe(true)
  })

  it('denies a non-owner in a private chat', () => {
    const decision = evaluateAccess({
      chatJid: PEER,
      isGroup: false,
      isOwner: false,
      commandName: 'ping',
      allowlist: allowlist([]),
    })

    expect(decision).toEqual({ allowed: false, reason: 'private_not_owner' })
  })

  it('allows a non-owner in an allowlisted group', () => {
    const decision = evaluateAccess({
      chatJid: GROUP,
      isGroup: true,
      isOwner: false,
      commandName: 'ping',
      allowlist: allowlist([GROUP]),
    })

    expect(decision.allowed).toBe(true)
  })

  it('denies a non-owner in a group that is not allowlisted', () => {
    const decision = evaluateAccess({
      chatJid: OTHER_GROUP,
      isGroup: true,
      isOwner: false,
      commandName: 'ping',
      allowlist: allowlist([GROUP]),
    })

    expect(decision).toEqual({ allowed: false, reason: 'group_not_allowlisted' })
  })

  // The whole point of private mode: a community group must see nothing, not
  // even when the owner types in it.
  it('denies the owner in a group that is not allowlisted', () => {
    const decision = evaluateAccess({
      chatJid: OTHER_GROUP,
      isGroup: true,
      isOwner: true,
      commandName: 'ping',
      allowlist: allowlist([]),
    })

    expect(decision).toEqual({ allowed: false, reason: 'group_not_allowlisted' })
  })

  // Otherwise the owner could never enable a group from inside it: the group JID
  // is not visible from a private chat.
  it('allows the owner to run the allowlist command in a group that is not allowlisted', () => {
    const decision = evaluateAccess({
      chatJid: OTHER_GROUP,
      isGroup: true,
      isOwner: true,
      commandName: ALLOWLIST_COMMAND,
      allowlist: allowlist([]),
    })

    expect(decision.allowed).toBe(true)
  })

  it('denies a non-owner running the allowlist command in a group that is not allowlisted', () => {
    const decision = evaluateAccess({
      chatJid: OTHER_GROUP,
      isGroup: true,
      isOwner: false,
      commandName: ALLOWLIST_COMMAND,
      allowlist: allowlist([]),
    })

    expect(decision).toEqual({ allowed: false, reason: 'group_not_allowlisted' })
  })

  it('never lets an allowlisted jid grant access to a private chat', () => {
    const decision = evaluateAccess({
      chatJid: PEER,
      isGroup: false,
      isOwner: false,
      commandName: 'ping',
      allowlist: allowlist([PEER]),
    })

    expect(decision.allowed).toBe(false)
  })
})
