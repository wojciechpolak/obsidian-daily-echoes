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

import {
    Component,
    ItemView,
    MarkdownRenderer,
    TFile,
    WorkspaceLeaf,
    debounce,
    setIcon,
    setTooltip,
} from 'obsidian';
import { collectEntries, hasDailyNotes } from './collect';
import { stripFrontmatter, truncate } from './text';
import { filterEntries, relativeLabel } from './otd';
import { MODE_LABELS, MODE_ORDER, OtdMatch, OtdMode, PreviewMode } from './types';
import type DailyEchoesPlugin from './main';

export const VIEW_TYPE_OTD = 'daily-echoes-view';

/** Short labels for the mode switcher buttons. */
const MODE_SHORT: Record<OtdMode, string> = {
    [OtdMode.Day]: 'Day',
    [OtdMode.Week]: 'Week',
    [OtdMode.Month]: 'Month',
    [OtdMode.DayOfMonth]: 'Day #',
};

/** Limits simultaneous vault reads and Markdown renders in large result sets. */
const RENDER_BATCH_SIZE = 8;

export class OtdView extends ItemView {
    private plugin: DailyEchoesPlugin;
    private mode: OtdMode;
    private listEl!: HTMLElement;
    private modeButtons = new Map<OtdMode, HTMLElement>();
    private scheduleRefresh = debounce(() => void this.refresh(), 400, true);
    /** `YYYY-MM-DD` the list was last built for, so we can detect a date rollover. */
    private renderedFor: string | null = null;
    /** Paths currently on screen, so we can ignore edits to unrelated notes. */
    private renderedPaths = new Set<string>();
    /**
     * Owns everything MarkdownRenderer creates for the current list. Replaced on
     * each render so the previous batch is unloaded instead of accumulating on
     * the view for the whole session.
     */
    private renderScope: Component | null = null;
    /** Set when a refresh was skipped because the panel was hidden. */
    private staleWhileHidden = false;

    constructor(leaf: WorkspaceLeaf, plugin: DailyEchoesPlugin) {
        super(leaf);
        this.plugin = plugin;
        this.mode = plugin.settings.defaultMode;
    }

    getViewType(): string {
        return VIEW_TYPE_OTD;
    }

    getDisplayText(): string {
        return 'Daily Echoes';
    }

    getIcon(): string {
        return 'calendar-clock';
    }

    async onOpen(): Promise<void> {
        this.buildChrome();

        // Adding, removing or renaming a note can change which entries match.
        this.registerEvent(this.app.vault.on('create', this.scheduleRefresh));
        this.registerEvent(this.app.vault.on('delete', this.scheduleRefresh));
        this.registerEvent(this.app.vault.on('rename', this.scheduleRefresh));

        // Editing a note only matters if it is on screen (its preview changed),
        // or if frontmatter dates are in play and could move it into the window.
        // Without this, typing in any note rebuilt the whole list every 400ms.
        this.registerEvent(
            this.app.metadataCache.on('changed', (file) => {
                if (this.renderedPaths.has(file.path) || this.plugin.settings.includeOtherNotes) {
                    this.scheduleRefresh();
                }
            })
        );

        // Re-render as soon as the panel is revealed again after being hidden.
        this.registerEvent(this.app.workspace.on('layout-change', () => this.catchUp()));
        this.registerEvent(this.app.workspace.on('active-leaf-change', () => this.catchUp()));

        // Obsidian is often left open across midnight. Without this the panel
        // would keep showing yesterday's entries until some other event fired.
        // Doubles as a backstop for a missed catch-up.
        this.registerInterval(
            window.setInterval(() => {
                const rolledOver = this.renderedFor !== window.moment().format('YYYY-MM-DD');
                if (rolledOver || this.staleWhileHidden) {
                    void this.refresh();
                }
            }, 60_000)
        );

        await this.refresh(true);
    }

    /** Switch the active time window and re-render. */
    async setMode(mode: OtdMode): Promise<void> {
        this.mode = mode;
        this.updateActiveMode();
        await this.refresh();
    }

    /** Render now if a refresh was skipped while the panel was hidden. */
    private catchUp(): void {
        if (this.staleWhileHidden && this.containerEl.isShown()) {
            void this.refresh();
        }
    }

    /** Re-render without changing the active mode (used after settings changes). */
    async rerender(): Promise<void> {
        await this.refresh();
    }

    private buildChrome(): void {
        const container = this.contentEl ?? this.containerEl;
        container.empty();
        container.addClass('otd');

        const header = container.createDiv('otd-header');

        const switcher = header.createDiv('otd-modes');
        for (const mode of MODE_ORDER) {
            const btn = switcher.createEl('button', {
                text: MODE_SHORT[mode],
                cls: 'otd-mode',
            });
            setTooltip(btn, MODE_LABELS[mode]);
            btn.addEventListener('click', () => void this.setMode(mode));
            this.modeButtons.set(mode, btn);
        }

        const actions = header.createDiv('otd-actions');
        const refreshBtn = actions.createEl('button', { cls: 'otd-refresh' });
        setIcon(refreshBtn, 'refresh-cw');
        setTooltip(refreshBtn, 'Refresh');
        refreshBtn.addEventListener('click', () => void this.refresh());

        this.listEl = container.createDiv('otd-list');
        this.updateActiveMode();
    }

