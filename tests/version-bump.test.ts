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
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('version-bump', () => {
    it('keeps generated metadata formatter-compliant', () => {
        const workDir = mkdtempSync(join(tmpdir(), 'daily-echoes-version-bump-'));
        const script = resolve(import.meta.dirname, '..', 'version-bump.mjs');

        try {
            writeFileSync(
                join(workDir, 'manifest.json'),
                JSON.stringify(
                    {
                        id: 'daily-echoes',
                        version: '1.0.0',
                        minAppVersion: '1.7.2',
                    },
                    null,
                    4
                ) + '\n'
            );
            writeFileSync(join(workDir, 'versions.json'), '{\n    "1.0.0": "1.7.2"\n}\n');

            execFileSync(process.execPath, [script], {
                cwd: workDir,
                env: { ...process.env, npm_package_version: '1.0.1' },
            });

            expect(readFileSync(join(workDir, 'manifest.json'), 'utf8')).toContain(
                '    "version": "1.0.1"'
            );
            expect(readFileSync(join(workDir, 'versions.json'), 'utf8')).toBe(
                '{\n    "1.0.0": "1.7.2",\n    "1.0.1": "1.7.2"\n}\n'
            );
        } finally {
            rmSync(workDir, { recursive: true, force: true });
        }
    });
});
