import type { CommandContext } from '../../lib/commands/command.js'

/**
 * Satu tempat pembangun `CommandContext` untuk test unit command. Kontrak ini
 * tumbuh; tanpa fixture bersama setiap penambahan field memaksa edit di semua
 * test feature.
 */
export function fakeContext(overrides: Partial<CommandContext> = {}): CommandContext {
  const base: CommandContext = {
    chatJid: 'chat@s.whatsapp.net',
    senderJid: 'sender@s.whatsapp.net',
    isGroup: false,
    isOwner: false,
    prefix: '.',
    commandName: 'ping',
    args: [],
    text: '',
    receivedAtMs: 0,
    messageId: 'MSG-1',
    mentionedJids: [],
    botJids: [],
    settings: { getMode: () => 'owner-only' },
    commands: { list: () => [] },
    menuThumbnailPath: '.auth/assets/menu-thumbnail.jpg',
    now: () => 0,
    random: () => 0,
    reply: () => Promise.resolve(),
    Reply: () => Promise.resolve(),
    replyContent: () => Promise.resolve(),
    replyMedia: () => Promise.resolve(),
    replyImage: () => Promise.resolve(),
    replyAIRich: () => Promise.resolve(),
    react: () => Promise.resolve(),
    revoke: () => Promise.resolve(),
  }
  return { ...base, ...overrides }
}
