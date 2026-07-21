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
import { OtdEntry, OtdMatch, OtdMode } from './types';

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
export function matchesMode(date: Moment, today: Moment, mode: OtdMode): boolean {
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
 * Filter and rank entries for the given mode.
 *
 * Only entries strictly before today are surfaced (never today's own note or
 * future-dated notes). By default the current year is excluded so results are
 * "previous years" only; `includeCurrentYear` relaxes that.
 *
 * Results are sorted most-recent first.
 */
export function filterEntries(
    entries: OtdEntry[],
    today: Moment,
    mode: OtdMode,
    includeCurrentYear: boolean
): OtdMatch[] {
    const todayStart = today.clone().startOf('day');

    const matches: OtdMatch[] = [];
    for (const entry of entries) {
        const date = entry.date.clone().startOf('day');

        // Never show today's entry or anything in the future.
        if (!date.isBefore(todayStart)) {
            continue;
        }
        if (!includeCurrentYear && date.year() === todayStart.year()) {
            continue;
        }
        if (!matchesMode(date, todayStart, mode)) {
            continue;
        }

        matches.push({
            ...entry,
            yearsAgo: todayStart.diff(date, 'years'),
        });
    }

    matches.sort((a, b) => b.date.valueOf() - a.date.valueOf());
    return matches;
}

/** Human-friendly "how long ago" label for a matched entry. */
export function relativeLabel(match: OtdMatch): string {
    if (match.yearsAgo <= 0) {
        return 'earlier this year';
    }
    if (match.yearsAgo === 1) {
        return '1 year ago';
    }
    return `${match.yearsAgo} years ago`;
}
