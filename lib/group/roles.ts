import type { GroupMetadata } from './gateway.js'

/**
 * Peran di dalam grup. Grup bisa ber-addressing PN maupun LID, jadi satu akun
 * dapat muncul sebagai dua JID berbeda; pencocokan dilakukan atas semua bentuk
 * yang diketahui, bukan satu string saja.
 */
export interface GroupRoles {
  readonly senderIsAdmin: boolean
  readonly botIsAdmin: boolean
}

function participantJids(metadata: GroupMetadata, jid: string): boolean {
  return metadata.participants.some(
    (participant) =>
      (participant.isAdmin || participant.isSuperAdmin) &&
      (participant.jid === jid || participant.lid === jid || participant.phoneNumber === jid),
  )
}

export function resolveGroupRoles(
  metadata: GroupMetadata,
  senderJids: readonly string[],
  botJids: readonly string[],
): GroupRoles {
  return {
    senderIsAdmin: senderJids.some((jid) => participantJids(metadata, jid)),
    botIsAdmin: botJids.some((jid) => participantJids(metadata, jid)),
  }
}

/**
 * Target aksi grup: mention, pesan yang dikutip, atau nomor mentah pada args.
 * Urutan ini menyamai kebiasaan bot WhatsApp — mention paling eksplisit, kutipan
 * paling praktis, nomor terakhir karena paling mudah salah tulis.
 */
export function resolveTargets(input: {
  readonly mentionedJids: readonly string[]
  readonly quotedParticipant?: string
  readonly args: readonly string[]
}): readonly string[] {
  if (input.mentionedJids.length > 0) return input.mentionedJids
  if (input.quotedParticipant !== undefined) return [input.quotedParticipant]

  const digits = input.args
    .map((arg) => arg.replace(/[^0-9]/g, ''))
    // Nomor internasional terpendek yang wajar; lebih pendek hampir pasti salah tulis.
    .filter((value) => value.length >= 8)
    .map((value) => `${value}@s.whatsapp.net`)
  return digits
}
