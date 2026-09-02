import { describe, expect, it, vi } from 'vitest'

import type { Command, CommandContext } from '../../../lib/commands/command.js'
import delpp from '../../../plugins/owner/delpp.js'
import delthumbnail from '../../../plugins/owner/delthumbnail.js'
import setabout from '../../../plugins/owner/setabout.js'
import setname from '../../../plugins/owner/setname.js'
import setpp from '../../../plugins/owner/setpp.js'
import setthumbnail from '../../../plugins/owner/setthumbnail.js'
import {
  ProfileBrandingInputError,
  type ProfileBrandingService,
} from '../../../lib/profile/branding.js'

function fakeService(): ProfileBrandingService {
  return {
    setName: vi.fn(() => Promise.resolve()),
    setProfilePicture: vi.fn(() => Promise.resolve()),
    deleteProfilePicture: vi.fn(() => Promise.resolve()),
    setAbout: vi.fn(() => Promise.resolve()),
    setThumbnail: vi.fn(() => Promise.resolve()),
    deleteThumbnail: vi.fn(() => Promise.resolve()),
  }
}

function context(parts: Partial<CommandContext> = {}, profile?: ProfileBrandingService): CommandContext {
  return {
    prefix: '.',
    text: '',
    args: [],
    reply: vi.fn(() => Promise.resolve()),
    settings: { getMode: () => 'owner-only' },
    commands: { list: () => [] },
    ...(profile === undefined ? {} : { profile }),
    ...parts,
  } as unknown as CommandContext
}

const commands: readonly Command[] = [setname, setpp, delpp, setabout, setthumbnail, delthumbnail]

describe('owner profile commands', () => {
  it('registers all six commands as owner-only', () => {
    expect(commands.map((command) => command.name)).toEqual([
      'setname',
      'setpp',
      'delpp',
      'setabout',
      'setthumbnail',
      'delthumbnail',
    ])
    expect(commands.every((command) => command.permission === 'owner')).toBe(true)
  })

  it('passes text changes to the injected service', async () => {
    const service = fakeService()

    await setname.run(context({ text: 'YZF Bot' }, service))
    await setabout.run(context({ text: 'Bot aktif.' }, service))

    expect(service.setName).toHaveBeenCalledWith('YZF Bot')
    expect(service.setAbout).toHaveBeenCalledWith('Bot aktif.')
  })

  it('passes incoming image content to distinct profile and thumbnail operations', async () => {
    const service = fakeService()
    const message = { extendedTextMessage: { text: '.setpp' } }

    await setpp.run(context({ message }, service))
    await setthumbnail.run(context({ message }, service))

    expect(service.setProfilePicture).toHaveBeenCalledWith(message)
    expect(service.setThumbnail).toHaveBeenCalledWith(message)
    expect(service.setProfilePicture).not.toBe(service.setThumbnail)
  })

  it('keeps profile and thumbnail deletion distinct', async () => {
    const service = fakeService()

    await delpp.run(context({}, service))
    await delthumbnail.run(context({}, service))

    expect(service.deleteProfilePicture).toHaveBeenCalledOnce()
    expect(service.deleteThumbnail).toHaveBeenCalledOnce()
  })

  it('returns actionable validation failures without exposing internal errors', async () => {
    const service = fakeService()
    vi.mocked(service.setName).mockRejectedValueOnce(new ProfileBrandingInputError('Nama maksimal 25 karakter.'))
    const reply = vi.fn(() => Promise.resolve())

    await setname.run(context({ text: 'x'.repeat(26), reply }, service))

    expect(reply).toHaveBeenCalledWith('Nama maksimal 25 karakter.')
  })

  it('reports unavailable runtime wiring without calling a service', async () => {
    const reply = vi.fn(() => Promise.resolve())

    await setpp.run(context({ reply }))

    expect(reply).toHaveBeenCalledWith('Layanan profil belum siap.')
  })
})
