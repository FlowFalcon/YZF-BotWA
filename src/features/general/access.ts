import type { Command } from '../../commands/command.js'
import type { GroupAllowlist } from '../../access/group-allowlist.js'

/** Injected at composition time; the loader only reads `default`. */
let allowlist: GroupAllowlist | undefined

export function setAccessAllowlist(next: GroupAllowlist | undefined): void {
  allowlist = next
}

function usage(prefix: string): string {
  return `Gunakan: ${prefix}access add | ${prefix}access del | ${prefix}access list`
}

const command = {
  name: 'access',
  aliases: ['izin'],
  category: 'general',
  description: 'Mengatur grup yang boleh memakai bot (owner).',
  permission: 'owner',
  cooldownMs: 2_000,
  async run(ctx) {
    if (allowlist === undefined) {
      await ctx.reply('Allowlist belum siap.')
      return
    }

    const [action = ''] = ctx.args

    if (action === 'list') {
      const groups = allowlist.list()
      await ctx.reply(
        groups.length === 0
          ? 'Belum ada grup yang diizinkan.'
          : `Grup diizinkan:\n${groups.map((jid) => `• ${jid}`).join('\n')}`,
      )
      return
    }

    if (action !== 'add' && action !== 'del') {
      await ctx.reply(usage(ctx.prefix))
      return
    }

    // Only the current group can be toggled: the owner must be inside it, which
    // avoids typing raw JIDs and proves they are actually a member.
    if (!ctx.isGroup) {
      await ctx.reply('Jalankan perintah ini di dalam grup yang ingin diatur.')
      return
    }

    if (action === 'add') {
      await allowlist.add(ctx.chatJid)
      await ctx.reply('Grup ini sekarang diizinkan memakai bot.')
      return
    }

    await allowlist.remove(ctx.chatJid)
    await ctx.reply('Grup ini tidak lagi diizinkan memakai bot.')
  },
} satisfies Command

export default command
