import {
  WaClient,
  type Logger,
  type WaClientOptions,
  type WaClientProxyOptions,
  type WaStore,
} from 'zapo-js'

import type { BotConfig } from '../config.js'

/**
 * Test-only transport overrides for running against `@zapo-js/fake-server`.
 * Kept in a separate argument so the production path never passes them; none
 * of these bypass a security check — `testHooks.noiseRootCa` swaps the trusted
 * root so the full certificate verification still runs.
 */
export interface ClientTestOverrides {
  readonly chatSocketUrls?: readonly string[]
  readonly testHooks?: WaClientOptions['testHooks']
  readonly proxy?: WaClientProxyOptions
}

/**
 * Builds the client only. Listeners and `connect()` belong to the auth controller
 * and connection manager, which own the lifecycle (ARCHITECTURE.md §3).
 * `markOnlineOnConnect` is left at its `false` default so the bot stays invisible.
 */
export function createClient(
  config: BotConfig,
  store: WaStore,
  logger: Logger,
  overrides?: ClientTestOverrides,
): WaClient {
  return new WaClient(
    {
      store,
      sessionId: config.sessionId,
      ...(overrides?.chatSocketUrls === undefined
        ? {}
        : { chatSocketUrls: overrides.chatSocketUrls }),
      ...(overrides?.testHooks === undefined ? {} : { testHooks: overrides.testHooks }),
      ...(overrides?.proxy === undefined ? {} : { proxy: overrides.proxy }),
    },
    logger,
  )
}
