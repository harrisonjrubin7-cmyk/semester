// @vitest-environment jsdom
import { act } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { toolMarkup } from '../render';
import { TOOL_LIST, Tool, agendaText, type ToolId, type ToolProps } from './Tools';
import { STATUS_LABEL } from '../../lib/ops/claims';
import { MODULES } from '../modules';

/**
 * The tools as a visitor meets them: prerendered by `render.tsx`, then
 * hydrated the way `client.tsx` does it, then used.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
let host: HTMLDivElement;

/* No root outlives the test that made it. See `src/rootunmount.test.ts`. */
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  // Not every test hydrates: the agenda text test makes no host, and run
  // first in a shuffled order this read `.remove` of undefined.
  (host as HTMLDivElement | undefined)?.remove();
});

function hydrate(id: ToolId, recoverable: (e: unknown) => void = () => {}) {
  const { html, props } = toolMarkup(id, new Date(2026, 8, 27));
  host = document.createElement('div');
  host.innerHTML = html;
  document.body.append(host);
  act(() => {
    root = hydrateRoot(host, <Tool id={id} props={JSON.parse(props) as ToolProps} />, { onRecoverableError: recoverable });
  });
}

const type = (el: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const field = (label: RegExp) => {
  const l = [...host.querySelectorAll('label')].find((x) => label.test(x.textContent ?? ''))!;
  return l.querySelector('input, textarea, select') as HTMLInputElement;
};
const button = (name: RegExp) => [...host.querySelectorAll('button')].find((b) => name.test(b.textContent ?? ''))!;

it('hydrates every tool without a mismatch', () => {
  for (const { id } of TOOL_LIST) {
    const errors: unknown[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...a) => errors.push(a));
    hydrate(id, (e) => errors.push(e));
    spy.mockRestore();
    expect(errors, id).toEqual([]);
    act(() => root!.unmount());
    root = undefined;
    host.remove();
  }
  host = document.createElement('div');
});

it('projects a finish from the app’s own graduation logic, labelled an estimate', () => {
  hydrate('graduation');
  // From Spring 2027 at 15 a term, 90 credits is six terms: Spring 2027 … Fall 2029.
  expect(host.textContent).toContain('You could finish in Fall 2029: 6 fall or spring terms');
  expect(host.textContent).toContain('Estimated');
  type(field(/per fall or spring/), '12');
  expect(host.textContent).toContain('Fall 2030: 8 fall or spring terms');
  type(field(/per summer/), '6');
  expect(host.textContent).toMatch(/and \d+ summers?/);
});

it('finds the conflict in the example schedule, and clears it when a class goes', () => {
  hydrate('schedule');
  expect(host.textContent).toContain('7 credits · 1 time conflict');
  expect(host.textContent).toContain('ECON 1010 and MATH 1100 overlap on Mon, Wed.');
  act(() => button(/Remove class 2/).click());
  expect(host.textContent).toContain('3 credits · no time conflicts');
  act(() => button(/Add a class/).click());
  expect(host.querySelectorAll('fieldset')).toHaveLength(2);
});

it('counts what is ready on the checklist', () => {
  hydrate('checklist');
  expect(host.textContent).toMatch(/0 of \d+ ready/);
  act(() => (host.querySelector('input[type="checkbox"]') as HTMLInputElement).click());
  expect(host.textContent).toMatch(/1 of \d+ ready/);
});

it('builds an agenda the student copies themselves, and says nothing is sent', async () => {
  hydrate('advisor');
  type(field(/My questions/), 'Can I add a minor?\n\nIs ECON 3000 offered in spring?');
  expect(host.querySelector('pre')?.textContent).toContain('1. Can I add a minor?\n2. Is ECON 3000 offered in spring?');
  const writeText = vi.fn(() => Promise.resolve());
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true, writable: true });
  await act(async () => button(/Copy agenda/).click());
  expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Advisor meeting agenda'));
  expect(host.textContent).toContain('Semester sends nothing');
  Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true, writable: true });
  await act(async () => button(/Copy agenda/).click());
  expect(host.textContent).toContain('Could not copy');
});

