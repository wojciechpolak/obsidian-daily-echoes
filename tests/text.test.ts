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

import { describe, expect, it } from 'vitest';
import { stripFrontmatter, truncate } from '../src/text';

describe('stripFrontmatter', () => {
    it('removes a leading YAML block', () => {
        expect(stripFrontmatter('---\ntags: [a]\n---\nBody')).toBe('Body');
    });

    it('leaves a note without frontmatter untouched', () => {
        expect(stripFrontmatter('# Heading\n\nBody')).toBe('# Heading\n\nBody');
    });

    it('only strips at the very start, not a horizontal rule mid-note', () => {
        const content = 'Intro\n\n---\nnot frontmatter\n---\n';
        expect(stripFrontmatter(content)).toBe(content);
    });

    it('stops at the first closing delimiter', () => {
        expect(stripFrontmatter('---\na: 1\n---\nBody\n\n---\nrule\n---\n')).toBe(
            'Body\n\n---\nrule\n---\n'
        );
    });

    it('handles an empty body after frontmatter', () => {
        expect(stripFrontmatter('---\na: 1\n---\n')).toBe('');
    });

    it('handles Windows line endings', () => {
        expect(stripFrontmatter('---\r\ntags: [a]\r\n---\r\nBody\r\n')).toBe('Body\r\n');
    });

    it('handles a UTF-8 BOM before frontmatter', () => {
        expect(stripFrontmatter('\uFEFF---\ntags: [a]\n---\nBody')).toBe('Body');
    });

    it('preserves a BOM when no frontmatter follows it', () => {
        expect(stripFrontmatter('\uFEFF# Heading\n')).toBe('\uFEFF# Heading\n');
    });

    it('handles an empty string', () => {
        expect(stripFrontmatter('')).toBe('');
    });
});

describe('truncate', () => {
    it('leaves text at or under the limit alone', () => {
        expect(truncate('short', 10)).toBe('short');
        expect(truncate('exactly10!', 10)).toBe('exactly10!');
    });

    it('drops a block marker left dangling on the last line', () => {
        // The bullet's text falls outside the limit; keeping the bare "-"
        // renders as a stray "-…" in the preview.
        expect(truncate('Some text about a thing.\n- more words', 27)).toBe(
            'Some text about a thing.…'
        );
        expect(truncate('Some text about a thing.\n## Heading', 28)).toBe(
            'Some text about a thing.…'
        );
        expect(truncate('Some text about a thing.\n1. Item', 28)).toBe('Some text about a thing.…');
    });

    it('keeps a hyphen that is part of the text', () => {
        expect(truncate('a well-known thing here', 14)).toBe('a well-known…');
    });

    it('cuts at a word boundary and appends an ellipsis', () => {
        expect(truncate('the quick brown fox jumps', 16)).toBe('the quick brown…');
    });

    it('hard-cuts when no space falls late enough to be useful', () => {
        // The only space is at index 1, well before 60% of the limit, so
        // breaking there would discard almost everything.
        const result = truncate('a ' + 'x'.repeat(50), 20);
        expect(result).toBe('a ' + 'x'.repeat(18) + '…');
    });

    it('hard-cuts text with no spaces at all', () => {
        expect(truncate('x'.repeat(50), 10)).toBe('x'.repeat(10) + '…');
    });

    it('does not leave trailing whitespace before the ellipsis', () => {
        expect(truncate('alpha beta   gamma delta', 14)).toBe('alpha beta…');
    });

    it('unwraps a link whose URL is cut in half', () => {
        // Rendered, "[the show](https://exa…" would show literal brackets.
        expect(truncate('We saw [the show](https://example.com/a/very/long/url) there', 22)).toBe(
            'We saw the show…'
        );
    });

    it('unwraps a link cut inside its label', () => {
        expect(truncate('We saw [the show](https://example.com) there', 13)).toBe('We saw the…');
    });

    it('keeps a link that fits whole', () => {
        const text = 'We saw [it](https://example.com) and then went home';
        expect(truncate(text, 34)).toBe('We saw [it](https://example.com)…');
    });

    it('unwraps a half-written wikilink, preferring its alias', () => {
        // The cut lands inside the closing "]]", leaving a lone bracket.
        expect(truncate('See [[Somepage]] and more', 15)).toBe('See Somepage…');
        expect(truncate('See [[Page|thealias]] here', 19)).toBe('See thealias…');
    });

    it('drops an image or embed left without its target', () => {
        expect(truncate('Photo: ![a cat](https://example.com/cat.png) here', 26)).toBe('Photo:…');
        expect(truncate('Photo: ![[cat.png]] here', 15)).toBe('Photo:…');
    });

    it('leaves bracket text that is not a link alone', () => {
        expect(truncate('- [ ] buy milk and bread', 16)).toBe('- [ ] buy milk…');
        expect(truncate('A claim[^1] with a footnote', 15)).toBe('A claim[^1]…');
    });
});
