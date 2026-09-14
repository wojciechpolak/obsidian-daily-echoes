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
import { findSectionStart, sectionBody } from './changelog.mjs';

const version = process.argv[2];
if (!version) {
    console.error('usage: node scripts/changelog-section.mjs <version>');
    process.exit(2);
}

const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
const lines = changelog.split('\n');
const start = findSectionStart(lines, version);

if (start === -1) {
    console.error(`error: CHANGELOG.md has no section for version ${version}.`);
    console.error(`Add a "## [${version}] - YYYY-MM-DD" heading before releasing.`);
    process.exit(1);
}

const body = sectionBody(lines, start);

if (!body) {
    console.error(`error: the CHANGELOG.md section for ${version} is empty.`);
    process.exit(1);
}

console.log(body);
