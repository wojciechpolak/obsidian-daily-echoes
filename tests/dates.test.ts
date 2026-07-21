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

import moment from 'moment';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { deriveDate } from '../src/dates';

// Obsidian exposes moment as a global; mirror that for the tests.
beforeAll(() => {
    (globalThis as { window?: unknown }).window = { moment };
});

const CTIME = moment('2015-05-05', 'YYYY-MM-DD').valueOf();
const iso = (basename: string, frontmatter?: Record<string, unknown>) =>
    deriveDate(frontmatter, basename, CTIME).format('YYYY-MM-DD');

describe('deriveDate', () => {
    describe('frontmatter takes precedence', () => {
        it('reads a date string', () => {
            expect(iso('untitled', { date: '2024-03-09' })).toBe('2024-03-09');
        });

        it('reads a Date object', () => {
            expect(iso('untitled', { date: new Date('2024-03-09T12:00:00Z') })).toBe('2024-03-09');
        });

        it('falls through the key list in order', () => {
            expect(iso('untitled', { created: '2022-01-02' })).toBe('2022-01-02');
            expect(iso('untitled', { day: '2021-06-07' })).toBe('2021-06-07');
        });

        it('prefers "date" over the later keys', () => {
            expect(iso('untitled', { day: '2021-06-07', date: '2024-03-09' })).toBe('2024-03-09');
        });

        it('wins over a date in the filename', () => {
            expect(iso('2019-12-25', { date: '2024-03-09' })).toBe('2024-03-09');
        });

        it('ignores null, empty and unparseable values', () => {
            expect(iso('2019-12-25', { date: null })).toBe('2019-12-25');
            expect(iso('2019-12-25', { date: 'not a date' })).toBe('2019-12-25');
            expect(iso('2019-12-25', { date: '' })).toBe('2019-12-25');
        });

        it('accepts ISO date and date-time strings', () => {
            expect(iso('untitled', { date: '2024-03-09' })).toBe('2024-03-09');
            expect(iso('untitled', { date: '2024-03-09T14:30:00' })).toBe('2024-03-09');
            expect(iso('untitled', { date: '20240309' })).toBe('2024-03-09');
        });

        it('parses strictly, without moment falling back to new Date()', () => {
            // Regression: the lenient parser accepted junk via `new Date()`,
            // which varies by engine and logs a deprecation warning. Anything
            // unrecognised must fall through to the filename instead.
            const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            for (const junk of ['not a date', 'March 9th', 'someday', '9/3/2024']) {
                expect(iso('2019-12-25', { date: junk })).toBe('2019-12-25');
            }
            expect(consoleWarn).not.toHaveBeenCalled();
            consoleWarn.mockRestore();
        });
    });

    describe('filename fallback', () => {
        it('parses the supported formats', () => {
            expect(iso('2019-12-25')).toBe('2019-12-25');
            expect(iso('20191225')).toBe('2019-12-25');
        });

        it('is strict — a name that merely contains digits is not a date', () => {
            expect(iso('meeting-notes-3')).toBe('2015-05-05'); // falls back to ctime
            expect(iso('2019-13-45')).toBe('2015-05-05');
        });
    });

    describe('ctime fallback', () => {
        it('is used when nothing else yields a date', () => {
            expect(iso('untitled')).toBe('2015-05-05');
            expect(iso('untitled', {})).toBe('2015-05-05');
        });
    });

    it('always returns a valid moment', () => {
        expect(deriveDate(undefined, 'untitled', CTIME).isValid()).toBe(true);
        expect(deriveDate({ date: 'nonsense' }, 'nonsense', CTIME).isValid()).toBe(true);
    });
});
