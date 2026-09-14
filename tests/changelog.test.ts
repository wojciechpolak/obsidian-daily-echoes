/// <reference types="node" />

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

import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { releaseUnreleased, today } from '../scripts/changelog.mjs';

const PREAMBLE = `# Changelog

All notable changes to Daily Echoes for Obsidian will be documented in this
file.
`;

const changelog = (unreleased: string) =>
    `${PREAMBLE}
## [Unreleased]
${unreleased}
## [1.0.4] - 2026-08-19

### Changed

- Upgrade dependencies
`;

describe('releaseUnreleased', () => {
    it('renames the Unreleased heading and leaves an empty one above it', () => {
        const released = releaseUnreleased(
            changelog('\n### Fixed\n\n- Count the real gap across New Year\n'),
            '1.0.5',
            '2026-09-14'
        );

        expect(released).toBe(
            `${PREAMBLE}
## [Unreleased]

## [1.0.5] - 2026-09-14

### Fixed

- Count the real gap across New Year

## [1.0.4] - 2026-08-19

### Changed

- Upgrade dependencies
`
        );
    });

    it('touches nothing outside the heading it replaces', () => {
        const before = changelog('\n### Added\n\n- A thing\n');
        const after = releaseUnreleased(before, '1.0.5', '2026-09-14');

        expect(after.replace('## [Unreleased]\n\n## [1.0.5] - 2026-09-14', '## [Unreleased]')).toBe(
            before
        );
    });

    it('refuses to release when there is no Unreleased section', () => {
        const noUnreleased = `${PREAMBLE}
## [1.0.4] - 2026-08-19

### Changed

- Upgrade dependencies
`;

        expect(() => releaseUnreleased(noUnreleased, '1.0.5', '2026-09-14')).toThrow(
            /no "## \[Unreleased\]" section/
        );
    });

    it('refuses to release when the Unreleased section is empty', () => {
        expect(() => releaseUnreleased(changelog('\n'), '1.0.5', '2026-09-14')).toThrow(/is empty/);
    });

    it('dates sections the way the existing headings are dated', () => {
        expect(today(new Date(2026, 8, 4))).toBe('2026-09-04');
    });
});

describe('release-changelog', () => {
    /**
     * The release workflow gates on `changelog-section.mjs <tag>`, so a section
     * this script writes has to be one that script can find and print.
     */
    it('writes a section changelog-section.mjs can read back', () => {
        const workDir = mkdtempSync(join(tmpdir(), 'daily-echoes-release-changelog-'));
        const scripts = resolve(import.meta.dirname, '..', 'scripts');

        try {
            cpSync(scripts, join(workDir, 'scripts'), { recursive: true });
            writeFileSync(
                join(workDir, 'CHANGELOG.md'),
                changelog('\n### Fixed\n\n- Count the real gap across New Year\n')
            );

            execFileSync(
                process.execPath,
                [join(workDir, 'scripts', 'release-changelog.mjs'), '--version', '1.0.5'],
                { cwd: workDir }
            );

            const notes = execFileSync(
                process.execPath,
                [join(workDir, 'scripts', 'changelog-section.mjs'), '1.0.5'],
                { cwd: workDir, encoding: 'utf8' }
            );

            expect(notes.trim()).toBe('### Fixed\n\n- Count the real gap across New Year');
        } finally {
            rmSync(workDir, { recursive: true, force: true });
        }
    });
});
