import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * Daftar blokir yang dipakai router dan owner menu. Satu file JSON, ditulis
 * atomik seperti `settings.ts` — tidak perlu tabel sendiri untuk dua himpunan
 * JID, dan owner harus bisa membacanya dengan mata.
 *
 * State kecil disimpan di memori dan ditulis atomik ke JSON.
 */

export interface UserStoreView {
  isBannedUser(jid: string): boolean
  isBannedChat(jid: string): boolean
}

export interface UserStore extends UserStoreView {
  banUser(jid: string): Promise<void>
  unbanUser(jid: string): Promise<void>
  banChat(jid: string): Promise<void>
  unbanChat(jid: string): Promise<void>
  listBannedUsers(): readonly string[]
  listBannedChats(): readonly string[]
}

interface UserState {
  readonly users: string[]
  readonly chats: string[]
}

function readList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === 'string')
}

async function readState(file: string): Promise<UserState> {
  try {
    const parsed: unknown = JSON.parse(await readFile(file, 'utf8'))
    if (typeof parsed === 'object' && parsed !== null) {
      const record = parsed as { readonly users?: unknown; readonly chats?: unknown }
      return { users: readList(record.users), chats: readList(record.chats) }
    }
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined
    if (!(error instanceof SyntaxError) && code !== 'ENOENT') throw error
  }
  return { users: [], chats: [] }
}

export async function createUserStore(file: string): Promise<UserStore> {
  const state = await readState(file)
  const users = new Set(state.users)
  const chats = new Set(state.chats)
  let writes = Promise.resolve()

  const persist = (): Promise<void> => {
    const snapshot = { users: [...users].sort(), chats: [...chats].sort() }
    const write = async (): Promise<void> => {
      await mkdir(path.dirname(file), { recursive: true, mode: 0o700 })
      const temporary = `${file}.${String(process.pid)}-${randomUUID()}.tmp`
      try {
        await writeFile(temporary, `${JSON.stringify(snapshot, null, 2)}\n`, {
          encoding: 'utf8',
          mode: 0o600,
        })
        await rename(temporary, file)
      } catch (error) {
        await rm(temporary, { force: true })
        throw error
      }
    }
    writes = writes.then(write, write)
    return writes
  }

  return {
    isBannedUser: (jid) => users.has(jid),
    isBannedChat: (jid) => chats.has(jid),
    listBannedUsers: () => [...users].sort(),
    listBannedChats: () => [...chats].sort(),
    banUser(jid) {
      users.add(jid)
      return persist()
    },
    unbanUser(jid) {
      users.delete(jid)
      return persist()
    },
    banChat(jid) {
      chats.add(jid)
      return persist()
    },
    unbanChat(jid) {
      chats.delete(jid)
      return persist()
    },
  }
}
