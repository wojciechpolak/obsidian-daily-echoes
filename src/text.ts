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
 * Pure text helpers used when building note previews. Kept free of Obsidian
 * imports so they stay unit-testable outside the app.
 */

/** Remove a leading YAML frontmatter block, if present. */
export function stripFrontmatter(content: string): string {
    const match = content.match(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/);
    return match ? content.slice(match[0].length) : content;
}

/**
 * Repair a bracket construct left half-written by a cut. A `[label](url` or
 * `[[wikilink` fragment renders as literal brackets, so unwrap it to its plain
 * label; an image or embed is meaningless without its target, so drop it.
 * Complete constructs are returned untouched.
 */
function healDanglingLink(text: string): string {
    const open = text.lastIndexOf('[');
    if (open < 0) {
        return text;
    }
    const isWiki = open > 0 && text[open - 1] === '[';
    const openLen = isWiki ? 2 : 1;
    const start = open - (openLen - 1);
    const body = text.slice(start);
    const closer = isWiki ? ']]' : ']';
    const end = body.indexOf(closer, openLen);
    if (end >= 0) {
        const after = body.slice(end + closer.length);
        // Closed and not mid-URL: a real link, a footnote ref, a task
        // checkbox — nothing to heal.
        if (!after.startsWith('(') || after.includes(')')) {
            return text;
        }
    }
    const isEmbed = start > 0 && text[start - 1] === '!';
    const head = text.slice(0, isEmbed ? start - 1 : start);
    if (isEmbed) {
        return head;
    }
    // A cut inside `]]` leaves a lone `]` on the label.
    const label = (end >= 0 ? body.slice(openLen, end) : body.slice(openLen)).replace(/\]+$/, '');
    // `[[Page|Alias` shows the alias; a plain `[[Page` shows the page name.
    return head + (isWiki ? label.slice(label.lastIndexOf('|') + 1) : label);
}

/** Truncate at a word boundary near `limit`, adding an ellipsis. */
export function truncate(text: string, limit: number): string {
    if (text.length <= limit) {
        return text;
    }
    const slice = text.slice(0, limit);
    const lastSpace = slice.lastIndexOf(' ');
    const cut = lastSpace > limit * 0.6 ? slice.slice(0, lastSpace) : slice;
    // Cutting mid-document can leave a bare block marker on the last line — a
    // list bullet or heading whose text fell outside the limit. Rendered, that
    // shows up as a stray "-…", so drop it.
    return (
        healDanglingLink(cut.trimEnd())
            .trimEnd()
            .replace(/(?:^|\n)\s*(?:[-*+>]|#{1,6}|\d+\.)\s*$/, '') + '…'
    );
}
