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
import {
    adjacentYears,
    entriesInYear,
    filterEntries,
    groupByMonth,
    pickYear,
    relativeLabel,
    shiftAnchor,
    windowLabel,
    yearsWithEntries,
} from './otd';
import {
    MODE_LABELS,
    MODE_ORDER,
    OtdEntry,
    OtdMatch,
    OtdMode,
    PreviewMode,
    WindowMode,
} from './types';
import type DailyEchoesPlugin from './main';

export const VIEW_TYPE_OTD = 'daily-echoes-view';

/** Short labels for the mode switcher buttons. */
const MODE_SHORT: Record<OtdMode, string> = {
    [OtdMode.Day]: 'Day',
    [OtdMode.Week]: 'Week',
    [OtdMode.Month]: 'Month',
    [OtdMode.DayOfMonth]: 'Day #',
    [OtdMode.Year]: 'Year',
};

/** How far outside the visible area a preview starts rendering. */
const PREVIEW_MARGIN = '600px 0px';

/** Schedules a card's preview to render once it scrolls near view. */
type PreviewQueue = (previewEl: HTMLElement, file: TFile) => void;

/** What one arrow press moves a window mode by, for the arrow tooltips. */
const STEP_UNITS: Record<WindowMode, string> = {
    [OtdMode.Day]: 'day',
    [OtdMode.Week]: 'week',
    [OtdMode.Month]: 'month',
    [OtdMode.DayOfMonth]: 'day',
};

/** Lists at least this long repeat the arrows below the last card. */
const BOTTOM_NAV_MIN = 4;

