import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { GroupAllowlistView } from './access-policy.js'

export interface GroupAllowlist extends GroupAllowlistView {
  list(): readonly string[]
  add(chatJid: string): Promise<void>
  remove(chatJid: string): Promise<void>
}

const GROUP_SUFFIX = '@g.us'

async function readEntries(file: string): Promise<string[]> {
  let raw: string
  try {
    raw = await readFile(file, 'utf8')
  } catch {
    // Missing file is the normal first-run state, not an error.
    return []
  }

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((value): value is string => typeof value === 'string')
  } catch {
    // A corrupt file must not stop the bot from booting; it degrades to "no
    // group allowed", which is the safe direction for a private-mode bot.
    return []
  }
}

/**
 * Group allowlist persisted as a JSON array of group JIDs.
 *
 * ponytail: plain file + in-memory Set, single writer. Fine for one bot process;
 * move to the SQLite store if several processes ever share one allowlist.
 */
export async function createGroupAllowlist(file: string): Promise<GroupAllowlist> {
  const entries = new Set(await readEntries(file))

  const persist = async (): Promise<void> => {
    await mkdir(path.dirname(file), { recursive: true })
    // Write-then-rename so a crash mid-write cannot truncate the allowlist.
    const temp = `${file}.tmp`
    await writeFile(temp, JSON.stringify([...entries], null, 2), 'utf8')
    await rename(temp, file)
  }

  return {
    has: (chatJid) => entries.has(chatJid),
    list: () => [...entries],

    async add(chatJid) {
      if (!chatJid.endsWith(GROUP_SUFFIX)) {
        throw new Error(`"${chatJid}" bukan JID grup.`)
      }
      if (entries.has(chatJid)) return
      entries.add(chatJid)
      await persist()
    },

    async remove(chatJid) {
      if (!entries.delete(chatJid)) return
      await persist()
    },
  }
}
