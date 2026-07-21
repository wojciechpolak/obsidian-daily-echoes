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

import { Plugin } from 'obsidian';
import { OtdSettingTab } from './settings';
import { DEFAULT_SETTINGS, MODE_COMMAND_NOUNS, MODE_ORDER, OtdMode, OtdSettings } from './types';
import { OtdView, VIEW_TYPE_OTD } from './view';

export default class DailyEchoesPlugin extends Plugin {
    settings!: OtdSettings;

    async onload(): Promise<void> {
        await this.loadSettings();

        this.registerView(VIEW_TYPE_OTD, (leaf) => new OtdView(leaf, this));

        this.addRibbonIcon('calendar-clock', 'Daily Echoes', () => void this.activateView());

        this.addCommand({
            id: 'open-view',
            name: 'Open view',
            callback: () => void this.activateView(),
        });

        for (const mode of MODE_ORDER) {
            this.addCommand({
                id: `show-${mode}`,
                name: `Show ${MODE_COMMAND_NOUNS[mode]}`,
                callback: () => void this.activateView(mode),
            });
        }

        this.addSettingTab(new OtdSettingTab(this.app, this));
    }

    /** Open (or reveal) the panel in the right sidebar, optionally setting a mode. */
    async activateView(mode?: OtdMode): Promise<void> {
        const { workspace } = this.app;

        let leaf = workspace.getLeavesOfType(VIEW_TYPE_OTD)[0];
        if (!leaf) {
            const right = workspace.getRightLeaf(false);
            if (!right) {
                return;
            }
            leaf = right;
            await leaf.setViewState({ type: VIEW_TYPE_OTD, active: true });
        }

        await workspace.revealLeaf(leaf);

        if (mode && leaf.view instanceof OtdView) {
            await leaf.view.setMode(mode);
        }
    }

    /** Re-render every open panel (after a settings change). */
    refreshViews(): void {
        for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_OTD)) {
            if (leaf.view instanceof OtdView) {
                void leaf.view.rerender();
            }
        }
    }

    async loadSettings(): Promise<void> {
        // loadData() is typed `any`; narrow it before merging over the defaults.
        const saved = ((await this.loadData()) ?? {}) as Partial<OtdSettings>;
        this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
    }
}
