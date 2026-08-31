/**
 * The runner game as pure state, independent of how it is drawn or delivered.
 *
 * Kept separate from the message layer so the whole game is testable without a
 * socket, and so the same engine can drive the button version and the HTML one.
 */

/** Cells between the far edge and the dino. Position 0 is the dino's own cell. */
export const LANE = 10

/** Cells that must stay clear behind a fresh spawn, so a run is always winnable. */
const MIN_GAP = 3

const BASE_SPAWN = 0.18
const SPAWN_GROWTH = 0.004
const MAX_SPAWN = 0.75

export type DinoAction = 'run' | 'jump'

export interface DinoState {
  /** Obstacle positions, 0 = the dino's cell, LANE - 1 = far edge. */
  readonly obstacles: readonly number[]
  readonly score: number
  readonly best: number
  readonly over: boolean
  readonly airborne: boolean
  readonly ticks: number
}

export function startRun(best = 0): DinoState {
  return { obstacles: [], score: 0, best, over: false, airborne: false, ticks: 0 }
}

/** Rises with tick count so a long run keeps getting harder. */
export function spawnChance(ticks: number): number {
  return Math.min(BASE_SPAWN + ticks * SPAWN_GROWTH, MAX_SPAWN)
}

export function isFatal(obstacles: readonly number[], airborne: boolean): boolean {
  return !airborne && obstacles.includes(0)
}

/**
 * Advances one tick. `random` is injected rather than called directly so runs
 * are reproducible in tests.
 */
export function step(state: DinoState, action: DinoAction, random: () => number): DinoState {
  if (state.over) return state

  const airborne = action === 'jump'
  const moved = state.obstacles.map((position) => position - 1)

  if (isFatal(moved, airborne)) {
    return {
      ...state,
      obstacles: moved.filter((position) => position >= 0),
      airborne,
      over: true,
      best: Math.max(state.best, state.score),
    }
  }

  const surviving = moved.filter((position) => position >= 0)
  const crowded = surviving.some((position) => position >= LANE - 1 - MIN_GAP)
  const obstacles =
    !crowded && random() < spawnChance(state.ticks) ? [...surviving, LANE - 1] : surviving
  const score = state.score + 1

  return {
    obstacles,
    score,
    best: Math.max(state.best, score),
    over: false,
    airborne,
    ticks: state.ticks + 1,
  }
}

const DINO = '🦖'
const CACTUS = '🌵'
const SKY = '⬛'
const GROUND = '⬜'

/** Two rows of fixed width, so the lane never reflows between messages. */
export function renderLane(state: DinoState): string {
  const air: string[] = []
  const ground: string[] = []

  for (let cell = 0; cell < LANE; cell += 1) {
    const hasDino = cell === 0
    const hasCactus = state.obstacles.includes(cell)

    air.push(hasDino && state.airborne ? DINO : SKY)
    if (hasCactus) {
      ground.push(CACTUS)
    } else {
      ground.push(hasDino && !state.airborne ? DINO : GROUND)
    }
  }

  return `${air.join('')}\n${ground.join('')}`
}
