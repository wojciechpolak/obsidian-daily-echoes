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

import { App, PluginSettingTab, type SettingDefinitionItem } from 'obsidian';
import type DailyEchoesPlugin from './main';
import { MODE_LABELS, MODE_ORDER, type OtdSettings, PreviewMode } from './types';

const PREVIEW_LABELS: Record<PreviewMode, string> = {
    [PreviewMode.None]: 'None (title only)',
    [PreviewMode.Snippet]: 'Truncated snippet',
    [PreviewMode.Full]: 'Full note',
};

/** Settings whose change alters what an open panel shows. */
const RERENDER_KEYS: ReadonlySet<string> = new Set<keyof OtdSettings>([
    'includeOtherNotes',
    'includeCurrentYear',
    'previewMode',
    'snippetLength',
]);

export class OtdSettingTab extends PluginSettingTab {
    private plugin: DailyEchoesPlugin;

    constructor(app: App, plugin: DailyEchoesPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    getSettingDefinitions(): SettingDefinitionItem<keyof OtdSettings>[] {
        return [
            {
                name: 'Default mode',
                desc: 'The time window shown when the panel first opens.',
                control: {
                    type: 'dropdown',
                    key: 'defaultMode',
                    options: Object.fromEntries(
                        MODE_ORDER.map((mode) => [mode, MODE_LABELS[mode]])
                    ),
                },
            },
            {
                name: 'Include other notes',
                desc: "Also show notes that aren't daily notes, dated by a frontmatter date, filename, or creation time. Off by default so only daily notes appear.",
                control: { type: 'toggle', key: 'includeOtherNotes' },
            },
            {
                name: 'Include current year',
                desc: 'Also show earlier entries from the current year, not just previous years. Off by default.',
                control: { type: 'toggle', key: 'includeCurrentYear' },
            },
            {
                name: 'Preview',
                desc: 'How much of each note to show in its card.',
                control: { type: 'dropdown', key: 'previewMode', options: PREVIEW_LABELS },
            },
            {
                name: 'Snippet length',
                desc: 'Maximum characters shown in a truncated preview.',
                control: { type: 'slider', key: 'snippetLength', min: 80, max: 1000, step: 20 },
                visible: () => this.plugin.settings.previewMode === PreviewMode.Snippet,
            },
        ];
    }

    // Controls have no onChange, so saving and the panel refresh happen here.
    async setControlValue(key: string, value: unknown): Promise<void> {
        Object.assign(this.plugin.settings, { [key]: value });
        await this.plugin.saveSettings();
        if (RERENDER_KEYS.has(key)) {
            this.plugin.refreshViews();
        }
        if (key === 'previewMode') {
            this.refreshDomState(); // show or hide the snippet-length slider
        }
    }
}
