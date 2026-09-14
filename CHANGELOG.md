# Changelog

All notable changes to Daily Echoes for Obsidian will be documented in this
file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html) for public releases.

## [Unreleased]

### Fixed

- Recent entries no longer all read "earlier this year". The "how long ago"
  label now counts in days, weeks, months or years, so a note from yesterday
  reads "yesterday" and one from three days ago reads "3 days ago". Week, Month
  and Day-of-month surface such entries once "Include current year" is on.
- A short gap across New Year now counts the real gap. A note from 31 December
  read on 2 January says "2 days ago" instead of "1 year ago". Entries near an
  anniversary still round up to whole years, so 363 days remains "1 year ago".

## [1.0.4] - 2026-08-19

### Changed

- Upgrade dependencies

## [1.0.3] - 2026-07-26

### Fixed

- Snippet previews no longer show raw markup when the snippet length cuts
  through a link. A half-written `[label](url` or `[[wikilink` is now unwrapped
  to its plain label, and an image or embed left without its target is dropped.

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
