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

import type { Moment } from 'moment';
import { OtdEntry, OtdMatch, OtdMode, WindowMode } from './types';

/**
 * How many days either side of today's calendar date the Week window covers.
 * A radius of 3 gives a 7-day window centred on today.
 */
export const WEEK_RADIUS_DAYS = 3;

/**
 * Is `date` within `radius` days of today's calendar date, ignoring the year?
 *
 * The entry is projected onto today's year (and its neighbours, so a window
 * spanning New Year still matches) and the day distance measured there. This
 * keeps the Week window anchored to the time of year: ISO week numbers drift
 * 1-2 days against the calendar each year, which made entries slip out of the
 * window as years passed.
 */
function withinDaysOfYear(date: Moment, today: Moment, radius: number): boolean {
    for (const yearOffset of [-1, 0, 1]) {
        const projected = date.clone().year(today.year() + yearOffset);
        if (Math.abs(projected.diff(today, 'days')) <= radius) {
            return true;
        }
    }
    return false;
}

/**
 * Does an entry's date fall inside the window described by `mode`, relative to
 * `today`? Both moments are expected to be at day precision.
 */
export function matchesMode(date: Moment, today: Moment, mode: WindowMode): boolean {
    switch (mode) {
        case OtdMode.Day:
            return date.month() === today.month() && date.date() === today.date();
        case OtdMode.Week:
            return withinDaysOfYear(date, today, WEEK_RADIUS_DAYS);
        case OtdMode.Month:
            return date.month() === today.month();
        case OtdMode.DayOfMonth:
            return date.date() === today.date();
    }
}

/**
 * The entry as a match, or null when it falls on today or later. Every view
 * leaves out today's own note and future-dated notes.
 */
function toPastMatch(entry: OtdEntry, todayStart: Moment): OtdMatch | null {
    const date = entry.date.clone().startOf('day');
    if (!date.isBefore(todayStart)) {
        return null;
    }
    return {
        ...entry,
        // Calendar-year difference, not elapsed whole years: a note from
        // 24 July 2025 read on 22 July 2026 is "1 year ago", even though
        // only 363 days have passed. Elapsed years would call it "earlier
        // this year", which is wrong for every mode whose window reaches
        // past today's month/day into the previous year.
        yearsAgo: todayStart.year() - date.year(),
    };
}

/** Sorts in place, most recent first, and returns the same array. */
function newestFirst(matches: OtdMatch[]): OtdMatch[] {
    matches.sort((a, b) => b.date.valueOf() - a.date.valueOf());
    return matches;
}

/**
 * Filter and rank entries for the given mode.
 *
 * Only entries strictly before today are surfaced (never today's own note or
 * future-dated notes). By default the current year is excluded so results are
 * "previous years" only; `includeCurrentYear` relaxes that.
 *
 * The window is measured around `anchor`, which is today unless the user has
 * stepped to another date. The cut-off and the current year stay tied to the
 * real today either way.
 *
 * Results are sorted most-recent first.
 */
export function filterEntries(
    entries: OtdEntry[],
    today: Moment,
    mode: WindowMode,
    includeCurrentYear: boolean,
    anchor: Moment = today
): OtdMatch[] {
    const todayStart = today.clone().startOf('day');
    const anchorStart = anchor.clone().startOf('day');

    const matches: OtdMatch[] = [];
    for (const entry of entries) {
        const match = toPastMatch(entry, todayStart);
        if (!match) {
            continue;
        }
        if (!includeCurrentYear && match.date.year() === todayStart.year()) {
            continue;
        }
        if (!matchesMode(match.date.clone().startOf('day'), anchorStart, mode)) {
            continue;
        }
        matches.push(match);
    }

    return newestFirst(matches);
}

/**
 * The date a window mode is measured around after `steps` presses of the
 * arrows: one day for Day and Day-of-month, seven days for Week, one month for
 * Month. Negative steps go back.
 *
 * Counting from today each time, instead of shifting the previous anchor,
 * keeps Month on the right day: 31 January plus two steps is 31 March, not
 * 28 March by way of 28 February.
 */
export function shiftAnchor(today: Moment, mode: WindowMode, steps: number): Moment {
    const anchor = today.clone().startOf('day');
    switch (mode) {
        case OtdMode.Day:
        case OtdMode.DayOfMonth:
            return anchor.add(steps, 'days');
        case OtdMode.Week:
            return anchor.add(steps * 7, 'days');
        case OtdMode.Month:
            return anchor.add(steps, 'months');
    }
}

