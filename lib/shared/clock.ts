/** Cancels a scheduled callback. Idempotent by contract. */
export type CancelScheduled = () => void

export interface Clock {
  /** Epoch milliseconds. */
  now(): number
  schedule(delayMs: number, callback: () => void): CancelScheduled
}

export const systemClock: Clock = {
  now: () => Date.now(),
  // setTimeout is resolved per call so test fake timers installed later still apply.
  schedule: (delayMs, callback) => {
    const handle = setTimeout(callback, delayMs)
    return () => {
      clearTimeout(handle)
    }
  },
}
