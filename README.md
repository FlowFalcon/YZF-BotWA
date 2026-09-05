# YZF-BotWA

A modular WhatsApp bot base built with TypeScript and [`zapo-js`](https://www.npmjs.com/package/zapo-js).

[Bahasa Indonesia](README_ID.md)

## Features

- TypeScript plugins, one command per file under `plugins/`.
- Hot reload with source validation and atomic registry replacement.
- `public`, `group-only`, and `owner-only` access modes.
- Flood control, cooldowns, permissions, and structured logging.
- Group administration, stickers, reply cards, media, and AIRich HTML.
- SQLite sessions; configuration and sensitive state stay outside Git.

## Requirements

- Node.js `>=20.9.0`
- `ffmpeg` on `PATH` for stickers
- A WhatsApp account for the bot

## Quick start

```bash
git clone https://github.com/FlowFalcon/YZF-BotWA.git
cd YZF-BotWA
npm ci
cp .env.example .env
# Set BOT_OWNER_NUMBER in .env
npm run check
npm run build
npm start
```

The bot starts in `owner-only` mode. The owner can run `.botmode public`.

## Commands

The default prefix is `.` and can be changed with `BOT_PREFIXES`.

- **Tools:** `menu`, `ping`, `qrcode`, `ssweb`, `hd`
- **Sticker:** `sticker`
- **Games:** `dino`
- **Group:** `groupmenu`, `add`, `kick`, `promote`, `demote`, `hidetag`, `tagall`, `gcname`, `gcdesc`, `linkgroup`, `group`
- **Owner:** `ownermenu`, `botmode`, `ban`, `unban`, `banchat`, `unbanchat`, `banlist`, `setname`, `setabout`, `setpp`, `delpp`, `setthumbnail`, `delthumbnail`

Run `.menu`, `.groupmenu`, or `.ownermenu` for usage matching the caller's access.

## Configuration

| Variable | Required | Default |
| --- | --- | --- |
| `BOT_OWNER_NUMBER` | Yes | — |
| `BOT_PREFIXES` | No | `.` |
| `BOT_AUTH_METHOD` | No | `auto` |
| `BOT_PAIRING_NUMBER` | Pairing only | — |
| `BOT_SESSION_ID` | No | `default` |
| `BOT_STORE_PATH` | No | `.auth/state.sqlite` |
| `BOT_LOG_LEVEL` | No | `info` |
| `NODE_ENV` | No | `development` |

## Project structure

```text
app/        Entry point and dependency wiring
lib/        Shared runtime, contracts, routing, media, and storage
plugins/    Commands; command-specific implementation stays in its plugin
scripts/    Build and validation scripts
tests/      Unit, integration, and end-to-end tests
```

`lib/` never imports concrete plugins. Helpers specific to one command stay in that command's plugin; `lib/` contains capabilities shared across commands or the runtime.

## Writing a plugin

```ts
import type { Command } from '../../lib/commands/command.js'

const hello = {
  name: 'hello',
  category: 'tools',
  description: 'Replies with a greeting.',
  async run(context) {
    await context.reply(`Hi ${context.pushName ?? 'there'}!`)
  },
} satisfies Command

export default hello
```

## Development

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run check
```

## Third-party privacy

- `qrcode` sends its text to QuickChart.
- `ssweb` sends the target URL to thum.io.
- `hd` uploads its image to iloveimg.

Do not use these commands for sensitive data. See [docs/SECURITY.md](docs/SECURITY.md) for security boundaries.

## License

MIT — see [LICENSE](LICENSE).

This project is not affiliated with WhatsApp or Meta. Account automation may carry a restriction risk.
