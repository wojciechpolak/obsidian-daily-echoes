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

import { App, TFile } from 'obsidian';
import {
    appHasDailyNotesPluginLoaded,
    getAllDailyNotes,
    getDateFromFile,
} from 'obsidian-daily-notes-interface';
import { deriveDate } from './dates';
import { OtdEntry, OtdSettings } from './types';

/**
 * Gather every daily note, plus — when enabled — other markdown documents
 * dated by frontmatter, filename, or file creation time.
 */
export function collectEntries(app: App, settings: OtdSettings): OtdEntry[] {
    const dailyEntries = collectDailyNoteEntries();
    const dailyPaths = new Set(dailyEntries.map((e) => e.file.path));

    if (!settings.includeOtherNotes) {
        return dailyEntries;
    }
    return dailyEntries.concat(collectOtherEntries(app, dailyPaths));
}

/** Whether the vault has a Daily notes (or Periodic Notes) configuration. */
export function hasDailyNotes(): boolean {
    return appHasDailyNotesPluginLoaded();
}

function collectDailyNoteEntries(): OtdEntry[] {
    let notes: Record<string, TFile>;
    try {
        notes = getAllDailyNotes();
    } catch (error) {
        // Usually means the configured daily-notes folder does not exist yet,
        // but log it so a genuine failure is not mistaken for an empty vault.
        console.debug('Daily Echoes: could not list daily notes', error);
        return [];
    }

    const entries: OtdEntry[] = [];
    for (const file of Object.values(notes)) {
        const date = getDateFromFile(file, 'day');
        if (date && date.isValid()) {
            entries.push({ file, date, isDailyNote: true });
        }
    }
    return entries;
}

function collectOtherEntries(app: App, dailyPaths: Set<string>): OtdEntry[] {
    const entries: OtdEntry[] = [];
    for (const file of app.vault.getMarkdownFiles()) {
        if (dailyPaths.has(file.path)) {
            continue;
        }
        const cache = app.metadataCache.getFileCache(file);
        const date = deriveDate(cache?.frontmatter, file.basename, file.stat.ctime);
        if (date.isValid()) {
            entries.push({ file, date, isDailyNote: false });
        }
    }
    return entries;
}
