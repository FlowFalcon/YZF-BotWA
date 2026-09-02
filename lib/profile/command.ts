import type { CommandContext } from '../commands/command.js'
import { ProfileBrandingInputError, type ProfileBrandingService } from './branding.js'

export type ProfileAction = (
  service: ProfileBrandingService,
  context: CommandContext,
) => Promise<void>

export async function runProfileAction(
  context: CommandContext,
  action: ProfileAction,
  successReply: string,
): Promise<void> {
  if (context.profile === undefined) {
    await context.reply('Layanan profil belum siap.')
    return
  }
  try {
    await action(context.profile, context)
    await context.reply(successReply)
  } catch (error) {
    if (!(error instanceof ProfileBrandingInputError)) throw error
    await context.reply(error.message)
  }
}
