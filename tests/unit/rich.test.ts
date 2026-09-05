import { describe, expect, it } from 'vitest'
import {
  compactCardText,
  readRichReplyId,
  richButtons,
  richList,
} from '../../lib/messages/rich.js'
import type { MenuHeader } from '../../lib/messages/menu-media.js'

const HEADER: MenuHeader = {
  title: 'YZF-BotWA',
  subtitle: 'WhatsApp bot modular',
  hasMediaAttachment: true,
  imageMessage: {
    url: 'https://mmg.whatsapp.net/x',
    directPath: '/o1/v/t24/x',
    mediaKey: new Uint8Array([1, 2]),
    fileSha256: new Uint8Array([3]),
    fileEncSha256: new Uint8Array([4]),
    fileLength: 5_000,
    mediaKeyTimestamp: 1_700_000_000,
    mimetype: 'image/jpeg',
    width: 720,
    height: 720,
    jpegThumbnail: new Uint8Array([5, 6]),
  },
}

describe('richButtons', () => {
  it('builds a native-flow quick reply payload', () => {
    const content = richButtons({
      text: 'Pilih menu',
      footer: 'YZF-BotWA',
      buttons: [
        { text: 'Ping', id: '.ping' },
        { text: 'Dino Run', id: '.dino' },
      ],
    })

    const buttons = content.interactiveMessage.nativeFlowMessage.buttons
    expect(content.interactiveMessage.body.text).toBe('Pilih menu')
    expect(content.interactiveMessage.footer?.text).toBe('YZF-BotWA')
    expect(buttons).toHaveLength(2)
    expect(buttons[0]?.name).toBe('quick_reply')
    expect(JSON.parse(buttons[0]?.buttonParamsJson ?? '{}')).toEqual({
      display_text: 'Ping',
      id: '.ping',
    })
  })

  it('omits the footer when none is given', () => {
    const content = richButtons({ text: 'x', buttons: [{ text: 'a', id: '.a' }] })
    expect(content.interactiveMessage.footer).toBeUndefined()
  })

  it('rejects an empty button list so an unusable card is never sent', () => {
    expect(() => richButtons({ text: 'x', buttons: [] })).toThrow(/at least one button/)
  })

  it('carries the image through the interactive header, the only path that renders on Phone and Web', () => {
    const content = richButtons({
      text: 'Menu',
      header: HEADER,
      buttons: [{ text: 'Ping', id: '.ping' }],
    })

    expect(content.interactiveMessage.header).toEqual(HEADER)
  })

  it('omits the header when no thumbnail is installed', () => {
    const content = richButtons({ text: 'x', buttons: [{ text: 'a', id: '.a' }] })
    expect(content.interactiveMessage.header).toBeUndefined()
  })

  it('never emits contextInfo: externalAdReply and fake quotes do not render', () => {
    const content = richButtons({ text: 'x', header: HEADER, buttons: [{ text: 'a', id: '.a' }] })
    expect(content.interactiveMessage).not.toHaveProperty('contextInfo')
  })
})

