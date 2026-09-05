import type { CommandContext } from '../commands/command.js'
import type { GroupGateway, GroupMetadata } from './gateway.js'
import { resolveGroupRoles } from './roles.js'

/** Pesan penolakan dipakai bersama supaya seluruh command grup konsisten. */
export const NOT_A_GROUP = 'Perintah ini hanya bisa dipakai di dalam grup.'
export const NOT_GROUP_ADMIN = 'Perintah ini hanya untuk admin grup.'
export const BOT_NOT_ADMIN = 'Bot harus jadi admin grup dulu untuk menjalankan perintah ini.'
export const GROUP_SERVICE_MISSING = 'Layanan grup belum siap.'

export type GroupGuard =
  | { readonly ok: true; readonly group: GroupGateway; readonly metadata: GroupMetadata }
  | { readonly ok: false }

/**
 * Gerbang tunggal untuk command grup: cek konteks grup, layanan tersedia, lalu
 * peran admin pengirim dan bot. Membalas sendiri saat gagal supaya plugin cukup
 * `if (!guard.ok) return`.
 *
 * `requireBotAdmin` false untuk command baca-saja (`linkgroup` melihat kode,
 * `tagall` hanya mengirim teks) — tetap admin-only, tapi bot tak perlu admin.
 */
export async function requireGroupAdmin(
  context: CommandContext,
  options: { readonly requireBotAdmin?: boolean } = {},
): Promise<GroupGuard> {
  if (!context.isGroup) {
    await context.reply(NOT_A_GROUP)
    return { ok: false }
  }

  const { group } = context
  if (group === undefined) {
    await context.reply(GROUP_SERVICE_MISSING)
    return { ok: false }
  }

  const metadata = await group.metadata(context.chatJid)
  const senderJids = [
    context.senderJid,
    context.senderAltJid,
    context.senderPnJid,
    context.senderLidJid,
  ].filter((jid): jid is string => jid !== undefined)
  const roles = resolveGroupRoles(metadata, senderJids, context.botJids)

  if (!roles.senderIsAdmin && !context.isOwner) {
    await context.reply(NOT_GROUP_ADMIN)
    return { ok: false }
  }

  if ((options.requireBotAdmin ?? true) && !roles.botIsAdmin) {
    await context.reply(BOT_NOT_ADMIN)
    return { ok: false }
  }

  return { ok: true, group, metadata }
}
