import type { Command, CommandContext } from '../command.js'

export type CommandErrorStage = 'run' | 'reply'

export interface CommandErrorReport {
  readonly stage: CommandErrorStage
  /** Canonical command name; bukan alias dan bukan isi pesan user. */
  readonly command: string
  readonly error: unknown
}

/** Structural callback: boundary tidak bergantung pada module logger tertentu. */
export interface ErrorBoundaryOptions {
  reporter(report: CommandErrorReport): void
}

export type CommandOutcome = 'ok' | 'error'

/** COMMAND_SPEC §6 / SECURITY.md §8: user hanya menerima pesan generic. */
export const GENERIC_ERROR_REPLY = 'Maaf, terjadi kesalahan internal. Coba lagi nanti.'

/**
 * Menjalankan command dan mengubah exception menjadi satu reply generic plus satu
 * report terstruktur. Reply generic dicoba tepat satu kali: kegagalan pengiriman
 * dilaporkan, tidak dibalas ulang, sehingga tidak ada rekursi/retry loop.
 */
export async function runWithErrorBoundary(
  command: Command,
  context: CommandContext,
  options: ErrorBoundaryOptions,
): Promise<CommandOutcome> {
  try {
    await command.run(context)
    return 'ok'
  } catch (error: unknown) {
    options.reporter({ stage: 'run', command: command.name, error })
    try {
      await context.reply(GENERIC_ERROR_REPLY)
    } catch (replyError: unknown) {
      options.reporter({ stage: 'reply', command: command.name, error: replyError })
    }
    return 'error'
  }
}
