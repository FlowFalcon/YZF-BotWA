import type { WaIncomingMessageEvent } from 'zapo-js'
import type { Command } from '../commands/command.js'
import type { CommandRegistry } from '../commands/registry.js'
import { parseCommand } from '../commands/parser.js'
import type { CooldownDecision } from '../commands/middleware/cooldown.js'
import type { FloodDecision } from '../commands/middleware/flood.js'
import type { CommandErrorReport } from '../commands/middleware/error-boundary.js'
import { runWithErrorBoundary } from '../commands/middleware/error-boundary.js'
import { checkPermission } from '../commands/middleware/permission.js'
import type { Clock } from '../shared/clock.js'
import type { Random } from '../shared/random.js'
import { createCommandContext } from './context.js'
import type { MessageSender } from './context.js'
import { extractMessageText } from './extract-text.js'
import { evaluateAccess } from '../access/access-policy.js'
import type { SettingsView } from '../settings.js'
import type { ProfileBrandingService } from '../profile/branding.js'

export type ChatKind = 'group' | 'private'
export type RouteOutcome = 'ok' | 'error' | 'denied' | 'rate_limited'

/** No body/text field by construction: raw message content cannot reach a reporter. */
export interface CommandReport {
  readonly messageId: string
  /** Present only after registry lookup, and always canonical. */
  readonly command?: string
  readonly chatKind: ChatKind
  readonly durationMs: number
  readonly outcome: RouteOutcome
}

/** Structural callbacks so the router does not depend on the logger module. */
export interface RouterReporter {
  command(report: CommandReport): void
  error(report: CommandErrorReport): void
}

/** Only the `check` member is used; `FloodGate` conforms structurally. */
export interface FloodChecker {
  check(senderJid: string): FloodDecision
}

export interface CooldownChecker {
  check(senderJid: string, command: Command): CooldownDecision
}

export interface MessageRouterOptions {
  readonly registry: CommandRegistry
  readonly prefixes: readonly string[]
  readonly sender: MessageSender
  readonly clock: Clock
  readonly random: Random
  readonly flood: FloodChecker
  readonly cooldown: CooldownChecker
  readonly reporter: RouterReporter
  readonly ownerNumber?: string
  readonly settings: SettingsView
  readonly profile?: ProfileBrandingService
  readonly menuThumbnailPath: string
}

export type MessageRouter = (event: WaIncomingMessageEvent) => Promise<void>

/** COMMAND_SPEC §6: permission failure boleh dibalas, singkat dan berbahasa Indonesia. */
export const OWNER_ONLY_REPLY = 'Perintah ini hanya untuk owner bot.'

/** Satu pesan untuk flood maupun cooldown: user hanya perlu tahu sisa waktu tunggu. */
export function rateLimitReply(retryAfterMs: number): string {
  const seconds = Math.max(1, Math.ceil(retryAfterMs / 1_000))
  return `Sabar dulu, coba lagi dalam ${String(seconds)} detik.`
}

export function createMessageRouter(options: MessageRouterOptions): MessageRouter {
  return async (event) => {
    const { key } = event
    // COMMAND_SPEC §5 langkah 1: own message, newsletter, dan broadcast tidak dirutekan.
    if (key.fromMe || key.isNewsletter || key.isBroadcast) return

    const raw = extractMessageText(event.message)
    if (raw === undefined) return

    const parsed = parseCommand(raw, options.prefixes)
    if (parsed === undefined) return

    const startedAtMs = options.clock.now()
    const context = createCommandContext({
      event,
      parsed,
      sender: options.sender,
      clock: options.clock,
      random: options.random,
      receivedAtMs: startedAtMs,
      settings: options.settings,
      commands: options.registry,
      menuThumbnailPath: options.menuThumbnailPath,
      ...(options.profile === undefined ? {} : { profile: options.profile }),
      ...(options.ownerNumber === undefined ? {} : { ownerNumber: options.ownerNumber }),
    })

    const report = (commandName: string | undefined, outcome: RouteOutcome): void => {
      options.reporter.command({
        messageId: key.id ?? '',
        ...(commandName === undefined ? {} : { command: commandName }),
        chatKind: context.isGroup ? 'group' : 'private',
        durationMs: options.clock.now() - startedAtMs,
        outcome,
      })
    }

    const access = evaluateAccess({
      mode: options.settings.getMode(),
      isGroup: context.isGroup,
      isOwner: context.isOwner,
      commandName: parsed.name,
    })
    if (!access.allowed) {
      report(undefined, 'denied')
      return
    }

    // Access is evaluated before lookup so blocked chats cannot probe registry state.
    const command = options.registry.get(parsed.name)
    if (command === undefined) return

    // Permission sebelum flood/cooldown: penolakan tidak boleh mengonsumsi kuota apa pun.
    if (!checkPermission(command, context.isOwner).allowed) {
      await context.reply(OWNER_ONLY_REPLY)
      report(command.name, 'denied')
      return
    }

    const flood = options.flood.check(context.senderJid)
    if (!flood.allowed) {
      await context.reply(rateLimitReply(flood.retryAfterMs))
      report(command.name, 'rate_limited')
      return
    }

    // Command canonical diteruskan supaya cooldown tidak bisa dielakkan lewat alias.
    const cooldown = options.cooldown.check(context.senderJid, command)
    if (!cooldown.allowed) {
      await context.reply(rateLimitReply(cooldown.retryAfterMs))
      report(command.name, 'rate_limited')
      return
    }

    const outcome = await runWithErrorBoundary(command, context, {
      // Arrow, bukan method reference: reporter boleh bergantung pada `this`-nya sendiri.
      reporter: (errorReport) => {
        options.reporter.error(errorReport)
      },
    })
    report(command.name, outcome)
  }
}
