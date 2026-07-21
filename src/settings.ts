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

import { App, PluginSettingTab, Setting } from 'obsidian';
import type DailyEchoesPlugin from './main';
import { MODE_LABELS, MODE_ORDER, OtdMode, PreviewMode } from './types';

const PREVIEW_LABELS: Record<PreviewMode, string> = {
    [PreviewMode.None]: 'None (title only)',
    [PreviewMode.Snippet]: 'Truncated snippet',
    [PreviewMode.Full]: 'Full note',
};

export class OtdSettingTab extends PluginSettingTab {
    private plugin: DailyEchoesPlugin;

    constructor(app: App, plugin: DailyEchoesPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName('Default mode')
            .setDesc('The time window shown when the panel first opens.')
            .addDropdown((dd) => {
                for (const mode of MODE_ORDER) {
                    dd.addOption(mode, MODE_LABELS[mode]);
                }
                dd.setValue(this.plugin.settings.defaultMode).onChange(async (value) => {
                    this.plugin.settings.defaultMode = value as OtdMode;
                    await this.plugin.saveSettings();
                });
            });

        new Setting(containerEl)
            .setName('Include other notes')
            .setDesc(
                "Also show notes that aren't daily notes, dated by a frontmatter date, filename, or creation time. Off by default so only daily notes appear."
            )
            .addToggle((toggle) => {
                toggle.setValue(this.plugin.settings.includeOtherNotes).onChange(async (value) => {
                    this.plugin.settings.includeOtherNotes = value;
                    await this.plugin.saveSettings();
                    this.plugin.refreshViews();
                });
            });

        new Setting(containerEl)
            .setName('Include current year')
            .setDesc(
                'Also show earlier entries from the current year, not just previous years. Off by default.'
            )
            .addToggle((toggle) => {
                toggle.setValue(this.plugin.settings.includeCurrentYear).onChange(async (value) => {
                    this.plugin.settings.includeCurrentYear = value;
                    await this.plugin.saveSettings();
                    this.plugin.refreshViews();
                });
            });

        new Setting(containerEl)
            .setName('Preview')
            .setDesc('How much of each note to show in its card.')
            .addDropdown((dd) => {
                for (const mode of Object.values(PreviewMode)) {
                    dd.addOption(mode, PREVIEW_LABELS[mode]);
                }
                dd.setValue(this.plugin.settings.previewMode).onChange(async (value) => {
                    this.plugin.settings.previewMode = value as PreviewMode;
                    await this.plugin.saveSettings();
                    this.plugin.refreshViews();
                    this.display(); // toggle the snippet-length control
                });
            });

        if (this.plugin.settings.previewMode === PreviewMode.Snippet) {
            new Setting(containerEl)
                .setName('Snippet length')
                .setDesc('Maximum characters shown in a truncated preview.')
                .addSlider((slider) => {
                    slider
                        .setLimits(80, 1000, 20)
                        .setValue(this.plugin.settings.snippetLength)
                        // Deprecated since 1.13.0, where the value is always
                        // shown inline — but minAppVersion is 1.7.2, and
                        // without this older builds show no value at all.
                        .setDynamicTooltip()
                        .onChange(async (value) => {
                            this.plugin.settings.snippetLength = value;
                            await this.plugin.saveSettings();
                            this.plugin.refreshViews();
                        });
                });
        }
    }
}
