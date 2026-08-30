import type { Logger as PinoLogger } from 'pino'
import type { Logger as ZapoLogger, LogLevel } from 'zapo-js'

type Emit = (message: string, context?: Readonly<Record<string, unknown>>) => void

/**
 * Adapts pino to the `zapo-js` logger contract. The two are not interchangeable:
 * pino takes `(mergeObject, message)` while Zapo calls `(message, context)`, so
 * passing a pino instance straight to the client silently swaps the arguments.
 */
export function toZapoLogger(logger: PinoLogger, level: LogLevel): ZapoLogger {
  const emit =
    (write: (fields: object, message: string) => void): Emit =>
    (message, context) => {
      write.call(logger, context ?? {}, message)
    }

  return {
    level,
    trace: emit(logger.trace),
    debug: emit(logger.debug),
    info: emit(logger.info),
    warn: emit(logger.warn),
    error: emit(logger.error),
    child: (bindings, options) => toZapoLogger(logger.child(bindings), options?.level ?? level),
  }
}