it('writes an agenda with gaps marked rather than hidden', () => {
  const text = agendaText({ when: '', where: '', questions: ['', '  '], decisions: '' });
  expect(text).not.toContain('When:');
  expect(text).toContain('(not filled in)');
  expect(text).toContain('(none yet)');
  expect(text).toContain('not an official record');
  expect(agendaText({ when: ' Tue 2pm ', where: 'x', questions: ['a'], decisions: 'y' })).toContain('When: Tue 2pm');
});

const aria = (name: string) => host.querySelector(`input[aria-label="${name}"]`) as HTMLInputElement;

it('works the stack comparison out from what is typed, and counts nothing until every part is entered', () => {
  hydrate('stack');
  expect(host.textContent).toContain('Enter what you pay today for at least one system');
  const A = 'Assignments and submissions';
  const B = 'Gradebook and rubrics';
  type(aria(`${A}: Current cost per year ($)`), '100000');
  type(aria(`${A}: Contract ends after year`), '2');
  type(aria(`${A}: Replacement available from year`), '1');
  // No Semester price yet: the calculator does not supply one, so nothing is saved.
  expect(host.textContent).toContain('$0 saved: no system is switched off on these inputs.');
  expect(host.textContent).toContain('no Semester price entered');
  type(aria(`${A}: Semester price per year ($, your quote)`), '60000');
  type(aria(`${A}: One-time migration ($)`), '30000');
  type(aria(`${A}: Admin hours freed per year`), '200');
  type(aria(`${B}: Current cost per year ($)`), '50000');
  type(aria(`${B}: Replacement available from year`), '2');
  type(aria(`${B}: Semester price per year ($, your quote)`), '20000');
  type(aria(`${B}: Admin hours freed per year`), '100');
  // Worked by hand in stackcost.test.ts: 750,000 today, 540,000 with Semester, payback in month 13.
  expect(host.textContent).toContain('$210,000 saved over five years on these inputs.');
  expect(host.textContent).toContain('Current stack: $750,000. With Semester: $540,000.');
  expect(host.textContent).toContain('month 13 (year 2)');
  expect(host.textContent).toContain('Admin hours freed: 1,000 over five years (your figure).');
});

it('says what the register says about every module, and that the year is the school’s assumption', () => {
  hydrate('stack');
  expect(host.textContent).toContain('the register calls 14 of 14 modules here below “Available now”');
  expect(host.textContent).toContain('Semester Core is planned and has set no date');
  const registerCells = [...host.querySelectorAll('tbody tr')].map((tr) => tr.children[1]?.textContent);
  expect(registerCells).toHaveLength(14);
  expect(registerCells).toEqual(MODULES.map((m) => STATUS_LABEL[m.status]));
  expect(registerCells).not.toContain('Available now');
  expect(host.textContent).toContain('Semester has no published institutional price');
});

it('labels the illustrative numbers as placeholders, and drops the label when the visitor types', () => {
  hydrate('stack');
  act(() => button(/Fill with illustrative numbers/).click());
  expect(host.textContent).toContain('Illustrative numbers: placeholders, not Semester’s prices or any school’s costs.');
  expect(host.textContent).toContain('Systems switched off: 14 of 14');
  type(aria('Degree audit: Current cost per year ($)'), '1');
  expect(host.textContent).not.toContain('Illustrative numbers: placeholders');
  act(() => button(/Clear all/).click());
  expect(host.textContent).toContain('Enter what you pay today for at least one system');
});

it('downloads the comparison as a CSV without sending it anywhere', async () => {
  hydrate('stack');
  act(() => button(/Fill with illustrative numbers/).click());
  const made: Blob[] = [];
  Object.defineProperty(URL, 'createObjectURL', { value: (b: Blob) => (made.push(b), 'blob:x'), configurable: true, writable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: () => {}, configurable: true, writable: true });
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  act(() => button(/Download CSV/).click());
  click.mockRestore();
  expect(made).toHaveLength(1);
  const text = await new Promise<string>((done) => {
    const reader = new FileReader();
    reader.onload = () => done(String(reader.result));
    reader.readAsText(made[0]);
  });
  expect(text).toContain('planning estimate');
  expect(text).toContain('Payback month,25');
  expect(text).toContain('Planned');
});
