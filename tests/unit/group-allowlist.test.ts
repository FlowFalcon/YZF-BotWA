import { describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { createGroupAllowlist } from '../../src/access/group-allowlist.js'

const GROUP = '120363000000000000@g.us'
const OTHER = '120363999999999999@g.us'

async function tmpFile(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'zapo-allow-'))
  return path.join(dir, 'groups.json')
}

describe('createGroupAllowlist', () => {
  it('starts empty when the file does not exist', async () => {
    const file = await tmpFile()
    const list = await createGroupAllowlist(file)

    expect(list.has(GROUP)).toBe(false)
    expect(list.list()).toEqual([])

    await rm(path.dirname(file), { recursive: true, force: true })
  })

  it('adds a group and reports it as allowed', async () => {
    const file = await tmpFile()
    const list = await createGroupAllowlist(file)

    await list.add(GROUP)

    expect(list.has(GROUP)).toBe(true)
    expect(list.has(OTHER)).toBe(false)

    await rm(path.dirname(file), { recursive: true, force: true })
  })

  it('persists across reloads', async () => {
    const file = await tmpFile()
    const first = await createGroupAllowlist(file)
    await first.add(GROUP)

    const second = await createGroupAllowlist(file)

    expect(second.has(GROUP)).toBe(true)

    await rm(path.dirname(file), { recursive: true, force: true })
  })

  it('removes a group', async () => {
    const file = await tmpFile()
    const list = await createGroupAllowlist(file)
    await list.add(GROUP)

    await list.remove(GROUP)

    expect(list.has(GROUP)).toBe(false)
    expect((await createGroupAllowlist(file)).has(GROUP)).toBe(false)

    await rm(path.dirname(file), { recursive: true, force: true })
  })

  it('is idempotent on repeated adds', async () => {
    const file = await tmpFile()
    const list = await createGroupAllowlist(file)

    await list.add(GROUP)
    await list.add(GROUP)

    expect(list.list()).toEqual([GROUP])

    await rm(path.dirname(file), { recursive: true, force: true })
  })

  it('rejects a jid that is not a group', async () => {
    const file = await tmpFile()
    const list = await createGroupAllowlist(file)

    await expect(list.add('6289876543210@s.whatsapp.net')).rejects.toThrow(/grup/i)

    await rm(path.dirname(file), { recursive: true, force: true })
  })

  it('ignores a corrupt file instead of crashing the bot', async () => {
    const file = await tmpFile()
    const { writeFile, mkdir } = await import('node:fs/promises')
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, '{ not json', 'utf8')

    const list = await createGroupAllowlist(file)

    expect(list.list()).toEqual([])

    await rm(path.dirname(file), { recursive: true, force: true })
  })
})
