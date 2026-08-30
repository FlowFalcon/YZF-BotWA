import type { Proto, WaIncomingMessageEvent, WaIncomingMessageKey } from 'zapo-js'

/** Minimal stanza stand-in: the parser never reads `rawNode`, but the type requires it. */
const RAW_NODE = { tag: 'message', attrs: {} } as const

export interface IncomingMessageEventOptions {
  readonly remoteJid: string
  readonly remoteJidAlt?: string
  readonly participant?: string
  readonly participantAlt?: string
  readonly isGroup?: boolean
  readonly fromMe?: boolean
  readonly message?: Proto.IMessage
  readonly pushName?: string
}

export function buildIncomingMessageEvent(
  options: IncomingMessageEventOptions,
): WaIncomingMessageEvent {
  const key: WaIncomingMessageKey = {
    remoteJid: options.remoteJid,
    id: 'MSG-1',
    fromMe: options.fromMe ?? false,
    isGroup: options.isGroup ?? false,
    isBroadcast: false,
    isNewsletter: false,
    senderDevice: 0,
    ...(options.participant === undefined ? {} : { participant: options.participant }),
    ...(options.participantAlt === undefined ? {} : { participantAlt: options.participantAlt }),
    ...(options.remoteJidAlt === undefined ? {} : { remoteJidAlt: options.remoteJidAlt }),
  }

  return {
    rawNode: RAW_NODE,
    key,
    ...(options.message === undefined ? {} : { message: options.message }),
    ...(options.pushName === undefined ? {} : { pushName: options.pushName }),
  }
}

export const OWNER_PN_JID = '6281234567890@s.whatsapp.net'
export const OWNER_LID_JID = '111222333444555@lid'
export const PEER_PN_JID = '6289876543210@s.whatsapp.net'
export const PEER_LID_JID = '999888777666555@lid'
export const GROUP_JID = '120363000000000000@g.us'

export function textMessage(text: string): Proto.IMessage {
  return { conversation: text }
}

export function extendedTextMessage(text: string): Proto.IMessage {
  return { extendedTextMessage: { text } }
}

export function imageCaptionMessage(caption: string): Proto.IMessage {
  return { imageMessage: { caption } }
}

export function videoCaptionMessage(caption: string): Proto.IMessage {
  return { videoMessage: { caption } }
}

/** 1:1 chat addressed by phone number; the LID form arrives as `remoteJidAlt`. */
export function privatePnEvent(message?: Proto.IMessage): WaIncomingMessageEvent {
  return buildIncomingMessageEvent({
    remoteJid: PEER_PN_JID,
    remoteJidAlt: PEER_LID_JID,
    ...(message === undefined ? {} : { message }),
  })
}

/** 1:1 chat addressed by LID; the phone form arrives as `remoteJidAlt`. */
export function privateLidEvent(message?: Proto.IMessage): WaIncomingMessageEvent {
  return buildIncomingMessageEvent({
    remoteJid: PEER_LID_JID,
    remoteJidAlt: PEER_PN_JID,
    ...(message === undefined ? {} : { message }),
  })
}

export function privatePnNoAltEvent(message?: Proto.IMessage): WaIncomingMessageEvent {
  return buildIncomingMessageEvent({
    remoteJid: PEER_PN_JID,
    ...(message === undefined ? {} : { message }),
  })
}

export function privateLidNoAltEvent(message?: Proto.IMessage): WaIncomingMessageEvent {
  return buildIncomingMessageEvent({
    remoteJid: PEER_LID_JID,
    ...(message === undefined ? {} : { message }),
  })
}

/** Group message whose author is addressed by phone number. */
export function groupPnParticipantEvent(message?: Proto.IMessage): WaIncomingMessageEvent {
  return buildIncomingMessageEvent({
    remoteJid: GROUP_JID,
    isGroup: true,
    participant: PEER_PN_JID,
    participantAlt: PEER_LID_JID,
    ...(message === undefined ? {} : { message }),
  })
}

/** Group message whose author is addressed by LID. */
export function groupLidParticipantEvent(message?: Proto.IMessage): WaIncomingMessageEvent {
  return buildIncomingMessageEvent({
    remoteJid: GROUP_JID,
    isGroup: true,
    participant: PEER_LID_JID,
    participantAlt: PEER_PN_JID,
    ...(message === undefined ? {} : { message }),
  })
}

export function groupLidParticipantNoAltEvent(message?: Proto.IMessage): WaIncomingMessageEvent {
  return buildIncomingMessageEvent({
    remoteJid: GROUP_JID,
    isGroup: true,
    participant: PEER_LID_JID,
    ...(message === undefined ? {} : { message }),
  })
}
