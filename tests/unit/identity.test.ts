import { describe, expect, it } from 'vitest'

import { isOwnerNumber, resolveIdentity } from '../../lib/messages/identity.js'
import {
  GROUP_JID,
  PEER_LID_JID,
  PEER_PN_JID,
  groupLidParticipantEvent,
  groupLidParticipantNoAltEvent,
  groupPnParticipantEvent,
  privateLidEvent,
  privatePnEvent,
  privatePnNoAltEvent,
} from '../fixtures/messages.js'

describe('resolveIdentity', () => {
  it('resolves a private chat addressed by phone number', () => {
    const identity = resolveIdentity(privatePnEvent())
    expect(identity).toEqual({
      chatJid: PEER_PN_JID,
      replyJid: PEER_PN_JID,
      senderJid: PEER_PN_JID,
      senderAltJid: PEER_LID_JID,
      senderPnJid: PEER_PN_JID,
      senderLidJid: PEER_LID_JID,
      senderNumber: '6289876543210',
      isGroup: false,
    })
  })

  it('resolves a private chat addressed by LID', () => {
    const identity = resolveIdentity(privateLidEvent())
    expect(identity).toEqual({
      chatJid: PEER_LID_JID,
      replyJid: PEER_LID_JID,
      senderJid: PEER_LID_JID,
      senderAltJid: PEER_PN_JID,
      senderPnJid: PEER_PN_JID,
      senderLidJid: PEER_LID_JID,
      senderNumber: '6289876543210',
      isGroup: false,
    })
  })

  it('resolves a group message from a phone-addressed participant', () => {
    const identity = resolveIdentity(groupPnParticipantEvent())
    expect(identity).toEqual({
      chatJid: GROUP_JID,
      replyJid: GROUP_JID,
      senderJid: PEER_PN_JID,
      senderAltJid: PEER_LID_JID,
      senderPnJid: PEER_PN_JID,
      senderLidJid: PEER_LID_JID,
      senderNumber: '6289876543210',
      isGroup: true,
    })
  })

  it('resolves a group message from a LID-addressed participant', () => {
    const identity = resolveIdentity(groupLidParticipantEvent())
    expect(identity.senderJid).toBe(PEER_LID_JID)
    expect(identity.senderLidJid).toBe(PEER_LID_JID)
    expect(identity.senderPnJid).toBe(PEER_PN_JID)
    expect(identity.replyJid).toBe(GROUP_JID)
  })

  it('omits alternate and PN fields when the alternate addressing is missing', () => {
    const identity = resolveIdentity(groupLidParticipantNoAltEvent())
    expect(identity).toEqual({
      chatJid: GROUP_JID,
      replyJid: GROUP_JID,
      senderJid: PEER_LID_JID,
      senderLidJid: PEER_LID_JID,
      isGroup: true,
    })
    expect('senderAltJid' in identity).toBe(false)
    expect('senderPnJid' in identity).toBe(false)
    expect('senderNumber' in identity).toBe(false)
  })

  it('omits the LID field when only a phone identity is known', () => {
    const identity = resolveIdentity(privatePnNoAltEvent())
    expect(identity.senderPnJid).toBe(PEER_PN_JID)
    expect('senderLidJid' in identity).toBe(false)
    expect('senderAltJid' in identity).toBe(false)
  })

  it('keeps the group JID as reply target, never the participant', () => {
    for (const event of [groupPnParticipantEvent(), groupLidParticipantEvent()]) {
      const identity = resolveIdentity(event)
      expect(identity.replyJid).toBe(GROUP_JID)
      expect(identity.replyJid).not.toBe(identity.senderJid)
    }
  })
})

describe('isOwnerNumber', () => {
  it('matches on normalized digits regardless of formatting', () => {
    expect(isOwnerNumber(resolveIdentity(privatePnEvent()), '+62 898-7654-3210')).toBe(true)
  })

  it('rejects a different number', () => {
    expect(isOwnerNumber(resolveIdentity(privatePnEvent()), '6281234567890')).toBe(false)
  })

  it('rejects when the sender has no resolvable phone identity', () => {
    expect(isOwnerNumber(resolveIdentity(groupLidParticipantNoAltEvent()), '6289876543210')).toBe(
      false,
    )
  })

  it('rejects an empty owner configuration', () => {
    expect(isOwnerNumber(resolveIdentity(privatePnEvent()), '')).toBe(false)
  })
})
