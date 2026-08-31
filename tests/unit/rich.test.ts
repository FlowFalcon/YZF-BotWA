import { describe, expect, it } from 'vitest'
import { readRichReplyId, richButtons, richList } from '../../src/messages/rich.js'

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
