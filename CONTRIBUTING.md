# Contributing to YZF-BotWA

Thanks for helping. This project is a base other people fork, so a change that is convenient here but confusing downstream is not a good change.

## Ground rules

1. `npm run check` must pass before you open a pull request. It runs typecheck, lint, and the full test suite.
2. New runtime behavior needs a test written **before** the implementation. Run it, watch it fail for the right reason, then make it pass.
3. Dependencies are pinned to exact versions. No `^`, no `~`, no `latest`.
4. `lib/` must not import anything from `plugins/`. The dependency direction is one way.
5. Never commit `.auth/`, `.env`, `.runtime/`, SQLite files, QR payloads, or pairing codes. They are gitignored — keep it that way.

## Setup

```bash
npm ci
cp .env.example .env       # set BOT_OWNER_NUMBER
npm run check
```

`npm run dev` runs the TypeScript sources through `tsx watch`, so you do not need a build during development. `ffmpeg` must be on `PATH` for the sticker tests that exercise the real encoder.

## Workflow

```bash
npx vitest run tests/unit/features/your-command.test.ts   # the failing test first
# implement
npx vitest run tests/unit/features/your-command.test.ts   # green
npm run check                                             # everything else still green
```

Commit messages follow Conventional Commits: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`.

## Adding a command

One command per file under `plugins/<category>/<name>.ts`, default-exported.

```ts
import type { Command } from '../../lib/commands/command.js'

const example = {
  name: 'example',
  category: 'tools',
  description: 'One sentence, shown in the menu.',
  cooldownMs: 3_000,
  async run(context) {
    await context.reply('ok')
  },
} satisfies Command

export default example
```

Categories are fixed: `owner`, `group`, `tools`, `downloader`, `sticker`, `games`. Names and aliases must match `^[a-z0-9][a-z0-9-]*$` and must not collide with an existing trigger — the registry refuses to build otherwise.

The plugin policy is enforced by the static checker in `lib/commands/plugin-policy.ts`, not by review. It rejects:

- `eval`, `new Function`, `process`, `globalThis`, `require`, `createRequire`
- dynamic `import()`, tagged templates, decorators, class static blocks, getters/setters
- computed member access (`obj[key]`) and `.constructor` access
- imports other than relative paths, `zapo-js`, `node:crypto`, `node:fs`, `node:stream`
- top-level statements with side effects, and top-level initializers that are not pure

Details and the reasoning behind each rule: [docs/CREATING_PLUGINS.md](docs/CREATING_PLUGINS.md).

## Buttons

Buttons exist to complete an action or open a useful menu in one tap. Before adding one, check all four:

- One tap finishes the action, or opens navigation the user actually wants.
- The command needs no text argument and no attachment. If it does, document it as a command instead.
- The action is not destructive without a confirmation step.
- The button changes something. A button that re-renders the current state is noise — `.botmode` omits the active mode for exactly this reason.

## Tests

- `tests/unit/` — one module, no I/O. Inject clocks, randomness, and filesystem operations.
- `tests/integration/` — several modules together: router, loader, plugin policy.
- `tests/e2e/` — the bot against `@zapo-js/fake-server`.

A test that asserts an encoded payload proves encoding, not rendering. Do not describe wire-level assertions as proof that something renders on a phone.

## Documentation

Update the docs your change affects, and keep `README.md` and `README_ID.md` saying the same thing. Adding a command means updating the command tables in both, plus `docs/USAGE.md`.

## Reporting bugs

Include the command, the observed behavior, the expected behavior, Node version, OS, and the relevant log lines. Scrub numbers and message content before pasting. Never paste `.auth/` contents, a QR payload, or a pairing code into an issue.

## Security issues

Do not open a public issue for a vulnerability. Report it privately to the maintainer and allow time for a fix before disclosure.

## License

Contributions are licensed under [MIT](LICENSE), the same as the project.
