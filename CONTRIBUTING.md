# Contributing

Thanks for helping improve Daily Echoes for Obsidian.

Bug reports and small fixes are welcome. For anything larger, please open an
issue first — it saves you writing code that may not fit the plugin's scope.

## Scope

The plugin deliberately shows **daily notes only** by default. Including other
documents is an opt-in setting and should stay that way; keeping the panel free
of unrelated notes is the whole point.

## Getting set up

```bash
npm install
npm run dev     # watch build
```

To try your build in a real vault, create a `.env` in the repo root:

```
OBSIDIAN_VAULT_PLUGINS="/path/to/YourVault/.obsidian/plugins"
```

then run `npm run deploy`. Obsidian does not hot-reload — toggle the plugin off
and on, or reload the vault, to pick up a new build.

## Before opening a pull request

```bash
npm run check   # versions, lint, format, build, tests — CI runs the same
```

A few things worth knowing:

- **Put new logic in a pure module** (`src/otd.ts`, `src/dates.ts`,
  `src/text.ts`) rather than inline in `src/view.ts`. Anything that imports
  `obsidian` cannot be unit-tested, so pure modules are where the tests live.
- Formatting is handled by `npm run format` (oxfmt) — don't hand-align or
  hand-wrap prose.
- UI text uses sentence case, matching Obsidian's style guide.
- Add a note under `## [Unreleased]` in `CHANGELOG.md` if the change is
  user-visible.

## License

By contributing, you agree that your contributions are licensed under the
[GPL-3.0-or-later](LICENSE) license that covers this project.
