import { describe, expect, it } from 'vitest'

import { createApp } from '../../lib/app.js'

describe('entrypoint', () => {
  it('exposes the app composition root', () => {
    expect(typeof createApp).toBe('function')
  })
})
