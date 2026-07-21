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
import { describe, expect, it } from 'vitest';
import { WEEK_RADIUS_DAYS, filterEntries, matchesMode, relativeLabel } from '../src/otd';
import { DEFAULT_SETTINGS, OtdEntry, OtdMode } from '../src/types';

const d = (iso: string) => moment(iso, 'YYYY-MM-DD', true).startOf('day');

/** Build an entry; the file is a stub since the date logic never touches it. */
const entry = (iso: string, isDailyNote = true): OtdEntry =>
    ({ file: { path: `Log/${iso}.md` }, date: d(iso), isDailyNote }) as unknown as OtdEntry;

const paths = (entries: { file: { path: string } }[]) => entries.map((e) => e.file.path);

describe('default settings', () => {
    it('shows previous years only on first run', () => {
        expect(DEFAULT_SETTINGS.includeCurrentYear).toBe(false);
    });
});

describe('matchesMode', () => {
    const today = d('2026-07-21'); // Tuesday, ISO week 30

    describe('Day', () => {
        it('matches the same month and day in another year', () => {
            expect(matchesMode(d('2025-07-21'), today, OtdMode.Day)).toBe(true);
            expect(matchesMode(d('2019-07-21'), today, OtdMode.Day)).toBe(true);
        });

        it('rejects a different day or a different month', () => {
            expect(matchesMode(d('2025-07-20'), today, OtdMode.Day)).toBe(false);
            expect(matchesMode(d('2025-08-21'), today, OtdMode.Day)).toBe(false);
        });
    });

    describe('Week', () => {
        it('covers exactly WEEK_RADIUS_DAYS either side of today', () => {
            expect(matchesMode(d('2025-07-18'), today, OtdMode.Week)).toBe(true);
            expect(matchesMode(d('2025-07-24'), today, OtdMode.Week)).toBe(true);
            expect(matchesMode(d('2025-07-17'), today, OtdMode.Week)).toBe(false);
            expect(matchesMode(d('2025-07-25'), today, OtdMode.Week)).toBe(false);
        });

        it('stays anchored to the time of year as years pass', () => {
            // Regression: ISO week numbers drift 1-2 days per calendar year, so
            // week-number matching dropped these even though they are seasonally
            // the same time of year.
            expect(matchesMode(d('2025-07-20'), today, OtdMode.Week)).toBe(true);
            expect(matchesMode(d('2024-07-19'), today, OtdMode.Week)).toBe(true);
            expect(matchesMode(d('2023-07-23'), today, OtdMode.Week)).toBe(true);
        });

        it('wraps across New Year', () => {
            const newYear = d('2026-01-02');
            expect(matchesMode(d('2025-12-31'), newYear, OtdMode.Week)).toBe(true);
            expect(matchesMode(d('2025-12-30'), newYear, OtdMode.Week)).toBe(true);
            expect(matchesMode(d('2024-12-31'), newYear, OtdMode.Week)).toBe(true);
            expect(matchesMode(d('2025-12-29'), newYear, OtdMode.Week)).toBe(false);
        });

        it('wraps in the other direction too', () => {
            const yearEnd = d('2026-12-30');
            expect(matchesMode(d('2025-01-01'), yearEnd, OtdMode.Week)).toBe(true);
            expect(matchesMode(d('2025-01-03'), yearEnd, OtdMode.Week)).toBe(false);
        });

        it('handles a leap day without blowing up', () => {
            // Feb 29 has no counterpart in 2026; moment clamps to Feb 28.
            expect(matchesMode(d('2024-02-29'), d('2026-03-01'), OtdMode.Week)).toBe(true);
            expect(matchesMode(d('2024-02-29'), d('2026-03-05'), OtdMode.Week)).toBe(false);
        });

        it('gives a window of 2 * radius + 1 days', () => {
            const hits = Array.from({ length: 21 }, (_, i) =>
                d('2025-07-11').clone().add(i, 'days')
            ).filter((candidate) => matchesMode(candidate, today, OtdMode.Week));
            expect(hits).toHaveLength(2 * WEEK_RADIUS_DAYS + 1);
        });
    });

    describe('Month', () => {
        it('matches any day of the same calendar month', () => {
            expect(matchesMode(d('2025-07-01'), today, OtdMode.Month)).toBe(true);
            expect(matchesMode(d('2025-07-31'), today, OtdMode.Month)).toBe(true);
            expect(matchesMode(d('2025-06-30'), today, OtdMode.Month)).toBe(false);
        });
    });

    describe('DayOfMonth', () => {
        it('matches the same day number in any month', () => {
            expect(matchesMode(d('2025-01-21'), today, OtdMode.DayOfMonth)).toBe(true);
            expect(matchesMode(d('2025-11-21'), today, OtdMode.DayOfMonth)).toBe(true);
            expect(matchesMode(d('2025-11-22'), today, OtdMode.DayOfMonth)).toBe(false);
        });
    });
});

