import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { STORE_PROVIDERS, createProtocolStore } from '../../lib/client/store.js'

let workDir: string

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'zapo-store-test-'))
})

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true })
})

describe('createProtocolStore', () => {
  it('creates the missing parent directory of the store path', async () => {
    const storePath = join(workDir, 'nested', '.auth', 'state.sqlite')

    // createStore throws when a persistence domain is unassigned, so a clean
    // return also proves STORE_PROVIDERS covers the full domain matrix.
    const store = createProtocolStore({ path: storePath })

    expect(existsSync(dirname(storePath))).toBe(true)
    await store.destroy()
  })
})

describe('STORE_PROVIDERS', () => {
  it('persists the eight protocol domains in sqlite', () => {
    expect(STORE_PROVIDERS.auth).toBe('sqlite')
    expect(STORE_PROVIDERS.signal).toBe('sqlite')
    expect(STORE_PROVIDERS.preKey).toBe('sqlite')
    expect(STORE_PROVIDERS.session).toBe('sqlite')
    expect(STORE_PROVIDERS.identity).toBe('sqlite')
    expect(STORE_PROVIDERS.senderKey).toBe('sqlite')
    expect(STORE_PROVIDERS.appState).toBe('sqlite')
    expect(STORE_PROVIDERS.privacyToken).toBe('sqlite')
  })

  it('disables the mailbox archive domains', () => {
    expect(STORE_PROVIDERS.messages).toBe('none')
    expect(STORE_PROVIDERS.threads).toBe('none')
    expect(STORE_PROVIDERS.contacts).toBe('none')
  })
})
