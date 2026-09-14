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
 * Pure helpers for reading and rewriting CHANGELOG.md, shared by
 * changelog-section.mjs (which reads a section) and release-changelog.mjs
 * (which renames the Unreleased one). Keeping both on the same section
 * boundaries means a section this file writes is always one the release
 * workflow can find.
 */

/** A section ends at the next "## " heading... */
export const isHeading = (line) => /^##\s/.test(line);

/**
 * ...or at the trailing block of link reference definitions
 * ("[1.0.0]: https://...") that Keep a Changelog puts at the bottom of the file.
 * The URL may sit on a continuation line (oxfmt wraps long ones), so the label
 * line can end right after the colon.
 */
export const isLinkDefinition = (line) => /^\[[^\]]+\]:(\s|$)/.test(line);

/**
 * Index of the "## [label]" heading, or -1. Matches "## [1.0.1]" and
 * "## [1.0.1] - 2026-07-21", the two forms a released section can take.
 */
export function findSectionStart(lines, label) {
    const heading = `## [${label}]`;
    return lines.findIndex((line) => line === heading || line.startsWith(`${heading} - `));
}

/** The section's body, trimmed. Empty string when the section has no content. */
export function sectionBody(lines, start) {
    const rest = lines.slice(start + 1);
    const end = rest.findIndex((line) => isHeading(line) || isLinkDefinition(line));
    return (end === -1 ? rest : rest.slice(0, end)).join('\n').trim();
}

/**
 * Turn the "## [Unreleased]" section into a released one, leaving a fresh empty
 * "## [Unreleased]" above it for the next cycle. Throws when there is nothing to
 * release, because the release workflow rejects a missing or empty section
 * anyway and failing here is faster than failing in CI.
 */
export function releaseUnreleased(text, version, date) {
    const lines = text.split('\n');
    const start = findSectionStart(lines, 'Unreleased');

    if (start === -1) {
        throw new Error(
            'CHANGELOG.md has no "## [Unreleased]" section. ' +
                'Add one with the changes this release contains.'
        );
    }
    if (!sectionBody(lines, start)) {
        throw new Error(
            'The "## [Unreleased]" section in CHANGELOG.md is empty. ' +
                'A release cannot go out undocumented.'
        );
    }

    lines.splice(start, 1, '## [Unreleased]', '', `## [${version}] - ${date}`);
    return lines.join('\n');
}

const pad = (n) => String(n).padStart(2, '0');

/** Today's local date as YYYY-MM-DD, matching the existing section headings. */
export function today(now = new Date()) {
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