describe('filterEntries', () => {
    const today = d('2026-07-21');

    it('returns nothing for an empty vault', () => {
        expect(filterEntries([], today, OtdMode.Day, true)).toEqual([]);
    });

    it("excludes today's own note", () => {
        const result = filterEntries([entry('2026-07-21')], today, OtdMode.Day, true);
        expect(result).toEqual([]);
    });

    it('excludes future-dated notes', () => {
        const result = filterEntries(
            [entry('2027-07-21'), entry('2026-07-22')],
            today,
            OtdMode.Day,
            true
        );
        expect(result).toEqual([]);
    });

    it('excludes the current year when includeCurrentYear is false', () => {
        const entries = [entry('2026-07-20'), entry('2025-07-20')];
        expect(paths(filterEntries(entries, today, OtdMode.Week, false))).toEqual([
            'Log/2025-07-20.md',
        ]);
    });

    it('includes the current year when includeCurrentYear is true', () => {
        const entries = [entry('2026-07-20'), entry('2025-07-20')];
        expect(paths(filterEntries(entries, today, OtdMode.Week, true))).toEqual([
            'Log/2026-07-20.md',
            'Log/2025-07-20.md',
        ]);
    });

    it('sorts most recent first', () => {
        const entries = [entry('2022-07-21'), entry('2025-07-21'), entry('2019-07-21')];
        expect(paths(filterEntries(entries, today, OtdMode.Day, true))).toEqual([
            'Log/2025-07-21.md',
            'Log/2022-07-21.md',
            'Log/2019-07-21.md',
        ]);
    });

    it('reports whole years elapsed', () => {
        const result = filterEntries(
            [entry('2025-07-21'), entry('2020-07-21'), entry('2026-07-14')],
            today,
            OtdMode.Month,
            true
        );
        const byPath = Object.fromEntries(result.map((m) => [m.file.path, m.yearsAgo]));
        expect(byPath['Log/2025-07-21.md']).toBe(1);
        expect(byPath['Log/2020-07-21.md']).toBe(6);
        expect(byPath['Log/2026-07-14.md']).toBe(0);
    });

    it('keeps non-daily notes flagged so the view can badge them', () => {
        const result = filterEntries(
            [entry('2025-07-21', false), entry('2024-07-21', true)],
            today,
            OtdMode.Day,
            true
        );
        expect(result.map((m) => m.isDailyNote)).toEqual([false, true]);
    });

    it('does not mutate the input entries', () => {
        const original = entry('2025-07-21');
        const before = original.date.format();
        filterEntries([original], today, OtdMode.Day, true);
        expect(original.date.format()).toBe(before);
    });
});

const label = (yearsAgo: number) => relativeLabel({ yearsAgo } as never);

describe('relativeLabel', () => {
    it('renders singular, plural, and same-year cases', () => {
        expect(label(0)).toBe('earlier this year');
        expect(label(1)).toBe('1 year ago');
        expect(label(2)).toBe('2 years ago');
        expect(label(17)).toBe('17 years ago');
    });
});
