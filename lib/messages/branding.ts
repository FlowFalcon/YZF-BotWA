import { readFileSync } from 'node:fs'

import type { ExternalAdReplyCard } from './rich.js'

const BOT_NAME = 'YZF-BotWA'

export interface BrandingCardOptions {
  /** Menu surfaces use the tall card; compact replies keep the small one. */
  readonly large?: boolean
}

/**
 * Builds the branding card shared by every command that shows a thumbnail.
 *
 * Returns `undefined` when no thumbnail is installed, so a missing asset means
 * "no card" rather than a card with a broken image. The bytes are read on each
 * call because `.setthumbnail` can replace the file while the bot is running.
 */
export function brandingCard(
  thumbnailPath: string,
  body: string,
  options: BrandingCardOptions = {},
): ExternalAdReplyCard | undefined {
  let thumbnail: Uint8Array
  try {
    thumbnail = new Uint8Array(readFileSync(thumbnailPath))
  } catch {
    return undefined
  }
  return {
    title: BOT_NAME,
    body,
    thumbnail,
    renderLargerThumbnail: options.large ?? false,
  }
}
