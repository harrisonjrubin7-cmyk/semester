import assert from 'node:assert/strict';
import test from 'node:test';
import { cell } from '../scripts/coverage-markdown.ts';

test('a table cell escapes a pipe so it cannot end the cell', () => {
  assert.equal(cell('a|b'), 'a\\|b');
});

test('a backslash is escaped before a pipe, so a trailing backslash cannot escape the next cell boundary', () => {
  // Input `a\|b` must render as the text `a\|b`: a doubled backslash, then an escaped pipe.
  assert.equal(cell('a\\|b'), 'a\\\\\\|b');
  assert.equal(cell('ends-with-backslash\\'), 'ends-with-backslash\\\\');
});
