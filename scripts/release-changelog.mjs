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
 * Rename CHANGELOG.md's "## [Unreleased]" heading to the version being released
 * and leave a fresh empty "## [Unreleased]" above it. Run from the `version`
 * npm lifecycle hook, where npm_package_version is already the new version.
 *
 *   node scripts/release-changelog.mjs                  # rewrite in place
 *   node scripts/release-changelog.mjs --check          # validate only
 *   node scripts/release-changelog.mjs --version 1.2.3  # outside npm version
 *   node scripts/release-changelog.mjs --dry-run        # print, don't write
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { findSectionStart, releaseUnreleased, sectionBody, today } from './changelog.mjs';

const usage = `Rename CHANGELOG.md's "## [Unreleased]" section to a released version.

Usage:
  node scripts/release-changelog.mjs                  rewrite in place
  node scripts/release-changelog.mjs --check          validate only, write nothing
  node scripts/release-changelog.mjs --version 1.2.3  set the version explicitly
  node scripts/release-changelog.mjs --dry-run        print the result, write nothing

The version defaults to npm_package_version, which npm sets in the \`version\` hook.`;

let check = false;
let dryRun = false;
let version = process.env.npm_package_version;

for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    switch (arg) {
        case '--check':
            check = true;
            break;
        case '--dry-run':
            dryRun = true;
            break;
        case '--version':
            version = process.argv[++i];
            break;
        case '-h':
        case '--help':
            console.log(usage);
            process.exit(0);
            break;
        default:
            console.error(`error: unknown option '${arg}' (try --help)`);
            process.exit(2);
    }
}

const changelogUrl = new URL('../CHANGELOG.md', import.meta.url);
const changelog = readFileSync(changelogUrl, 'utf8');

// --check runs from `preversion`, where npm_package_version is still the old
// version, so it validates the section without naming one.
if (check) {
    const lines = changelog.split('\n');
    const start = findSectionStart(lines, 'Unreleased');

    if (start === -1) {
        console.error('error: CHANGELOG.md has no "## [Unreleased]" section.');
        console.error('Add one with the changes this release contains.');
        process.exit(1);
    }
    if (!sectionBody(lines, start)) {
        console.error('error: the "## [Unreleased]" section in CHANGELOG.md is empty.');
        console.error('A release cannot go out undocumented.');
        process.exit(1);
    }

    console.log('CHANGELOG.md has an Unreleased section ready to release.');
    process.exit(0);
}

if (!version) {
    console.error('error: no version given.');
    console.error('Pass --version <x.y.z>, or run this through `npm version`.');
    process.exit(2);
}
if (!/^\d+\.\d+\.\d+$/.test(version)) {
    console.error(`error: '${version}' is not a x.y.z version.`);
    process.exit(2);
}

let released;
try {
    released = releaseUnreleased(changelog, version, today());
} catch (error) {
    console.error(`error: ${error.message}`);
    process.exit(1);
}

if (dryRun) {
    process.stdout.write(released);
} else {
    writeFileSync(changelogUrl, released);
    console.log(`CHANGELOG.md: released ${version}.`);
}
