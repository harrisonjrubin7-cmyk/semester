// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STATE_TEXT, orderQueue, stateOf, type Assignment } from '../lib/triage';
import { AssignmentStates } from './AssignmentStates';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NOW = new Date(2026, 9, 1, 9, 0).getTime();
const DAY = 86_400_000;
const list: Assignment[] = [
  { id: 'far', course: 'HIST 101', title: 'Term paper', due: NOW + 20 * DAY, label: 'institution_verified', effortMin: 300 },
  { id: 'near', course: 'BIO 200', title: 'Lab report', due: NOW + DAY, label: 'institution_verified', effortMin: 90 },
  { id: 'rev', course: 'ECON 110', title: 'Problem set', due: null, label: 'needs_review' },
  { id: 'blk', course: 'CS 150', title: 'Project', due: NOW + 5 * DAY, label: 'imported', blockedBy: 'the prerequisite quiz' },
  { id: 'fin', course: 'ART 100', title: 'Sketchbook', due: NOW - DAY, label: 'imported', done: true },
];
const html = () => renderToStaticMarkup(<AssignmentStates assignments={list} now={NOW} />);

describe('AssignmentStates', () => {
  it('shows course, title, the state sentence, reasons and what is not known', () => {
    const h = html().replaceAll('&#x27;', "'");
    for (const t of ['HIST 101', 'Term paper', STATE_TEXT.ready, STATE_TEXT.needs_review, 'No due date is saved.', 'What Semester does not know']) {
      expect(h).toContain(t);
    }
    for (const o of ['Start a focus session', 'Reserve time', 'Break into steps', 'Ask for help', 'Not now']) expect(h).toContain(o);
    expect(stateOf(list[0], NOW).state).toBe('ready');
  });

  it('lists open work in orderQueue() order, then the rest in a collapsed group', () => {
    const h = html();
    const ids = [...h.matchAll(/data-assignment="([^"]+)"/g)].map((m) => m[1]);
    const expected = orderQueue(list, NOW).map((a) => a.id);
    expect(ids.slice(0, expected.length)).toEqual(expected);
    expect(expected.indexOf('near')).toBeLessThan(expected.indexOf('far'));
    expect(ids.slice(expected.length).sort()).toEqual(['blk', 'fin']);
    const rest = h.indexOf('Waiting, blocked or finished');
    expect(rest).toBeGreaterThan(h.indexOf('data-assignment="far"'));
    expect(h.slice(h.lastIndexOf('<details', rest), rest)).not.toContain('open');
  });

  it('never shows a score, percentage or ranking', () => {
    const text = html().replace(/<[^>]+>/g, ' ').replace(/\b[A-Z]{2,4} \d{3}\b/g, ' ');
    expect(text).not.toMatch(/\d\s*%|\/\s*\d|\bscore\b|\brank|\bpoints?\b|\bpriority\b/i);
    // Digits appear only in the student's own minutes and dates, never alone as a figure.
    expect(text).not.toMatch(/(^|\s)\d+(\.\d+)?(?=\s|$)(?!\s*minutes)/);
  });
});

describe('AssignmentStates interaction', () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it('calls onOption with the row and the option', async () => {
    const onOption = vi.fn();
    await act(async () => root.render(<AssignmentStates assignments={list} now={NOW} onOption={onOption} />));
    const row = host.querySelector('[data-assignment="near"]')!;
    await act(async () => [...row.querySelectorAll('button')].find((b) => b.textContent === 'Ask for help')!.click());
    expect(onOption).toHaveBeenCalledWith('near', 'help');
  });

  it('ranks the immediate action and groups the alternatives', () => {
    const h = html();
    expect(h).toContain('class="assignment-options-list"');
    expect(h).toContain('<summary>Other ways to handle this</summary>');
    expect(h.indexOf('Start a focus session')).toBeLessThan(h.indexOf('Other ways to handle this'));
  });
});

describe('AssignmentStates empty', () => {
  it('is calm with no assignments', () => {
    expect(renderToStaticMarkup(<AssignmentStates assignments={[]} />)).toContain('No assignments are saved yet.');
  });

  const mk = (id: string): Assignment => ({ id, course: 'ECON 101', title: id, due: NOW + DAY, label: 'institution_verified', effortMin: 45 });

  it('says what the order was made from when there is an order to explain', () => {
    const many = renderToStaticMarkup(<AssignmentStates assignments={[mk('x'), mk('y')]} now={NOW} />);
    expect(many).toContain('Ordered by how soon each is due');
    expect(many).toContain('not a verdict');
    const one = renderToStaticMarkup(<AssignmentStates assignments={[mk('x')]} now={NOW} />);
    expect(one).not.toContain('Ordered by');
  });
});
