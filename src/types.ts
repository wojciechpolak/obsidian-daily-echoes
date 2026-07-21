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
import type { TFile } from 'obsidian';

/** The four time windows the plugin can show. */
export enum OtdMode {
    Day = 'day',
    Week = 'week',
    Month = 'month',
    DayOfMonth = 'dayOfMonth',
}

/** Sentence case, per Obsidian's UI style guide. */
export const MODE_LABELS: Record<OtdMode, string> = {
    [OtdMode.Day]: 'On this day',
    [OtdMode.Week]: 'This week',
    [OtdMode.Month]: 'This month',
    [OtdMode.DayOfMonth]: 'This day of month',
};

/**
 * Nouns used in command names. Obsidian already prefixes commands with the
 * plugin name, so "Show day" reads as "Daily Echoes: Show day" — using
 * MODE_LABELS here would give the redundant "Daily Echoes: Show on this day".
 */
export const MODE_COMMAND_NOUNS: Record<OtdMode, string> = {
    [OtdMode.Day]: 'day',
    [OtdMode.Week]: 'week',
    [OtdMode.Month]: 'month',
    [OtdMode.DayOfMonth]: 'day of month',
};

/** Order used for switchers and per-mode commands. */
export const MODE_ORDER: OtdMode[] = [OtdMode.Day, OtdMode.Week, OtdMode.Month, OtdMode.DayOfMonth];

/** How much of a note's body to preview in a card. */
export enum PreviewMode {
    None = 'none',
    Snippet = 'snippet',
    Full = 'full',
}

/** A dated note considered for matching. */
export interface OtdEntry {
    file: TFile;
    date: Moment;
    /** True for a daily note, false for any other document. */
    isDailyNote: boolean;
}

/** An entry that matched the active mode, with elapsed-time info. */
export interface OtdMatch extends OtdEntry {
    /** Whole years elapsed between the entry's date and today. */
    yearsAgo: number;
}

export interface OtdSettings {
    defaultMode: OtdMode;
    includeOtherNotes: boolean;
    includeCurrentYear: boolean;
    previewMode: PreviewMode;
    snippetLength: number;
}

export const DEFAULT_SETTINGS: OtdSettings = {
    defaultMode: OtdMode.Day,
    includeOtherNotes: false,
    includeCurrentYear: false,
    previewMode: PreviewMode.Snippet,
    snippetLength: 300,
};