    private updateActiveMode(): void {
        for (const [mode, btn] of this.modeButtons) {
            btn.toggleClass('is-active', mode === this.mode);
        }
    }

    private async refresh(force = false): Promise<void> {
        // Rendering into a collapsed sidebar or background tab is wasted work.
        // Remember that we skipped, and catch up when the panel is shown again.
        if (!force && !this.containerEl.isShown()) {
            this.staleWhileHidden = true;
            return;
        }
        this.staleWhileHidden = false;

        const list = this.listEl;
        const today = window.moment();
        this.renderedFor = today.format('YYYY-MM-DD');
        this.renderedPaths.clear();

        // Unload the previous render's children before dropping their elements,
        // otherwise every refresh leaves components attached to the view.
        if (this.renderScope) {
            this.removeChild(this.renderScope);
        }
        this.renderScope = this.addChild(new Component());

        list.empty();

        if (!hasDailyNotes()) {
            this.renderEmpty(
                list,
                'Enable the core Daily notes plugin (or Periodic Notes) to use Daily Echoes.'
            );
            return;
        }

        const entries = collectEntries(this.app, this.plugin.settings);
        const matches = filterEntries(
            entries,
            today,
            this.mode,
            this.plugin.settings.includeCurrentYear
        );

        const caption = list.createDiv('otd-caption');
        caption.setText(
            `${MODE_LABELS[this.mode]} · ${matches.length} ${
                matches.length === 1 ? 'entry' : 'entries'
            }`
        );

        if (matches.length === 0) {
            this.renderEmpty(list, 'No earlier entries fall in this window.');
            return;
        }

        const scope = this.renderScope;
        for (const match of matches) {
            this.renderedPaths.add(match.file.path);
        }

        // Each renderCard builds its card synchronously before awaiting, so cards
        // stay ordered. A small worker pool caps I/O and Markdown rendering
        // pressure in large Month/Day-of-Month result sets.
        let nextIndex = 0;
        const renderNext = async (): Promise<void> => {
            const index = nextIndex++;
            if (index >= matches.length) {
                return;
            }
            await this.renderCard(list, matches[index], scope);
            return renderNext();
        };
        const workerCount = Math.min(RENDER_BATCH_SIZE, matches.length);
        await Promise.all(Array.from({ length: workerCount }, renderNext));
    }

    private renderEmpty(parent: HTMLElement, message: string): void {
        parent.createDiv('otd-empty').setText(message);
    }

    private async renderCard(
        parent: HTMLElement,
        match: OtdMatch,
        scope: Component | null
    ): Promise<void> {
        const card = parent.createDiv('otd-card');
        if (!match.isDailyNote) {
            card.addClass('is-other');
        }

        const head = card.createDiv('otd-card-head');
        const title = head.createEl('a', {
            text: match.date.format('dddd, D MMMM YYYY'),
            cls: 'otd-card-title',
            href: '#',
        });
        title.addEventListener('click', (evt) => {
            evt.preventDefault();
            this.openEntry(match.file, evt);
        });

        const meta = head.createDiv('otd-card-meta');
        meta.createSpan({ text: relativeLabel(match), cls: 'otd-ago' });
        if (!match.isDailyNote) {
            meta.createSpan({ text: 'other', cls: 'otd-badge' });
        }

        if (this.plugin.settings.previewMode !== PreviewMode.None) {
            await this.renderPreview(card, match.file, scope);
        }
    }

    private async renderPreview(
        card: HTMLElement,
        file: TFile,
        scope: Component | null
    ): Promise<void> {
        const previewEl = card.createDiv('otd-preview');
        try {
            const raw = await this.app.vault.cachedRead(file);
            let body = stripFrontmatter(raw).trim();
            if (this.plugin.settings.previewMode === PreviewMode.Snippet) {
                body = truncate(body, this.plugin.settings.snippetLength);
            }
            if (body.length === 0) {
                previewEl.addClass('is-empty');
                previewEl.setText('(empty note)');
                return;
            }
            await MarkdownRenderer.render(this.app, body, previewEl, file.path, scope ?? this);
        } catch {
            previewEl.addClass('is-empty');
            previewEl.setText('(could not read note)');
        }
    }

    private openEntry(file: TFile, evt: MouseEvent): void {
        const newTab = evt.ctrlKey || evt.metaKey;
        void this.app.workspace.getLeaf(newTab ? 'tab' : false).openFile(file);
    }
}