describe('compactCardText', () => {
  const thumbnail = { bytes: new Uint8Array([9, 8, 7]), width: 240, height: 201 }

  it('builds a raw extendedText card with an inline thumbnail and no HQ upload fields', () => {
    const content = compactCardText({
      text: 'Pong! Bot aktif.',
      url: 'https://github.com/FlowFalcon/YZF-BotWA',
      title: 'YZF-BotWA',
      description: 'WhatsApp bot modular',
      thumbnail,
    })

    const message = content.extendedTextMessage
    expect(message.matchedText).toBe('https://github.com/FlowFalcon/YZF-BotWA')
    expect(message.title).toBe('YZF-BotWA')
    expect(message.description).toBe('WhatsApp bot modular')
    expect(message.previewType).toBe(0)
    expect(message.jpegThumbnail).toEqual(thumbnail.bytes)
    expect(message.thumbnailWidth).toBe(240)
    expect(message.thumbnailHeight).toBe(201)
    // The HQ upload fields are what force the large card; the compact card must not carry them.
    expect(message).not.toHaveProperty('thumbnailDirectPath')
    expect(message).not.toHaveProperty('mediaKey')
  })

  it('keeps the url in the text (the client drops the card without it) but hides it behind padding', () => {
    const content = compactCardText({
      text: 'Pong!',
      url: 'https://example.com/repo',
      title: 'YZF-BotWA',
      thumbnail,
    })

    const { text } = content.extendedTextMessage
    expect(text.startsWith('https://example.com/repo')).toBe(true)
    expect(text).toContain('Pong!')
    // Zero-width padding pushes the url off-screen without deleting it.
    expect(text).toMatch(/\u200B{100,}/)
  })

  it('omits the description instead of emitting an empty proto field', () => {
    const content = compactCardText({
      text: 'x',
      url: 'https://example.com/',
      title: 'YZF-BotWA',
      thumbnail,
    })

    expect(content.extendedTextMessage).not.toHaveProperty('description')
  })

  it('rejects a thumbnail over the 64 KiB inline cap, which zapo would silently drop', () => {
    expect(() =>
      compactCardText({
        text: 'x',
        url: 'https://example.com/',
        title: 'YZF-BotWA',
        thumbnail: { bytes: new Uint8Array(64 * 1024 + 1), width: 240, height: 240 },
      }),
    ).toThrow(/64 KiB/)
  })
})

describe('richList', () => {
  it('builds a single-select payload with sections', () => {
    const content = richList({
      text: 'Menu',
      title: 'Fun',
      buttonText: 'Buka',
      sections: [
        {
          title: 'Acak',
          rows: [
            { title: 'Dadu', id: '.dice', description: 'Lempar dadu' },
            { title: 'Koin', id: '.coinflip' },
          ],
        },
      ],
    })

    const [button] = content.interactiveMessage.nativeFlowMessage.buttons
    expect(button?.name).toBe('single_select')
    const params = JSON.parse(button?.buttonParamsJson ?? '{}') as {
      readonly button_text: string
      readonly sections: readonly { readonly rows: readonly { readonly description: string }[] }[]
    }
    expect(params.button_text).toBe('Buka')
    expect(params.sections[0]?.rows[1]?.description).toBe('')
  })

  it('rejects sections with no rows', () => {
    expect(() =>
      richList({ text: 'x', title: 't', buttonText: 'b', sections: [{ title: 's', rows: [] }] }),
    ).toThrow(/at least one row/)
  })
})

describe('readRichReplyId', () => {
  it('reads a native-flow response id', () => {
    expect(
      readRichReplyId({
        interactiveResponseMessage: {
          nativeFlowResponseMessage: { name: 'quick_reply', paramsJson: '{"id":".ping"}' },
        },
      }),
    ).toBe('.ping')
  })

  it('reads a single-select row id', () => {
    expect(
      readRichReplyId({
        interactiveResponseMessage: {
          nativeFlowResponseMessage: {
            name: 'single_select',
            paramsJson: '{"selected_row_id":".dice"}',
          },
        },
      }),
    ).toBe('.dice')
  })

  it('reads the legacy buttons and list replies', () => {
    expect(readRichReplyId({ buttonsResponseMessage: { selectedButtonId: '.menu' } })).toBe('.menu')
    expect(
      readRichReplyId({ listResponseMessage: { singleSelectReply: { selectedRowId: '.rate' } } }),
    ).toBe('.rate')
  })

  it('returns undefined for malformed params instead of throwing', () => {
    expect(
      readRichReplyId({
        interactiveResponseMessage: { nativeFlowResponseMessage: { paramsJson: 'not json' } },
      }),
    ).toBeUndefined()
  })

  it('returns undefined for a plain text message', () => {
    expect(readRichReplyId({})).toBeUndefined()
    expect(readRichReplyId(undefined)).toBeUndefined()
  })
})
