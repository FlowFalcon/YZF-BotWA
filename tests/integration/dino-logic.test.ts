import { describe, expect, it } from 'vitest'
import { runDinoHeadless } from '../support/dino-harness.js'

/**
 * Executes the game's real script with a stub canvas and DOM, because a string
 * assertion cannot tell whether the loop actually runs. This catches syntax
 * errors, undefined references, and a collision test that never fires.
 */
describe('dino game logic (real script execution)', () => {
  it('runs hundreds of frames without throwing and draws every frame', () => {
    const result = runDinoHeadless({ frames: 400 })
    expect(result.errors).toEqual([])
    expect(result.frames).toBe(400)
    expect(result.fillRectCalls).toBeGreaterThan(400)
  })

  it('increases the displayed score as the run continues', () => {
    const early = runDinoHeadless({ frames: 60 })
    const later = runDinoHeadless({ frames: 600 })
    expect(Number(later.score)).toBeGreaterThan(Number(early.score))
  })

  it('registers tap, mouse, and keyboard jump handlers', () => {
    const result = runDinoHeadless({ frames: 10 })
    expect(result.listeners).toContain('touchstart')
    expect(result.listeners).toContain('mousedown')
    expect(result.listeners).toContain('keydown')
  })

  it('lifts the player off the ground when a jump is triggered', () => {
    // Jump on frame 5, then sample the drawn player height a few frames later.
    const result = runDinoHeadless({ frames: 30, jumpAtFrame: 5 })
    expect(result.minPlayerY).toBeLessThan(result.groundPlayerY)
  })

  it('ends the run on collision and offers a restart', () => {
    // Never jumping guarantees an obstacle is hit within a few hundred frames.
    const result = runDinoHeadless({ frames: 900 })
    expect(result.hintHtml).toMatch(/main lagi/i)
  })

  it('recovers after a restart tap, clearing the game-over hint', () => {
    const result = runDinoHeadless({ frames: 900, restartAfterGameOver: true })
    expect(result.hintText).toMatch(/lompat/i)
    expect(result.errors).toEqual([])
  })
})
