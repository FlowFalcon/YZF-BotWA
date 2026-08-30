import path from 'node:path'

import { createApp } from './app.js'
import { createClient } from './client/create-client.js'
import { createProtocolStore } from './client/store.js'
import { loadCommands } from './commands/loader.js'
import { loadConfig } from './config.js'
import { createLogger } from './shared/logger.js'
import { toZapoLogger } from './shared/zapo-logger.js'

/** Compiled features live next to this file in `dist/`, so `.js` is correct at runtime. */
const FEATURES_DIR = path.join(import.meta.dirname, 'features')

async function main(): Promise<void> {
  const config = loadConfig(process.env)
  const logger = createLogger({ level: config.logLevel, json: config.isProduction })
  const zapoLogger = toZapoLogger(logger, config.logLevel)
  const store = createProtocolStore({ path: config.storePath, logger: zapoLogger })
  const client = createClient(config, store, zapoLogger)
  const registry = await loadCommands(FEATURES_DIR)

  const app = createApp({ config, logger, store, client, registry })

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
