/**
 * Daily Echoes for Obsidian
 * Copyright (C) 2026 Wojciech Polak
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * Print the CHANGELOG.md section for a given version, for use as GitHub release
 * notes. Exits non-zero when the section is missing or empty, so a release
 * cannot go out undocumented.
 *
 *   node scripts/changelog-section.mjs 1.0.1
 */

import { readFileSync } from 'node:fs';

const version = process.argv[2];
if (!version) {
    console.error('usage: node scripts/changelog-section.mjs <version>');
    process.exit(2);
}

const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
const lines = changelog.split('\n');

// Match "## [1.0.1] - 2026-07-21" and "## [1.0.1]", but not "## [Unreleased]".
const isHeading = (line) => /^##\s/.test(line);
const versionHeading = `## [${version}]`;
const start = lines.findIndex(
    (line) => line === versionHeading || line.startsWith(`${versionHeading} - `)
);

if (start === -1) {
    console.error(`error: CHANGELOG.md has no section for version ${version}.`);
    console.error(`Add a "## [${version}] - YYYY-MM-DD" heading before releasing.`);
    process.exit(1);
}

// A section ends at the next "## " heading, or at the trailing block of link
// reference definitions ("[1.0.0]: https://...") that Keep a Changelog puts at
// the bottom of the file.
// The URL may sit on a continuation line (oxfmt wraps long ones), so the label
// line can end right after the colon.
const isLinkDefinition = (line) => /^\[[^\]]+\]:(\s|$)/.test(line);
const rest = lines.slice(start + 1);
const end = rest.findIndex((line) => isHeading(line) || isLinkDefinition(line));
const body = (end === -1 ? rest : rest.slice(0, end)).join('\n').trim();

if (!body) {
    console.error(`error: the CHANGELOG.md section for ${version} is empty.`);
    process.exit(1);
}

console.log(body);
