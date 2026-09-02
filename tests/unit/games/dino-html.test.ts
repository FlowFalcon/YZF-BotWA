import { describe, expect, it } from 'vitest'
import { DINO_HTML } from '../../../lib/games/dino-html.js'

describe('DINO_HTML', () => {
  it('fits inside the primitive payload ceiling', () => {
    expect(new TextEncoder().encode(DINO_HTML).byteLength).toBeLessThan(128 * 1024)
  })

  it('is self-contained: no external requests of any kind', () => {
    // A remote fetch would leak that the message was opened, and would simply
    // fail inside the client's sandbox.
    expect(DINO_HTML).not.toMatch(/https?:\/\//)
    expect(DINO_HTML).not.toMatch(/\bfetch\s*\(/)
    expect(DINO_HTML).not.toMatch(/XMLHttpRequest/)
    expect(DINO_HTML).not.toMatch(/<img\b/)
    expect(DINO_HTML).not.toMatch(/@import/)
  })

  it('never uses eval or dynamic code construction', () => {
    expect(DINO_HTML).not.toMatch(/\beval\s*\(/)
    expect(DINO_HTML).not.toMatch(/new\s+Function/)
  })

  it('carries the pieces a playable game needs', () => {
    expect(DINO_HTML).toContain('<canvas')
    expect(DINO_HTML).toContain('requestAnimationFrame')
    // Tap and keyboard both jump: the client may deliver either.
    expect(DINO_HTML).toContain('touchstart')
    expect(DINO_HTML).toContain('keydown')
  })

  it('has balanced style and script tags', () => {
    const count = (pattern: RegExp): number => (DINO_HTML.match(pattern) ?? []).length
    expect(count(/<style>/g)).toBe(count(/<\/style>/g))
    expect(count(/<script>/g)).toBe(count(/<\/script>/g))
  })
})
