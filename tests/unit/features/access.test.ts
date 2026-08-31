import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import accessCommand, { setAccessAllowlist } from '../../../src/features/general/access.js'
import { createGroupAllowlist } from '../../../src/access/group-allowlist.js'
import type { GroupAllowlist } from '../../../src/access/group-allowlist.js'
import type { CommandContext } from '../../../src/commands/command.js'

const GROUP = '120363000000000000@g.us'
const PRIVATE = '6289876543210@s.whatsapp.net'

interface Harness {
  readonly ctx: CommandContext
  readonly replies: string[]
}

function context(options: {
  readonly args: readonly string[]
  readonly isGroup: boolean
  readonly chatJid: string
}): Harness {
  const replies: string[] = []
  const ctx = {
    chatJid: options.chatJid,
    senderJid: PRIVATE,
    isGroup: options.isGroup,
    isOwner: true,
    prefix: '.',
    commandName: 'access',
    args: options.args,
    text: options.args.join(' '),
    receivedAtMs: 0,
    now: () => 0,
    random: () => 0,
    reply: (content: unknown) => {
      replies.push(typeof content === 'string' ? content : JSON.stringify(content))
      return Promise.resolve()
    },
    replyContent: () => Promise.resolve(),
    react: () => Promise.resolve(),
  } as unknown as CommandContext

  return { ctx, replies }
}

describe('access command', () => {
  let dir: string
  let list: GroupAllowlist

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'zapo-access-'))
    list = await createGroupAllowlist(path.join(dir, 'groups.json'))
    setAccessAllowlist(list)
  })

  afterEach(async () => {
    setAccessAllowlist(undefined)
    await rm(dir, { recursive: true, force: true })
  })

  it('is owner-only', () => {
    expect(accessCommand.permission).toBe('owner')
  })

  it('adds the current group', async () => {
    const { ctx, replies } = context({ args: ['add'], isGroup: true, chatJid: GROUP })

    await accessCommand.run(ctx)

    expect(list.has(GROUP)).toBe(true)
    expect(replies[0]).toContain('diizinkan')
  })

  it('removes the current group', async () => {
    await list.add(GROUP)
    const { ctx } = context({ args: ['del'], isGroup: true, chatJid: GROUP })

    await accessCommand.run(ctx)

    expect(list.has(GROUP)).toBe(false)
  })

  it('refuses to toggle from a private chat', async () => {
    const { ctx, replies } = context({ args: ['add'], isGroup: false, chatJid: PRIVATE })

    await accessCommand.run(ctx)

    expect(list.list()).toEqual([])
    expect(replies[0]).toContain('di dalam grup')
  })

  it('lists allowed groups from anywhere', async () => {
    await list.add(GROUP)
    const { ctx, replies } = context({ args: ['list'], isGroup: false, chatJid: PRIVATE })

    await accessCommand.run(ctx)

    expect(replies[0]).toContain(GROUP)
  })

  it('shows usage for an unknown subcommand', async () => {
    const { ctx, replies } = context({ args: ['wat'], isGroup: true, chatJid: GROUP })

    await accessCommand.run(ctx)

    expect(replies[0]).toContain('.access add')
  })
})
