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
 * Assert that the three places a version is recorded agree with each other.
 * `npm version` keeps them in sync; a hand edit can silently drift, and the
 * mismatch would otherwise only surface when a release fails.
 *
 *   node scripts/check-versions.mjs
 */

import { readFileSync } from 'node:fs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}`, import.meta.url), 'utf8'));

const pkg = read('package.json');
const manifest = read('manifest.json');
const versions = read('versions.json');

const problems = [];
/** Set when the fix is "re-run npm version", as opposed to editing by hand. */
let versionDrift = false;

if (manifest.version !== pkg.version) {
    problems.push(
        `manifest.json version "${manifest.version}" != package.json version "${pkg.version}"`
    );
    versionDrift = true;
}

if (!versions[manifest.version]) {
    problems.push(
        `versions.json has no entry for "${manifest.version}" ` +
            `(it maps a plugin version to its minimum Obsidian version)`
    );
    versionDrift = true;
}

if (!manifest.minAppVersion) {
    problems.push('manifest.json is missing minAppVersion');
} else if (versions[manifest.version] && versions[manifest.version] !== manifest.minAppVersion) {
    problems.push(
        `versions.json["${manifest.version}"] is "${versions[manifest.version]}" ` +
            `but manifest.json minAppVersion is "${manifest.minAppVersion}"`
    );
}

if (manifest.id.includes('obsidian')) {
    problems.push(`plugin id "${manifest.id}" must not contain "obsidian"`);
}

if (problems.length > 0) {
    for (const problem of problems) {
        console.error(`error: ${problem}`);
    }
    if (versionDrift) {
        console.error('\nRun `npm version <x.y.z>` to keep these in sync.');
    }
    process.exit(1);
}

console.log(`Versions agree: ${manifest.version} (min Obsidian ${manifest.minAppVersion})`);
