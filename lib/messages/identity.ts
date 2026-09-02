import { isLidJid } from 'zapo-js'
import type { WaIncomingMessageEvent } from 'zapo-js'

export interface MessageIdentity {
  /** The chat the message belongs to. */
  readonly chatJid: string
  /** Where replies must go: the group JID in groups, the peer in 1:1. */
  readonly replyJid: string
  /** The sender as addressed on the wire (may be a LID). */
  readonly senderJid: string
  /** The sender's other addressing form, when the stanza carried one. */
  readonly senderAltJid?: string
  readonly senderPnJid?: string
  readonly senderLidJid?: string
  /** Digits of the sender's phone identity; absent when only a LID is known. */
  readonly senderNumber?: string
  readonly isGroup: boolean
}

/** Digits only: strips `+`, spaces, dashes, the `@server` and any `:device` suffix. */
export function normalizeNumber(value: string): string {
  return value.replace(/[^0-9]/g, '')
}

function phoneDigits(jid: string): string {
  const [user = ''] = jid.split('@')
  const [bare = ''] = user.split(':')
  return normalizeNumber(bare)
}

export function resolveIdentity(event: WaIncomingMessageEvent): MessageIdentity {
  const { key } = event
  const isGroup = key.isGroup
  // In groups the author is `participant`; in 1:1 `remoteJid` is both chat and author.
  const senderJid = isGroup ? (key.participant ?? key.remoteJid) : key.remoteJid
  const senderAltJid = isGroup ? key.participantAlt : key.remoteJidAlt

  const senderIsLid = isLidJid(senderJid)
  const senderLidJid = senderIsLid ? senderJid : senderAltJid
  const senderPnJid = senderIsLid ? senderAltJid : senderJid
  const senderNumber = senderPnJid === undefined ? undefined : phoneDigits(senderPnJid)

  return {
    chatJid: key.remoteJid,
    // Replying to a participant JID in a group would open a private chat instead.
    replyJid: key.remoteJid,
    senderJid,
    ...(senderAltJid === undefined ? {} : { senderAltJid }),
    ...(senderPnJid === undefined ? {} : { senderPnJid }),
    ...(senderLidJid === undefined ? {} : { senderLidJid }),
    ...(senderNumber === undefined ? {} : { senderNumber }),
    isGroup,
  }
}

/** Owner check compares normalized digits; a LID-only sender can never match. */
export function isOwnerNumber(identity: MessageIdentity, ownerNumber: string): boolean {
  const owner = normalizeNumber(ownerNumber)
  if (owner === '') return false
  return identity.senderNumber === owner
}