/** Describes the window around `anchor`, e.g. `19–25 July` for Week. */
export function windowLabel(anchor: Moment, mode: WindowMode): string {
    switch (mode) {
        case OtdMode.Day:
            return anchor.format('D MMMM');
        case OtdMode.Week: {
            const start = anchor.clone().subtract(WEEK_RADIUS_DAYS, 'days');
            const end = anchor.clone().add(WEEK_RADIUS_DAYS, 'days');
            return start.month() === end.month()
                ? `${start.date()}–${end.format('D MMMM')}`
                : `${start.format('D MMMM')} – ${end.format('D MMMM')}`;
        }
        case OtdMode.Month:
            return anchor.format('MMMM');
        case OtdMode.DayOfMonth:
            return `Day ${anchor.date()} of the month`;
    }
}

/** The distinct years that hold at least one entry before today, newest first. */
export function yearsWithEntries(entries: OtdEntry[], today: Moment): number[] {
    const todayStart = today.clone().startOf('day');
    const years = new Set<number>();
    for (const entry of entries) {
        if (entry.date.clone().startOf('day').isBefore(todayStart)) {
            years.add(entry.date.year());
        }
    }
    const sorted = [...years];
    sorted.sort((a, b) => b - a);
    return sorted;
}

/**
 * The year the Year view should show: `requested` while it still has entries,
 * otherwise the newest year that does (the current year whenever it has any).
 * Null when there are no entries at all.
 */
export function pickYear(years: number[], requested: number | null): number | null {
    if (requested !== null && years.includes(requested)) {
        return requested;
    }
    return years[0] ?? null;
}

/**
 * The years either side of `year` in `years` (newest first), so stepping
 * through them skips years without entries. Null at either end.
 */
export function adjacentYears(
    years: number[],
    year: number
): { older: number | null; newer: number | null } {
    const index = years.indexOf(year);
    if (index === -1) {
        return { older: null, newer: null };
    }
    return {
        older: years[index + 1] ?? null,
        newer: index > 0 ? years[index - 1] : null,
    };
}

/**
 * Every entry from `year` that falls before today, newest first. The Year view
 * always includes the current year, so `includeCurrentYear` plays no part.
 */
export function entriesInYear(entries: OtdEntry[], today: Moment, year: number): OtdMatch[] {
    const todayStart = today.clone().startOf('day');
    const matches: OtdMatch[] = [];
    for (const entry of entries) {
        if (entry.date.year() !== year) {
            continue;
        }
        const match = toPastMatch(entry, todayStart);
        if (match) {
            matches.push(match);
        }
    }
    return newestFirst(matches);
}

/** A run of matches that share a calendar month. `month` is 0-based, as in moment. */
export interface MonthGroup {
    month: number;
    matches: OtdMatch[];
}

/**
 * Split matches into month groups. The input should come from a single year
 * and already be sorted, so each month forms one consecutive run.
 */
export function groupByMonth(matches: OtdMatch[]): MonthGroup[] {
    const groups: MonthGroup[] = [];
    for (const match of matches) {
        const month = match.date.month();
        const last = groups[groups.length - 1];
        if (last && last.month === month) {
            last.matches.push(match);
        } else {
            groups.push({ month, matches: [match] });
        }
    }
    return groups;
}

/** Gaps shorter than this count in whole weeks, longer ones in months. */
const MONTH_THRESHOLD_DAYS = 28;

/** Formats a count and unit as `2 days ago`. The unit takes an s unless count is 1. */
function ago(count: number, unit: string): string {
    return `${count} ${unit}${count === 1 ? '' : 's'} ago`;
}

/**
 * How long ago `date` was, counted in days, weeks, months or years.
 *
 * This rounds the month count rather than flooring it, so a window that
 * reaches a few days past an anniversary still reads as a whole year. 363 days
 * is ~11.9 months, which rounds to 12 and gives "1 year ago". Dividing by 12
 * then floors the year count, so an 18-month gap (reachable in Day-of-month
 * mode) stays at "1 year ago" instead of rounding up to two.
 */
export function relativeLabel(date: Moment, today: Moment): string {
    const from = date.clone().startOf('day');
    const to = today.clone().startOf('day');
    const days = to.diff(from, 'days');

    if (days <= 0) {
        return 'today';
    }
    if (days === 1) {
        return 'yesterday';
    }
    if (days < 7) {
        return ago(days, 'day');
    }
    if (days < MONTH_THRESHOLD_DAYS) {
        return ago(Math.round(days / 7), 'week');
    }

    const months = Math.max(1, Math.round(to.diff(from, 'months', true)));
    if (months < 12) {
        return ago(months, 'month');
    }
    return ago(Math.floor(months / 12), 'year');
}
