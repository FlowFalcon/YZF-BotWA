import { describe, expect, it } from 'vitest'

import { projectName } from '../../src/index.js'

describe('project scaffold', () => {
  it('exposes the project name', () => {
    expect(projectName()).toBe('zapo-fun-bot')
  })
})
