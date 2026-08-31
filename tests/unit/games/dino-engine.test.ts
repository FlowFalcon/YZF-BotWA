import { describe, expect, it } from 'vitest'
import {
  LANE,
  isFatal,
  renderLane,
  spawnChance,
  startRun,
  step,
  type DinoState,
} from '../../../src/games/dino-engine.js'

/** Deterministic sequence so every assertion below is reproducible. */
const rolls = (...values: readonly number[]): (() => number) => {
  let index = 0
  return () => values[index++] ?? 1
}

const never = () => 1
const always = () => 0

const withObstacles = (obstacles: readonly number[], parts: Partial<DinoState> = {}): DinoState => ({
  ...startRun(),
  obstacles,
  ...parts,
})

describe('startRun', () => {
  it('starts empty, alive, and scoreless', () => {
    const state = startRun()
    expect(state.obstacles).toEqual([])
    expect(state.score).toBe(0)
    expect(state.over).toBe(false)
    expect(state.airborne).toBe(false)
  })
})

describe('step', () => {
  it('scores one point per surviving tick', () => {
    const first = step(startRun(), 'run', never)
    expect(first.score).toBe(1)
    expect(step(first, 'run', never).score).toBe(2)
  })

  it('moves obstacles one cell toward the dino', () => {
    const state = step(withObstacles([5]), 'run', never)
    expect(state.obstacles).toEqual([4])
  })

  it('drops obstacles once they pass the dino', () => {
    const state = step(withObstacles([0], { airborne: true }), 'jump', never)
    expect(state.obstacles).toEqual([])
  })

  it('ends the run when an obstacle reaches a grounded dino', () => {
    const state = step(withObstacles([1]), 'run', never)
    expect(state.over).toBe(true)
    expect(state.obstacles).toEqual([0])
  })

  it('survives that same obstacle when jumping', () => {
    const state = step(withObstacles([1]), 'jump', never)
    expect(state.over).toBe(false)
    expect(state.airborne).toBe(true)
  })

  it('does not let a jump carry over to the next tick', () => {
    // Otherwise one tap would grant permanent immunity.
    const jumped = step(withObstacles([2]), 'jump', never)
    const landed = step(jumped, 'run', never)
    expect(jumped.airborne).toBe(true)
    expect(landed.airborne).toBe(false)
    expect(landed.over).toBe(true)
  })

  it('spawns at the far edge so the player can see it coming', () => {
    const state = step(startRun(), 'run', always)
    expect(state.obstacles).toEqual([LANE - 1])
  })

  it('refuses to spawn on top of an obstacle that just appeared', () => {
    // Back-to-back spawns would be unavoidable, which is a broken game.
    const state = step(withObstacles([LANE - 2]), 'run', always)
    expect(state.obstacles).toEqual([LANE - 3])
  })

  it('is frozen once the run is over', () => {
    const dead = step(withObstacles([1]), 'run', never)
    const after = step(dead, 'jump', always)
    expect(after).toEqual(dead)
  })

  it('raises the best score while the run is still alive', () => {
    // The fatal path has its own Math.max; without this, a surviving tick could
    // silently stop tracking the best score and every test still passed.
    const state = step(withObstacles([], { score: 4, best: 4 }), 'run', never)
    expect(state.over).toBe(false)
    expect(state.score).toBe(5)
    expect(state.best).toBe(5)
  })

  it('keeps the best score across a fatal tick', () => {
    const state = step(withObstacles([1], { score: 7, best: 3 }), 'run', never)
    expect(state.over).toBe(true)
    expect(state.best).toBe(7)
  })

  it('leaves a higher previous best untouched', () => {
    const state = step(withObstacles([1], { score: 2, best: 9 }), 'run', never)
    expect(state.best).toBe(9)
  })

  it('plays a full survivable run without dying', () => {
    // Jump on every tick: nothing can hit an airborne dino, so 30 ticks must survive.
    let state = startRun()
    for (let index = 0; index < 30; index += 1) {
      state = step(state, 'jump', rolls(0, 1, 0, 1, 0))
    }
    expect(state.over).toBe(false)
    expect(state.score).toBe(30)
  })
})

describe('spawnChance', () => {
  it('grows with the tick count so the run gets harder', () => {
    expect(spawnChance(30)).toBeGreaterThan(spawnChance(0))
  })

  it('stays below one so the lane can never be solid obstacles', () => {
    expect(spawnChance(10_000)).toBeLessThan(1)
  })
})

describe('renderLane', () => {
  it('draws the dino on the ground when running', () => {
    const lane = renderLane(startRun())
    expect(lane).toContain('🦖')
  })

  it('lifts the dino into the air row when jumping', () => {
    const grounded = renderLane(startRun())
    const airborne = renderLane({ ...startRun(), airborne: true })
    expect(airborne).not.toBe(grounded)
    // The air row is the first line; that is where the dino must be.
    expect(airborne.split('\n')[0]).toContain('🦖')
  })

  it('places an obstacle at its own cell, not at a fixed spot', () => {
    const near = renderLane(withObstacles([2]))
    const far = renderLane(withObstacles([8]))
    expect(near).not.toBe(far)
    expect(near).toContain('🌵')
  })
})

describe('isFatal', () => {
  it('is true only for a grounded collision', () => {
    expect(isFatal([0], false)).toBe(true)
    expect(isFatal([0], true)).toBe(false)
    expect(isFatal([3], false)).toBe(false)
  })
})