/** The arrow bar above a list. A null action disables that control. */
interface NavSpec {
    label: string;
    /** Names the step in the tooltips: "Previous week", "Next week". */
    unit: string;
    back: (() => void) | null;
    forward: (() => void) | null;
    /** Set once the user has moved away; the label then becomes a button. */
    reset: { tooltip: string; go: () => void } | null;
}

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
    /** Year picked with the Year view's arrows; null shows the newest year. */
    private year: number | null = null;
    /** Arrow presses away from today in each window mode; missing means 0. */
    private steps = new Map<WindowMode, number>();

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
        const queuePreview = this.previewQueue(this.renderScope);
        if (this.mode === OtdMode.Year) {
            this.renderYear(list, entries, today, queuePreview);
            return;
        }

        this.renderWindow(list, entries, today, this.mode, queuePreview);
    }

    /** Entries in the Day, Week, Month or Day-of-month window around the anchor. */
    private renderWindow(
        list: HTMLElement,
        entries: OtdEntry[],
        today: Moment,
        mode: WindowMode,
        queuePreview: PreviewQueue
    ): void {
        const steps = this.steps.get(mode) ?? 0;
        const anchor = shiftAnchor(today, mode, steps);
        const matches = filterEntries(
            entries,
            today,
            mode,
            this.plugin.settings.includeCurrentYear,
            anchor
        );

        const nav: NavSpec = {
            label: `${windowLabel(anchor, mode)} · ${entryCount(matches.length)}`,
            unit: STEP_UNITS[mode],
            back: () => this.steps.set(mode, steps - 1),
            forward: () => this.steps.set(mode, steps + 1),
            reset:
                steps === 0
                    ? null
                    : { tooltip: 'Back to today', go: () => this.steps.delete(mode) },
        };
        this.renderNav(list, nav);

        if (matches.length === 0) {
            this.renderEmpty(list, 'No earlier entries fall in this window.');
            return;
        }

        this.renderCards(list, matches, today, queuePreview);
        if (matches.length >= BOTTOM_NAV_MIN) {
            this.renderNav(list, nav);
        }
    }

    /** One year of entries, newest first, under month headings. */
    private renderYear(
        list: HTMLElement,
        entries: OtdEntry[],
        today: Moment,
        queuePreview: PreviewQueue
    ): void {
        const years = yearsWithEntries(entries, today);
        const year = pickYear(years, this.year);
        if (year === null) {
            this.renderEmpty(list, 'No earlier entries yet.');
            return;
        }

        const matches = entriesInYear(entries, today, year);
        const { older, newer } = adjacentYears(years, year);
        const nav: NavSpec = {
            label: `${year} · ${entryCount(matches.length)}`,
            unit: 'year',
            back: older === null ? null : () => (this.year = older),
            forward: newer === null ? null : () => (this.year = newer),
            reset:
                year === years[0]
                    ? null
                    : { tooltip: 'Back to the latest year', go: () => (this.year = null) },
        };

        this.renderNav(list, nav);
        for (const group of groupByMonth(matches)) {
            list.createDiv({
                text: `${group.matches[0].date.format('MMMM')} · ${group.matches.length}`,
                cls: 'otd-month',
            });
            this.renderCards(list, group.matches, today, queuePreview);
        }
        if (matches.length >= BOTTOM_NAV_MIN) {
            this.renderNav(list, nav);
        }
    }

    private renderNav(parent: HTMLElement, nav: NavSpec): void {
        const bar = parent.createDiv('otd-nav');
        this.navButton(bar, 'chevron-left', `Previous ${nav.unit}`, nav.back);
        if (nav.reset) {
            const { tooltip, go } = nav.reset;
            const btn = bar.createEl('button', { text: nav.label, cls: 'otd-nav-label is-reset' });
            setTooltip(btn, tooltip);
            btn.addEventListener('click', () => this.navigate(go));
        } else {
            bar.createSpan({ text: nav.label, cls: 'otd-nav-label' });
        }
        this.navButton(bar, 'chevron-right', `Next ${nav.unit}`, nav.forward);
    }

    private navButton(
        parent: HTMLElement,
        icon: string,
        tooltip: string,
        action: (() => void) | null
    ): void {
        const btn = parent.createEl('button', { cls: 'otd-nav-step' });
        setIcon(btn, icon);
        setTooltip(btn, tooltip);
        if (action === null) {
            btn.disabled = true;
            return;
        }
        btn.addEventListener('click', () => this.navigate(action));
    }

    /** Apply a navigation change and redraw the list from the top. */
    private navigate(change: () => void): void {
        change();
        this.contentEl.scrollTop = 0;
        void this.refresh();
    }

    /**
     * Returns a function that defers a card's preview until the card nears the
     * visible area. A Year or Month list can run to hundreds of notes, and
     * reading and rendering them all up front made the panel slow to open.
     */
    private previewQueue(scope: Component): PreviewQueue {
        const pending = new Map<Element, TFile>();
        const observer = new IntersectionObserver(
            (seen) => {
                for (const { target, isIntersecting } of seen) {
                    const file = pending.get(target);
                    if (!isIntersecting || !file) {
                        continue;
                    }
                    observer.unobserve(target);
                    pending.delete(target);
                    const previewEl = target as HTMLElement;
                    previewEl.removeClass('is-pending');
                    void this.renderPreview(previewEl, file, scope);
                }
            },
            { root: this.contentEl, rootMargin: PREVIEW_MARGIN }
        );
        // Unloaded with this render's scope, so a replaced list stops rendering.
        scope.register(() => observer.disconnect());

        return (previewEl, file) => {
            pending.set(previewEl, file);
            observer.observe(previewEl);
        };
    }

    /** Cards are built synchronously, so they keep their order. */
    private renderCards(
        parent: HTMLElement,
        matches: OtdMatch[],
        today: Moment,
        queuePreview: PreviewQueue
    ): void {
        const showPreview = this.plugin.settings.previewMode !== PreviewMode.None;
        for (const match of matches) {
            this.renderedPaths.add(match.file.path);
            const card = this.renderCard(parent, match, today);
            if (showPreview) {
                queuePreview(card.createDiv('otd-preview is-pending'), match.file);
            }
        }
    }

    private renderEmpty(parent: HTMLElement, message: string): void {
        parent.createDiv('otd-empty').setText(message);
    }

    private renderCard(parent: HTMLElement, match: OtdMatch, today: Moment): HTMLElement {
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
        meta.createSpan({ text: relativeLabel(match.date, today), cls: 'otd-ago' });
        if (!match.isDailyNote) {
            meta.createSpan({ text: 'other', cls: 'otd-badge' });
        }
        return card;
    }

    private async renderPreview(
        previewEl: HTMLElement,
        file: TFile,
        scope: Component
    ): Promise<void> {
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
            await MarkdownRenderer.render(this.app, body, previewEl, file.path, scope);
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

/** `1 entry`, `3 entries`. */
function entryCount(count: number): string {
    return `${count} ${count === 1 ? 'entry' : 'entries'}`;
}
