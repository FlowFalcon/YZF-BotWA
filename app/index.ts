import path from 'node:path'
import { downloadMediaMessage } from 'zapo-js'

import { createApp } from '../lib/app.js'
import { createClient } from '../lib/client/create-client.js'
import { createGroupGateway } from '../lib/group/gateway.js'
import { createUserStore } from '../lib/users/store.js'
import { fitJpeg } from '../lib/media/fit-jpeg.js'
import { createMenuMediaService } from '../lib/messages/menu-media.js'
import { createProtocolStore } from '../lib/client/store.js'
import { loadCommands } from '../lib/commands/loader.js'
import { createPluginWatcher, watchPluginFiles } from '../lib/commands/plugin-watcher.js'
import { createReloadableRegistry } from '../lib/commands/reloadable-registry.js'
import { buildPluginRegistry } from '../lib/commands/runtime-plugin-build.js'
import { loadConfig } from '../lib/config.js'
import { createLogger } from '../lib/shared/logger.js'
import { toZapoLogger } from '../lib/shared/zapo-logger.js'
import { createSettingsStore } from '../lib/settings.js'
import {
  createProfileBrandingService,
  resizeProfileJpeg,
} from '../lib/profile/branding.js'

/** Compiled plugins live at `dist/plugins`, sibling to `dist/lib/`, so `../plugins` is correct. */
const PLUGINS_DIR = path.join(import.meta.dirname, '..', 'plugins')
const PLUGIN_SOURCES_DIR = path.resolve('plugins')
/** Aset branding. Resolved from cwd because `tsc` emits no PNGs into `dist/`. */
const IMAGES_DIR = path.resolve('lib', 'images')

async function main(): Promise<void> {
  const config = loadConfig(process.env)
  const logger = createLogger({ level: config.logLevel, json: config.isProduction })
  const zapoLogger = toZapoLogger(logger, config.logLevel)
  const store = createProtocolStore({ path: config.storePath, logger: zapoLogger })
  const client = createClient(config, store, zapoLogger)
  const registry = createReloadableRegistry(
    await loadCommands(PLUGINS_DIR),
    () => buildPluginRegistry({
      cwd: process.cwd(),
      configPath: path.resolve('tsconfig.build.json'),
      outputDir: path.resolve('.runtime/plugins'),
    }),
  )
  const settings = await createSettingsStore(path.join(path.dirname(config.storePath), 'settings.json'))
  const users = await createUserStore(path.join(path.dirname(config.storePath), 'users.json'))
  const group = createGroupGateway(client.group)
  // JID bot dibaca per pesan: kredensial baru terisi setelah pairing selesai.
  const botJids = (): readonly string[] => {
    const credentials = client.auth.getCurrentCredentials()
    return [credentials?.meJid, credentials?.meLid].filter((jid): jid is string => jid !== undefined)
  }
  const profile = createProfileBrandingService({
      profile: client.profile,
      download: (message) => downloadMediaMessage(message),
      resize: resizeProfileJpeg,
      thumbnailPath: config.menuThumbnailPath,
    })
  // Presentation media. The header image must be real CDN media, so this owns
  // the upload and caches the descriptor until `.setthumbnail` replaces the file.
  const menuMedia = createMenuMediaService({
    thumbnailPath: config.menuThumbnailPath,
    menuImagePath: path.join(IMAGES_DIR, 'mn.png'),
    replyImagePath: path.join(IMAGES_DIR, 'rp.png'),
    upload: async (bytes) => client.message.upload(bytes, { type: 'image', mimetype: 'image/jpeg' }),
    fitJpeg,
  })

  const pluginWatcher = createPluginWatcher({
    fileWatcher: watchPluginFiles(PLUGIN_SOURCES_DIR),
    reload: async () => {
      const change = await registry.reload()
      logger.info(change, `reloaded: +${String(change.added)} -${String(change.removed)}`)
    },
    onError: (error) => { logger.warn({ err: error }, 'plugin reload failed') },
  })
  const app = createApp({ config, logger, store, client, registry, settings, profile, menuMedia, group, users, botJids, pluginWatcher })

  let shuttingDown = false
  const shutdown = (signal: string): void => {
    if (shuttingDown) return
    shuttingDown = true
    logger.info({ signal }, 'shutdown')
    app.stop().then(
      () => process.exit(0),
      (error: unknown) => {
        logger.error({ err: error }, 'shutdown failed')
        process.exit(1)
      },
    )
  }

  process.on('SIGINT', () => {
    shutdown('SIGINT')
  })
  process.on('SIGTERM', () => {
    shutdown('SIGTERM')
  })

  await app.start()
}

await main().catch((error: unknown) => {
  // The logger may not exist yet when config loading fails, so this one write
  // goes to stderr directly.
  process.stderr.write(`fatal: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
