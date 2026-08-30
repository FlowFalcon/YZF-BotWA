import { describe, expect, it } from 'vitest'

import { extractMessageText } from '../../src/messages/extract-text.js'
import {
  extendedTextMessage,
  imageCaptionMessage,
  textMessage,
  videoCaptionMessage,
} from '../fixtures/messages.js'

describe('extractMessageText', () => {
  it('reads plain conversation text', () => {
    expect(extractMessageText(textMessage('.ping'))).toBe('.ping')
  })

  it('reads extended text message', () => {
    expect(extractMessageText(extendedTextMessage('.menu fun'))).toBe('.menu fun')
  })

  it('reads image caption', () => {
    expect(extractMessageText(imageCaptionMessage('.sticker'))).toBe('.sticker')
  })

  it('reads video caption', () => {
    expect(extractMessageText(videoCaptionMessage('.tovideo'))).toBe('.tovideo')
  })

  it('returns undefined for unsupported, empty, null, and undefined messages', () => {
    expect(extractMessageText({ protocolMessage: {} })).toBeUndefined()
    expect(extractMessageText({})).toBeUndefined()
    expect(extractMessageText(null)).toBeUndefined()
    expect(extractMessageText(undefined)).toBeUndefined()
  })
})
