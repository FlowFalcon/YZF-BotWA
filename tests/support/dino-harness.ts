import { runInNewContext } from 'node:vm'
import { DINO_HTML } from '../../lib/games/dino-html.js'

export interface DinoRunOptions {
  readonly frames: number
  /** Fire a tap on this frame index. */
  readonly jumpAtFrame?: number
  /** Tap once more after the run ends, to exercise the reset path. */
  readonly restartAfterGameOver?: boolean
}

export interface DinoRunResult {
  readonly frames: number
  readonly fillRectCalls: number
  readonly errors: readonly string[]
  readonly listeners: readonly string[]
  readonly score: string
  readonly hintText: string
  readonly hintHtml: string
  /** Smallest y the player sprite was drawn at (canvas y grows downward). */
  readonly minPlayerY: number
  /** The player's y while standing on the ground. */
  readonly groundPlayerY: number
}

interface StubElement {
  textContent: string
  innerHTML: string
  className: string
  width: number
  height: number
  addEventListener(type: string, handler: (event: unknown) => void): void
  getContext(): Record<string, unknown>
}

const GROUND_PLAYER_Y = 120

/**
 * Runs the game's `<script>` inside `node:vm` against a minimal canvas/DOM
 * stub, driving `requestAnimationFrame` a fixed number of times.
 *
 * `runInNewContext` is confined to this test helper and never reachable from a
 * message: SECURITY.md §2 forbids evaluating source that arrives from chat, and
 * the input here is the project's own compiled-in constant.
 */
export function runDinoHeadless(options: DinoRunOptions): DinoRunResult {
  const script = extractScript(DINO_HTML)
  const errors: string[] = []
  const listeners: string[] = []
  const playerYs: number[] = []
  let fillRectCalls = 0
  let frames = 0

  const handlers = new Map<string, (event: unknown) => void>()
  const nodes = new Map<string, StubElement>()

  const element = (): StubElement => ({
    textContent: '',
    innerHTML: '',
    className: '',
    width: 600,
    height: 190,
    addEventListener: (type, handler) => {
      listeners.push(type)
      handlers.set(type, handler)
    },
    getContext: () => ({
      clearRect: () => undefined,
      fillRect: (x: number, y: number, w: number, h: number) => {
        fillRectCalls += 1
        // The player's body is the 22x22 block drawn at x=40.
        if (x === 40 && w === 22 && h === 22) playerYs.push(y)
      },
      set fillStyle(_value: string) {
        // Written on every draw; nothing to assert on the colour itself.
      },
      get fillStyle(): string {
        return ''
      },
    }),
  })

  for (const id of ['c', 's', 'h']) nodes.set(id, element())

  const pending: (() => void)[] = []
  const sandbox = {
    document: {
      getElementById: (id: string) => nodes.get(id) ?? element(),
      addEventListener: (type: string, handler: (event: unknown) => void) => {
        listeners.push(type)
        handlers.set(type, handler)
      },
    },
    requestAnimationFrame: (callback: () => void) => {
      pending.push(callback)
      return pending.length
    },
    Math,
  }

  try {
    runInNewContext(script, sandbox, { timeout: 5000 })

    const tap = (): void => {
      const handler = handlers.get('touchstart')
      handler?.({ preventDefault: () => undefined })
    }

    while (frames < options.frames) {
      if (frames === options.jumpAtFrame) tap()
      const next = pending.shift()
      if (next === undefined) break
      next()
      frames += 1
    }

    if (options.restartAfterGameOver === true) {
      tap()
      for (let index = 0; index < 5; index += 1) {
        const next = pending.shift()
        if (next === undefined) break
        next()
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error))
  }

  const hint = nodes.get('h')
  return {
    frames,
    fillRectCalls,
    errors,
    listeners,
    score: nodes.get('s')?.textContent ?? '',
    hintText: hint?.textContent ?? '',
    hintHtml: hint?.innerHTML ?? '',
    minPlayerY: playerYs.length === 0 ? GROUND_PLAYER_Y : Math.min(...playerYs),
    groundPlayerY: GROUND_PLAYER_Y,
  }
}

function extractScript(html: string): string {
  const start = html.indexOf('<script>')
  const end = html.indexOf('</script>')
  if (start === -1 || end === -1) throw new Error('dino html carries no script block')
  return html.slice(start + '<script>'.length, end)
}
