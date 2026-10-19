import assert from 'node:assert/strict';
import test from 'node:test';
import { parseLinkList } from '../src/renderer/src/components/workbench/linkListInput.mjs';

test('plain TXT accepts UTF-8 BOM, blank lines and Windows newlines in source order', () => {
  assert.deepEqual(parseLinkList('\uFEFFhttps://example.org/a\r\n\r\n https://example.org/b.mp3 '), {entries:[{url:'https://example.org/a',line:1},{url:'https://example.org/b.mp3',line:3}],invalid:[]});
});

test('Markdown accepts linked titles and lists, ignores headings/comments, and preserves original line numbers', () => {
  const parsed = parseLinkList('# Collection\n<!-- note\nhttps://ignored.example.org/\n-->\n- [Title](https://example.org/a)\n1. https://example.org/b\n- [ ] https://example.org/c\n```text\nhttps://example.org/d\n```\nBad row');
  assert.deepEqual(parsed.entries.map(entry => entry.line), [5,6,7,9]);
  assert.deepEqual(parsed.entries.map(entry => entry.url), ['https://example.org/a','https://example.org/b','https://example.org/c','https://example.org/d']);
  assert.deepEqual(parsed.invalid, [{line:11,error:'invalidLinkLine'}]);
});

test('multiple links on one line, unsafe schemes and image references are reported without losing valid lines', () => {
  const parsed = parseLinkList('https://example.org/a https://example.org/b\njavascript:alert(1)\n![image](https://example.org/picture.png)\nhttps://example.org/good');
  assert.deepEqual(parsed.invalid, [{line:1,error:'oneLinkPerLine'},{line:2,error:'invalidLinkLine'},{line:3,error:'invalidLinkLine'}]);
  assert.equal(parsed.entries[0].url, 'https://example.org/good');
});
