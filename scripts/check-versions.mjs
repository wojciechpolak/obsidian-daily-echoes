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

/** Compare dotted numeric versions: negative, zero or positive like a sort comparator. */
function compareVersions(a, b) {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
        if (diff !== 0) {
            return diff;
        }
    }
    return 0;
}

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
    const recorded = versions[manifest.version];
    if (compareVersions(manifest.minAppVersion, recorded) > 0) {
        // A raised minAppVersion waiting for the next release, which records it
        // under the new version. Rewriting the released entry instead would cut
        // users on older Obsidian off from the release they can still install.
        console.log(
            `note: minAppVersion "${manifest.minAppVersion}" is newer than ` +
                `versions.json["${manifest.version}"] ("${recorded}"); the next release records it`
        );
    } else {
        problems.push(
            `versions.json["${manifest.version}"] is "${recorded}" ` +
                `but manifest.json minAppVersion is "${manifest.minAppVersion}"`
        );
    }
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
