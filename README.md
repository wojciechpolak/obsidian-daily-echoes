# Daily Echoes for Obsidian

An [Obsidian](https://obsidian.md) plugin that resurfaces your daily notes from
previous years in the sidebar, so you can revisit what you were doing _on this
day_, _this week_, _this month_, or on _this day-of-month_ across the years.

It is the Obsidian counterpart to the standalone
[On This Day](https://github.com/wojciechpolak/on-this-day) web app. Same idea,
except it reads your Obsidian daily notes instead of ICS calendars.

> The repository title includes "for Obsidian" for clarity. Inside Obsidian the
> plugin is listed as **Daily Echoes**.

<picture>
  <source
    media="(prefers-color-scheme: dark)"
    srcset="https://raw.githubusercontent.com/wojciechpolak/obsidian-daily-echoes/main/docs/img/screenshot-dark.webp"
  />
  <img
    src="https://raw.githubusercontent.com/wojciechpolak/obsidian-daily-echoes/main/docs/img/screenshot-light.webp"
    alt="The Daily Echoes panel in Obsidian's sidebar, in Day mode, listing daily notes from 22 July 2025, 2024 and 2023, each labelled 1, 2 and 3 years ago."
    width="400"
  />
</picture>

## Why

Other "on this day" plugins tend to match _every_ document in the vault, and
they give you a single "today" view. This one:

- Shows only your daily notes by default, with an optional switch to include
  other documents.
- Offers four time windows: Day, Week, Month, and Day-of-Month.
- Reads your dates straight from the core Daily notes settings, so there is
  nothing extra to configure and no date convention baked into the code.

## How it works

The plugin uses your Daily notes (or Periodic Notes) configuration to find daily
notes and parse each note's date from its filename. With the Daily notes format
`YYYY/YYYY-MM-DD` and folder `Log`, for example, a note at
`Log/2021/2021-07-20.md` is understood as _20 July 2021_.

An entry has to live under the configured daily-notes folder and parse as a
valid date. The plugin ignores everything else.

## Modes

| Mode          | Shows earlier entries that fall on                       |
| ------------- | -------------------------------------------------------- |
| Day (default) | the same month and day-of-month as today                 |
| Week          | within 3 days either side of today's date (7-day window) |
| Month         | the same calendar month as today                         |
| Day-of-Month  | the same day number (e.g. the 20th) of any month         |

Every entry is labelled with how long ago it was (e.g. _2 years ago_).

## Usage

- Click the calendar-clock ribbon icon, or run the "Daily Echoes: Open view"
  command, to open the panel in the right sidebar.
- Switch modes from the panel header, or use the per-mode commands.
- Click an entry to open that note. ⌘/Ctrl-click opens it in a new tab.

## Settings

- **Default mode:** which window opens first. Defaults to Day.
- **Include other notes:** also include notes that aren't daily notes, dated by
  a frontmatter date, the filename, or file creation time. Off by default.
- **Include current year:** also show earlier entries from the current year.
  Today's own note stays excluded either way. Off by default.
- **Preview:** none, a truncated snippet, or the full note.

## Privacy

Everything happens locally. The plugin makes no network requests and collects no
telemetry. It reads your daily notes through the paths the core Daily notes
settings already define. It walks every markdown file in the vault only when you
turn on Include other notes, because that setting asks it to date notes outside
the daily-notes folder.

## Installation

### From the community plugins browser

Once published, look for "Daily Echoes" under Settings → Community plugins →
Browse.

### Manual

1. Build the plugin (`npm ci && npm run build`) or download a release.
2. Copy `main.js`, `manifest.json`, and `styles.css` into
   `<your-vault>/.obsidian/plugins/daily-echoes/`.
3. Reload Obsidian and enable the plugin in Settings → Community plugins.

## Development

```bash
npm install
npm run dev     # watch build
npm run build   # type-check + production build
npm run lint    # oxlint
npm run format  # oxfmt
npm run test    # vitest (test:watch for watch mode)
npm run check   # lint + format check + build + test
npm run deploy  # build, then install into a local vault for testing
```

Linting and formatting use the [oxc](https://oxc.rs) toolchain (oxlint + oxfmt).

`npm run deploy` copies the built plugin straight into a vault. Create a
gitignored `.env` in the repo root pointing at your vault's plugins folder:

```
OBSIDIAN_VAULT_PLUGINS="/path/to/YourVault/.obsidian/plugins"
```

The destination subfolder comes from `manifest.json`'s `id`. Run
`./scripts/install-to-vault.sh --dry-run` to preview without writing.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[GPL-3.0-or-later](LICENSE).
