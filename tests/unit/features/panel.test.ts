import { describe, expect, it, vi } from 'vitest'
import type { Command, CommandContext } from '../../../src/commands/command.js'
import { createCommandRegistry } from '../../../src/commands/registry.js'
import panel, { buildPanel, setPanelSource } from '../../../src/features/general/panel.js'
import type { RichInteractiveContent } from '../../../src/messages/rich.js'

const stub = (name: string, category: 'general' | 'fun', permission?: 'owner'): Command => ({
  name,
  category,
  description: `desc ${name}`,
  ...(permission === undefined ? {} : { permission }),
  run: () => Promise.resolve(),
})

const rows = (content: RichInteractiveContent): readonly { title: string; id: string }[] => {
  const params = JSON.parse(
    content.interactiveMessage.nativeFlowMessage.buttons[0]?.buttonParamsJson ?? '{}',
  ) as { sections: readonly { rows: readonly { title: string; id: string }[] }[] }
  return params.sections.flatMap((section) => section.rows)
}

describe('buildPanel', () => {
  it('lists every public command as a tappable row carrying its prefixed trigger', () => {
    const content = buildPanel([stub('ping', 'general'), stub('dice', 'fun')], '.')
    expect(rows(content)).toEqual([
      { title: '.ping', description: 'desc ping', id: '.ping' },
      { title: '.dice', description: 'desc dice', id: '.dice' },
    ])
  })

  it('hides owner-only commands: a row nobody may run is misleading', () => {
    const content = buildPanel([stub('ping', 'general'), stub('access', 'general', 'owner')], '.')
    expect(rows(content).map((row) => row.id)).toEqual(['.ping'])
  })

  it('honours a non-default prefix', () => {
    const content = buildPanel([stub('ping', 'general')], '!')
    expect(rows(content)[0]?.id).toBe('!ping')
  })
})

describe('panel command', () => {
  it('sends the interactive payload through replyContent', async () => {
    setPanelSource(createCommandRegistry([stub('ping', 'general')]))
    const replyContent = vi.fn((content: RichInteractiveContent) => {
      void content
      return Promise.resolve()
    })
    await panel.run({ prefix: '.', replyContent } as unknown as CommandContext)

    const sent = replyContent.mock.calls[0]?.[0]
    expect(sent?.interactiveMessage.nativeFlowMessage.buttons[0]?.name).toBe('single_select')
    setPanelSource(undefined)
  })

  it('replies with plain text when the registry was never injected', async () => {
    setPanelSource(undefined)
    const reply = vi.fn(() => Promise.resolve())
    await panel.run({ prefix: '.', reply } as unknown as CommandContext)
    expect(reply).toHaveBeenCalledWith('Panel belum siap.')
  })
})
