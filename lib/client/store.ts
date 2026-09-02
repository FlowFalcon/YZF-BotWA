import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

import { createSqliteStore } from '@zapo-js/store-sqlite'
import { createStore, type Logger, type WaStore } from 'zapo-js'

/**
 * Provider selection for the MVP protocol store. Once `createStore` gets a
 * non-empty `backends`, every persistence domain must be named explicitly or
 * the factory throws listing the missing keys — so this map is exhaustive by
 * necessity, not by style. ARCHITECTURE.md §7 keeps the mailbox archive off.
 */
export const STORE_PROVIDERS = {
  auth: 'sqlite',
  signal: 'sqlite',
  preKey: 'sqlite',
  session: 'sqlite',
  identity: 'sqlite',
  senderKey: 'sqlite',
  appState: 'sqlite',
  privacyToken: 'sqlite',
  messages: 'none',
  threads: 'none',
  contacts: 'none',
} as const

export interface ProtocolStoreOptions {
  /** SQLite file path, or `':memory:'` for an ephemeral database in tests. */
  readonly path: string
  /** Forwarded to the SQLite layer for migration and slow-query diagnostics. */
  readonly logger?: Logger
}

export function createProtocolStore(options: ProtocolStoreOptions): WaStore {
  // better-sqlite3 creates the file but not its directory; `.auth/` is gitignored
  // so it is absent on a fresh clone. dirname(':memory:') is '.', already present.
  mkdirSync(dirname(options.path), { recursive: true })

  return createStore({
    backends: {
      sqlite: createSqliteStore({
        path: options.path,
        ...(options.logger === undefined ? {} : { logger: options.logger }),
      }),
    },
    providers: STORE_PROVIDERS,
  })
}
