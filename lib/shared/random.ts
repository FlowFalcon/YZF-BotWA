export interface Random {
  /** Float in [0, 1). */
  next(): number
}

export const systemRandom: Random = {
  next: () => Math.random(),
}
