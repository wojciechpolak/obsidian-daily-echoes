# Changelog

All notable changes to Daily Echoes for Obsidian will be documented in this
file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html) for public releases.

## [1.0.2] - 2026-07-22

### Added

- README now shows a screenshot of the panel, in light and dark variants.

### Fixed

- Entries from the previous calendar year are no longer labelled "earlier this
  year" when fewer than 365 days have passed. The "how long ago" label now uses
  the calendar-year difference, so a note from 24 July 2025 read on 22 July 2026
  correctly reads "1 year ago". This affected Week and Day-of-month, whose
  windows reach past today's month and day.
- Snippet previews no longer end in a stray `-…` when the truncation point lands
  on a list bullet or heading whose text falls outside the limit.

## [1.0.1] - 2026-07-21

### Added

- Release assets (`main.js`, `manifest.json`, `styles.css`) now carry GitHub
  artifact attestations, so their provenance can be verified with
  `gh attestation verify`.
- README now states what the plugin reads and that it makes no network requests.

### Fixed

- Saved settings are narrowed instead of merged from an `any`-typed value.
- `Moment` is imported as a type-only import in `otd.ts`, matching the other
  modules.
- The build no longer depends on the `builtin-modules` package; it uses
  `node:module`'s `builtinModules` instead.

## [1.0.0] - 2026-07-21

First release.

### Added

- Revisit your daily notes from previous years in the sidebar — on this day,
  this week, this month, or on this day-of-month.
- Uses your existing Daily notes settings, so your folder and date format work
  as they are.
- Shows only daily notes by default; other notes can be switched on in settings.
- Every entry shows how long ago it was, with a preview you can click to open.
