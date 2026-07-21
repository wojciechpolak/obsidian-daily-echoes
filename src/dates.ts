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
 * Dating rules for notes that are not daily notes. Kept free of Obsidian
 * imports so they stay unit-testable outside the app.
 */

import type { Moment } from 'moment';

/** Frontmatter keys checked, in order, when dating a non-daily-note document. */
const FRONTMATTER_DATE_KEYS = ['date', 'created', 'day'];

/** Formats tried (strictly) when parsing a date out of a filename. */
const FILENAME_DATE_FORMATS = ['YYYY-MM-DD', 'YYYY/MM/DD', 'YYYYMMDD'];

/**
 * Formats accepted for a frontmatter date value.
 *
 * Parsed strictly on purpose: moment's lenient parser falls back to `new Date()`
 * for anything it does not recognise, which is inconsistent between engines and
 * emits a deprecation warning into the user's console. An unrecognised value
 * should simply fall through to the filename or ctime instead.
 */
const frontmatterDateFormats = () => [window.moment.ISO_8601, ...FILENAME_DATE_FORMATS];

/**
 * Work out a date for a document, preferring the most deliberate signal:
 * an explicit frontmatter date, then a date in the filename, and finally the
 * file's creation time.
 */
export function deriveDate(
    frontmatter: Record<string, unknown> | undefined,
    basename: string,
    ctime: number
): Moment {
    // 1) A date-like frontmatter field.
    if (frontmatter) {
        for (const key of FRONTMATTER_DATE_KEYS) {
            const raw = frontmatter[key];
            if (raw == null) {
                continue;
            }
            const parsed =
                raw instanceof Date
                    ? window.moment(raw)
                    : window.moment(String(raw), frontmatterDateFormats(), true);
            if (parsed.isValid()) {
                return parsed;
            }
        }
    }

    // 2) A date embedded in the filename.
    const fromName = window.moment(basename, FILENAME_DATE_FORMATS, true);
    if (fromName.isValid()) {
        return fromName;
    }

    // 3) Fall back to the file's creation time.
    return window.moment(ctime);
}
