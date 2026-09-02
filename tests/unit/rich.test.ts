import { describe, expect, it } from 'vitest'
import {
  externalAdReplyText,
  readRichReplyId,
  richButtons,
  richList,
} from '../../lib/messages/rich.js'

describe('externalAdReplyText', () => {
  it('builds a typed text message with an in-memory thumbnail', () => {
    const thumbnail = new Uint8Array([1, 2, 3])
    const content = externalAdReplyText({
      text: 'Bot aktif.',
      title: 'YZF-BotWA',
      body: 'WhatsApp Bot Modular',
      sourceUrl: 'https://github.com/',
      thumbnail,
    })

    expect(content).toEqual({
      type: 'text',
      text: 'Bot aktif.',
      contextInfo: {
        raw: {
          externalAdReply: {
            title: 'YZF-BotWA',
            body: 'WhatsApp Bot Modular',
            sourceUrl: 'https://github.com/',
            thumbnail,
            mediaType: 1,
            renderLargerThumbnail: false,
            showAdAttribution: false,
          },
        },
      },
    })
  })

  it('omits optional fields instead of emitting undefined proto values', () => {
    expect(externalAdReplyText({ text: 'Pong', title: 'YZF-BotWA' })).toEqual({
      type: 'text',
      text: 'Pong',
      contextInfo: {
        raw: {
          externalAdReply: {
            title: 'YZF-BotWA',
            mediaType: 1,
            renderLargerThumbnail: false,
            showAdAttribution: false,
          },
        },
      },
    })
  })
})

describe('richButtons', () => {
  it('builds a native-flow quick reply payload', () => {
    const content = richButtons({
      text: 'Pilih menu',
      footer: 'fun-bot',
      buttons: [
        { text: 'Ping', id: '.ping' },
        { text: 'Dadu', id: '.dice' },
      ],
    })

    const buttons = content.interactiveMessage.nativeFlowMessage.buttons
    expect(content.interactiveMessage.body.text).toBe('Pilih menu')
    expect(content.interactiveMessage.footer?.text).toBe('fun-bot')
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

  it('carries a thumbnail through externalAdReply instead of a native header', () => {
    const thumbnail = new Uint8Array([9, 8, 7])
    const content = richButtons({
      text: 'Menu',
      buttons: [{ text: 'Ping', id: '.ping' }],
      externalAdReply: {
        title: 'YZF-BotWA',
        body: 'WhatsApp Bot Modular',
        thumbnail,
        renderLargerThumbnail: true,
      },
    })

    expect(content.interactiveMessage.contextInfo).toEqual({
      externalAdReply: {
        title: 'YZF-BotWA',
        body: 'WhatsApp Bot Modular',
        thumbnail,
        mediaType: 1,
        renderLargerThumbnail: true,
        showAdAttribution: false,
      },
    })
  })

  it('omits contextInfo when no ad card is requested', () => {
    const content = richButtons({ text: 'x', buttons: [{ text: 'a', id: '.a' }] })
    expect(content.interactiveMessage.contextInfo).toBeUndefined()
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
