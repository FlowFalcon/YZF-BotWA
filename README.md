# YZF-BotWA

A modular WhatsApp bot base built with TypeScript and [`zapo-js`](https://www.npmjs.com/package/zapo-js).

Twelve working commands, a hot-reloadable plugin loader with a static security policy, native-flow buttons wired to real actions, and a test suite that covers the runtime contract. Use it as the starting point for your own bot instead of writing the connection, routing, and access layers again.

[Bahasa Indonesia](README_ID.md)

## Status

Version `0.0.1`. The runtime is verified — 335 tests over 47 files, typecheck, lint, and build all pass — and the command surface is stable. The package is marked `private`, so it is distributed as source, not as an npm release.

## Features

- **12 commands** across tools, sticker, games, and owner categories, all registered from `plugins/`.
- **Plugin loader with a static policy.** Plugin sources are parsed before compilation; `eval`, `new Function`, `process`, `require`, dynamic `import()`, computed member access, decorators, and top-level side effects are rejected. Only `zapo-js` and three `node:` builtins are importable.
- **Hot reload.** Editing a file under `plugins/` recompiles into an immutable generation under `.runtime/plugins/` and swaps the registry atomically. A bad plugin leaves the running registry untouched.
- **Purpose-driven buttons.** Native-flow quick replies are only used where a single tap completes an action or opens a useful menu. Commands that need text or media stay as documented commands.
- **Branding cards.** `externalAdReply` carries the menu thumbnail on interactive and compact replies, so a normal (non-business) account still renders an image.
- **Three access modes** persisted atomically and applied without a restart: `public`, `group-only`, `owner-only`.
- **Rate limiting.** Sliding-window flood control (5 commands per 10 s per sender) plus a per-command cooldown keyed on the canonical name, so aliases cannot bypass it.
- **Stickers** from images, videos, GIFs, and animated stickers via a fixed-argv `ffmpeg` call — no shell, with pack metadata written into the WebP EXIF chunk.
- **Redacting logger.** Credentials, QR payloads, pairing codes, and raw message text are censored at the pino level rather than by convention.
- **AIRich HTML.** `.dino` ships a playable HTML game rendered by WhatsApp's own HTML primitive.

## Requirements

- Node.js `>= 20.9.0` (developed on v22)
- `ffmpeg` on `PATH` (sticker encoding)
- A WhatsApp account for the bot, and a second device to scan the QR or enter the pairing code

## Quick start

```bash
git clone <your-fork-url> yzf-botwa
cd yzf-botwa
npm ci
cp .env.example .env
# set BOT_OWNER_NUMBER in .env, digits with country code
npm run check
npm run build
npm start
```

On the first run a QR code is printed in the terminal. Scan it from **WhatsApp → Linked devices → Link a device**. Session state is written to `.auth/state.sqlite` and reused on the next start.

The bot starts in `owner-only` mode. Send `.botmode public` from the owner number to open it up.

See [docs/INSTALLATION.md](docs/INSTALLATION.md) for pairing-code login, non-interactive setup, and first-run troubleshooting.

## Commands

Default prefix `.` — configurable through `BOT_PREFIXES`.

| Command | Aliases | Category | Access | Description |
| --- | --- | --- | --- | --- |
| `.menu` | `.help` | tools | everyone | Command navigation with a branding card and buttons |
| `.ping` | `.p` | tools | everyone | Liveness check and message processing time |
| `.sticker` | `.s`, `.stiker` | sticker | everyone | Image/video/GIF to sticker |
| `.dino` | `.dinorun` | games | everyone | Dino Run, rendered as an AIRich HTML primitive |
| `.ownermenu` | — | owner | owner | Owner control surface |
| `.botmode` | — | owner | owner | Show or change the access mode |
| `.setname` | — | owner | owner | Change the bot profile name |
| `.setabout` | — | owner | owner | Change the bot About text |
| `.setpp` | — | owner | owner | Set the profile photo from an image |
| `.delpp` | — | owner | owner | Remove the profile photo |
| `.setthumbnail` | — | owner | owner | Set the menu thumbnail from an image |
| `.delthumbnail` | — | owner | owner | Restore the default menu thumbnail |

[docs/USAGE.md](docs/USAGE.md) documents every command's inputs, replies, and cooldowns.

## Configuration

All configuration is environment variables, loaded with Node's own `--env-file`. There is no `dotenv` dependency.

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `BOT_OWNER_NUMBER` | yes | — | Owner number, digits with country code |
| `BOT_PREFIXES` | no | `.` | Comma-separated command prefixes |
| `BOT_AUTH_METHOD` | no | `auto` | `auto`, `qr`, or `pairing` |
| `BOT_PAIRING_NUMBER` | when pairing | — | Bot's own number for the link-code flow |
| `BOT_SESSION_ID` | no | `default` | Session key inside the store; do not change after pairing |
| `BOT_STORE_PATH` | no | `.auth/state.sqlite` | SQLite protocol store path |
| `BOT_LOG_LEVEL` | no | `info` | `trace`, `debug`, `info`, `warn`, `error` |
| `NODE_ENV` | no | `development` | `production` switches the logger to JSON lines |

Invalid values fail at startup with a named error rather than degrading silently. Details and derived paths are in [docs/CONFIGURATION.md](docs/CONFIGURATION.md).

## Project layout

```text
app/        Entry point: env, wiring, signal handling
lib/        Core: config, client, auth, routing, middleware, media, messages
plugins/    Commands, one file per command, grouped by category
tests/      Unit, integration, and e2e suites
docs/       Public documentation
```

`lib/` never imports a concrete plugin. Commands import from `lib/`; the dependency only points one way.

## Writing a plugin

```ts
// plugins/tools/hello.ts
import type { Command } from '../../lib/commands/command.js'

const hello = {
  name: 'hello',
  category: 'tools',
  description: 'Replies with a greeting.',
  cooldownMs: 3_000,
  async run(context) {
    await context.reply(`Hi ${context.pushName ?? 'there'}!`)
  },
} satisfies Command

export default hello
```

Save the file while the bot is running and the loader picks it up. The default export must be a `Command`; the file must satisfy the plugin policy. [docs/CREATING_PLUGINS.md](docs/CREATING_PLUGINS.md) covers the context API, the policy rules, and the button guidelines.

## Development

```bash
npm run dev            # tsx watch, no build step
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
npm test               # vitest run
npm run test:coverage  # vitest run --coverage
npm run check          # typecheck + lint + test
npm run build          # clean dist/, then tsc
```

New runtime behavior is written test-first: a failing test that proves the gap, then the implementation. See [docs/TESTING.md](docs/TESTING.md).

## Deployment

`ecosystem.config.cjs` runs the built entry under pm2 as a single instance. Two connections to the same account evict each other, so the instance count is not a tuning knob.

```bash
npm run build
pm2 start ecosystem.config.cjs
pm2 save
```

[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) covers pm2, restart policy, log locations, and backups.

## Security

- No `eval`, `new Function`, VM execution, or shell command built from chat input. `ffmpeg` is called with a fixed argv and `shell: false`.
- `.auth/`, `.env`, `.runtime/`, SQLite files, and logs are gitignored. Credentials, QR payloads, and pairing codes never reach the logger or a chat reply.
- Command bodies over 4096 bytes are not parsed. Sticker input is capped at 8 MiB while streaming, not after buffering.
- Errors reply with a generic sentence; details stay in the structured log.

Full model and threat notes: [docs/SECURITY.md](docs/SECURITY.md).

## Documentation

- [docs/INSTALLATION.md](docs/INSTALLATION.md) — install, login, first run
- [docs/CONFIGURATION.md](docs/CONFIGURATION.md) — environment variables and derived paths
- [docs/USAGE.md](docs/USAGE.md) — every command in detail
- [docs/CREATING_PLUGINS.md](docs/CREATING_PLUGINS.md) — plugin API and policy
- [docs/MESSAGE_BUILDERS.md](docs/MESSAGE_BUILDERS.md) — buttons, lists, branding cards, AIRich
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — pm2 and operations
- [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) — symptoms and fixes
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — module boundaries and data flow
- [docs/COMMAND_SPEC.md](docs/COMMAND_SPEC.md) — command contract
- [docs/TESTING.md](docs/TESTING.md) — test strategy
- [docs/SECURITY.md](docs/SECURITY.md) — security model

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md). Short version: `npm run check` must pass, new behavior needs a test written first, and dependencies are pinned to exact versions.

## License

MIT — see [LICENSE](LICENSE).

Not affiliated with, endorsed by, or connected to WhatsApp or Meta. Automating an account carries a ban risk; use an account you are willing to lose.
