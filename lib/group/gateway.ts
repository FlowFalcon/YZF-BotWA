import type { WaGroupCoordinator } from 'zapo-js'

/**
 * Operasi grup yang dipakai command, dipersempit dari `WaGroupCoordinator`.
 *
 * Tipe sendiri, bukan re-export: plugin hanya butuh sebagian kecil field, dan
 * test harness bisa membangun metadata tanpa mengisi seluruh field server.
 */

/** Subset participant yang dibaca bot; server mengirim lebih banyak field. */
export interface GroupParticipant {
  readonly jid: string
  readonly isAdmin: boolean
  readonly isSuperAdmin: boolean
  /** Bentuk PN saat grup ber-addressing LID. */
  readonly phoneNumber?: string
  readonly lid?: string
}

export interface GroupMetadata {
  readonly jid: string
  readonly subject: string
  readonly desc?: string
  readonly owner?: string
  /** `true` bila hanya admin yang boleh mengirim pesan. */
  readonly announce: boolean
  /** `true` bila hanya admin yang boleh mengubah info grup. */
  readonly restrict: boolean
  readonly participants: readonly GroupParticipant[]
}

/** Hasil per-JID; server bisa menolak sebagian target dalam satu permintaan. */
export interface ParticipantResult {
  readonly jid: string
  readonly status: 'ok' | 'error'
  /** Kode gaya HTTP dari server (`200`, `403`, `409`, ...). */
  readonly code: number
}

export interface GroupGateway {
  metadata(groupJid: string): Promise<GroupMetadata>
  add(groupJid: string, jids: readonly string[]): Promise<readonly ParticipantResult[]>
  remove(groupJid: string, jids: readonly string[]): Promise<readonly ParticipantResult[]>
  promote(groupJid: string, jids: readonly string[]): Promise<readonly ParticipantResult[]>
  demote(groupJid: string, jids: readonly string[]): Promise<readonly ParticipantResult[]>
  /** Setting `announcement`: hanya admin yang boleh mengirim pesan. */
  setAnnounce(groupJid: string, enabled: boolean): Promise<void>
  setSubject(groupJid: string, subject: string): Promise<void>
  setDescription(groupJid: string, description: string): Promise<void>
  inviteCode(groupJid: string): Promise<string>
  /** Mengganti kode undangan; mengembalikan kode baru. */
  revokeInvite(groupJid: string): Promise<string>
}

/** Bagian coordinator yang benar-benar dipakai; sisanya tidak perlu di-stub. */
export type GroupCoordinatorSubset = Pick<
  WaGroupCoordinator,
  | 'queryGroupMetadata'
  | 'addParticipants'
  | 'removeParticipants'
  | 'promoteParticipants'
  | 'demoteParticipants'
  | 'setSetting'
  | 'setSubject'
  | 'setDescription'
  | 'queryInviteCode'
  | 'revokeInvite'
>

export function createGroupGateway(group: GroupCoordinatorSubset): GroupGateway {
  return {
    metadata: (groupJid) => group.queryGroupMetadata(groupJid),
    add: (groupJid, jids) => group.addParticipants(groupJid, jids),
    remove: (groupJid, jids) => group.removeParticipants(groupJid, jids),
    promote: (groupJid, jids) => group.promoteParticipants(groupJid, jids),
    demote: (groupJid, jids) => group.demoteParticipants(groupJid, jids),
    setAnnounce: (groupJid, enabled) => group.setSetting(groupJid, 'announcement', enabled),
    setSubject: (groupJid, subject) => group.setSubject(groupJid, subject),
    setDescription: (groupJid, description) => group.setDescription(groupJid, description),
    inviteCode: (groupJid) => group.queryInviteCode(groupJid),
    revokeInvite: async (groupJid) => (await group.revokeInvite(groupJid)).code,
  }
}
