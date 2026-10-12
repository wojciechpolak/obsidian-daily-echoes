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
import {
    WEEK_RADIUS_DAYS,
    adjacentYears,
    entriesInYear,
    filterEntries,
    groupByMonth,
    matchesMode,
    pickYear,
    relativeLabel,
    shiftAnchor,
    windowLabel,
    yearsWithEntries,
} from '../src/otd';
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

    it('reports the calendar-year difference', () => {
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

    it('counts last year as a year ago even when under 365 days have passed', () => {
        // 24 July 2025 is 363 days before 21 July 2026. Counting elapsed whole
        // years would round that to 0 and label it "earlier this year".
        const result = filterEntries([entry('2025-07-24')], today, OtdMode.Week, false);
        expect(result.map((m) => m.yearsAgo)).toEqual([1]);
        expect(relativeLabel(result[0].date, today)).toBe('1 year ago');
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

    it('measures the window around the anchor, not today', () => {
        const entries = [entry('2025-07-21'), entry('2025-07-25'), entry('2024-07-25')];
        const anchor = d('2026-07-25');
        expect(paths(filterEntries(entries, today, OtdMode.Day, false, anchor))).toEqual([
            'Log/2025-07-25.md',
            'Log/2024-07-25.md',
        ]);
    });

    it('keeps the cut-off at the real today when the anchor moves ahead', () => {
        // Stepping forward in Day mode must not surface today's note or
        // anything future-dated, even with the current year included.
        const entries = [entry('2026-07-22'), entry('2025-07-22')];
        const anchor = d('2026-07-22');
        expect(paths(filterEntries(entries, today, OtdMode.Day, true, anchor))).toEqual([
            'Log/2025-07-22.md',
        ]);
    });

    it('does not mutate the input entries', () => {
        const original = entry('2025-07-21');
        const before = original.date.format();
        filterEntries([original], today, OtdMode.Day, true);
        expect(original.date.format()).toBe(before);
    });
});

const isoOf = (m: moment.Moment) => m.format('YYYY-MM-DD');

describe('shiftAnchor', () => {
    const today = d('2026-07-21');

    it('steps one day in Day and Day-of-month mode', () => {
        expect(isoOf(shiftAnchor(today, OtdMode.Day, -1))).toBe('2026-07-20');
        expect(isoOf(shiftAnchor(today, OtdMode.DayOfMonth, 11))).toBe('2026-08-01');
    });

    it('steps seven days in Week mode', () => {
        expect(isoOf(shiftAnchor(today, OtdMode.Week, 2))).toBe('2026-08-04');
        expect(isoOf(shiftAnchor(today, OtdMode.Week, -1))).toBe('2026-07-14');
    });

    it('steps whole months without drifting off the 31st', () => {
        const endOfJan = d('2026-01-31');
        expect(isoOf(shiftAnchor(endOfJan, OtdMode.Month, 1))).toBe('2026-02-28');
        expect(isoOf(shiftAnchor(endOfJan, OtdMode.Month, 2))).toBe('2026-03-31');
        expect(isoOf(shiftAnchor(endOfJan, OtdMode.Month, -2))).toBe('2025-11-30');
    });

    it('returns today at zero steps and leaves the input alone', () => {
        expect(isoOf(shiftAnchor(today, OtdMode.Day, 0))).toBe('2026-07-21');
        expect(isoOf(today)).toBe('2026-07-21');
    });
});

describe('windowLabel', () => {
    it('names the day or the month', () => {
        expect(windowLabel(d('2026-07-21'), OtdMode.Day)).toBe('21 July');
        expect(windowLabel(d('2026-07-21'), OtdMode.Month)).toBe('July');
        expect(windowLabel(d('2026-07-21'), OtdMode.DayOfMonth)).toBe('Day 21 of the month');
    });

    it('gives the Week range, naming both months when it spans two', () => {
        expect(windowLabel(d('2026-07-21'), OtdMode.Week)).toBe('18–24 July');
        expect(windowLabel(d('2026-07-30'), OtdMode.Week)).toBe('27 July – 2 August');
    });
});

describe('yearsWithEntries', () => {
    const today = d('2026-07-21');

    it('lists each year once, newest first', () => {
        const entries = [
            entry('2023-03-01'),
            entry('2026-01-05'),
            entry('2023-11-30'),
            entry('2019-07-21'),
        ];
        expect(yearsWithEntries(entries, today)).toEqual([2026, 2023, 2019]);
    });

    it("ignores today's note and future-dated notes", () => {
        const entries = [entry('2026-07-21'), entry('2027-01-01'), entry('2025-02-02')];
        expect(yearsWithEntries(entries, today)).toEqual([2025]);
    });

    it('returns nothing for an empty vault', () => {
        expect(yearsWithEntries([], today)).toEqual([]);
    });
});

describe('pickYear', () => {
    it('keeps a requested year that still has entries', () => {
        expect(pickYear([2026, 2024, 2021], 2024)).toBe(2024);
    });

    it('falls back to the newest year', () => {
        expect(pickYear([2026, 2024], null)).toBe(2026);
        expect(pickYear([2025, 2024], 2020)).toBe(2025);
    });

    it('returns null when there are no years', () => {
        expect(pickYear([], null)).toBeNull();
        expect(pickYear([], 2025)).toBeNull();
    });
});

describe('adjacentYears', () => {
    const years = [2026, 2023, 2021];

    it('skips years without entries', () => {
        expect(adjacentYears(years, 2023)).toEqual({ older: 2021, newer: 2026 });
    });

    it('has no newer year at the start and no older year at the end', () => {
        expect(adjacentYears(years, 2026)).toEqual({ older: 2023, newer: null });
        expect(adjacentYears(years, 2021)).toEqual({ older: null, newer: 2023 });
    });

    it('has no neighbours for a year missing from the list', () => {
        expect(adjacentYears(years, 2024)).toEqual({ older: null, newer: null });
    });
});

describe('entriesInYear', () => {
    const today = d('2026-07-21');
    const entries = [
        entry('2026-07-21'),
        entry('2026-07-20'),
        entry('2026-01-03'),
        entry('2026-03-15'),
        entry('2026-08-01'),
        entry('2025-12-31'),
    ];

    it('lists the current year up to yesterday, newest first', () => {
        expect(paths(entriesInYear(entries, today, 2026))).toEqual([
            'Log/2026-07-20.md',
            'Log/2026-03-15.md',
            'Log/2026-01-03.md',
        ]);
    });

    it('lists only the requested year', () => {
        expect(paths(entriesInYear(entries, today, 2025))).toEqual(['Log/2025-12-31.md']);
        expect(entriesInYear(entries, today, 2024)).toEqual([]);
    });
});

describe('groupByMonth', () => {
    it('groups consecutive months and keeps their order', () => {
        const matches = entriesInYear(
            [
                entry('2025-01-02'),
                entry('2025-03-10'),
                entry('2025-03-01'),
                entry('2025-12-24'),
                entry('2025-03-31'),
            ],
            d('2026-07-21'),
            2025
        );
        const groups = groupByMonth(matches);
        expect(groups.map((g) => [g.month, g.matches.length])).toEqual([
            [11, 1],
            [2, 3],
            [0, 1],
        ]);
        expect(paths(groups[1].matches)).toEqual([
            'Log/2025-03-31.md',
            'Log/2025-03-10.md',
            'Log/2025-03-01.md',
        ]);
    });

    it('returns nothing for no matches', () => {
        expect(groupByMonth([])).toEqual([]);
    });
});

const label = (iso: string, now = '2026-07-21') => relativeLabel(d(iso), d(now));

describe('relativeLabel', () => {
    it('counts recent entries in days', () => {
        expect(label('2026-07-21')).toBe('today');
        expect(label('2026-07-20')).toBe('yesterday');
        expect(label('2026-07-19')).toBe('2 days ago');
        expect(label('2026-07-15')).toBe('6 days ago');
    });

    it('counts the next four weeks in weeks', () => {
        expect(label('2026-07-14')).toBe('1 week ago'); // 7 days
        expect(label('2026-07-08')).toBe('2 weeks ago'); // 13 days
        expect(label('2026-06-24')).toBe('4 weeks ago'); // 27 days
    });

    it('switches to months past four weeks', () => {
        expect(label('2026-06-23')).toBe('1 month ago'); // 28 days
        expect(label('2026-05-21')).toBe('2 months ago');
        expect(label('2025-11-21')).toBe('8 months ago');
    });

    it('rounds a near-anniversary up to a whole year', () => {
        // 363 days is ~11.9 months. It must not read "11 months ago".
        expect(label('2025-07-24')).toBe('1 year ago');
    });

    it('floors longer gaps to whole years', () => {
        expect(label('2025-07-21')).toBe('1 year ago');
        expect(label('2025-01-21')).toBe('1 year ago'); // 18 months
        expect(label('2024-07-21')).toBe('2 years ago');
        expect(label('2009-07-21')).toBe('17 years ago');
    });

    it('measures the real gap across New Year', () => {
        // A calendar-year difference alone would call this "1 year ago".
        expect(label('2025-12-31', '2026-01-02')).toBe('2 days ago');
    });
});
