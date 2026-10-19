// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { GRADUATION_KEY } from '../lib/graduation';
import { GraduationSimulator } from './GraduationSimulator';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(
    GRADUATION_KEY,
    JSON.stringify({
      plan: { needed: 120, perTerm: 15, summer: 0, costPerTerm: 20000, summerCost: 0, next: { season: 'Spring', year: 2027 } },
      scenarios: [],
    }),
  );
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  localStorage.clear();
});

it('labels the whole projection as an estimate with a source badge, not a degree audit', () => {
  act(() => root.render(<GraduationSimulator done={60} />));
  const note = host.querySelector('#grad-plan')!.closest('section')!;
  expect(note.querySelector('[data-source="estimated"]')).not.toBeNull();
  expect(note.textContent).toContain('A planning estimate, not an official degree audit');
});

it('projects a finish from the transcript hours and calls it an estimate', () => {
  act(() => root.render(<GraduationSimulator done={60} />));
  expect(host.textContent).toContain('Fall 2028');
  expect(host.textContent).toContain('Cost of one more semester: about $20,000.');
  expect(host.textContent).toContain('estimate');
  // Said on the screen, not implied: this is the one figure a student could take
  // to a registration decision as though an office had checked it.
  expect(host.textContent).toContain('not an official degree audit');
});

it('says what kind of record the estimate is, whose it is, and where the official one is', () => {
  act(() => root.render(<GraduationSimulator done={60} />));
  const label = host.querySelector('[data-record="degree_audit"]')!;
  expect(label).not.toBeNull();
  const text = label.textContent ?? '';
  for (const phrase of ['Degree audit', 'The registrar', 'Not verified by the record’s owner', 'Certify your progress', 'run your school’s official degree audit']) {
    expect(text, phrase).toContain(phrase);
  }
  // It sits beside the estimate, before any control, so it is read first.
  const first = host.querySelector('.graduation-simulator input, .graduation-simulator select')!;
  expect(label.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it('adds a what-if scenario and compares it with the current plan', () => {
  act(() => root.render(<GraduationSimulator done={60} />));
  const pick = [...host.querySelectorAll('select')].find((s) => s.closest('label')?.textContent?.startsWith('Add a scenario'))!;
  act(() => {
    pick.value = 'minor';
    pick.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(host.textContent).toContain('Add a minor');
  expect(host.textContent).toContain('2 terms more than your current plan. About $40,000 more.');
  expect(JSON.parse(localStorage.getItem(GRADUATION_KEY)!).scenarios).toHaveLength(1);
  expect(host.textContent).not.toMatch(/\bbehind\b|at risk|failing/i);
});

it('previews device-only scenario removal and preserves it when cancelled', () => {
  localStorage.setItem(
    GRADUATION_KEY,
    JSON.stringify({
      plan: { needed: 120, perTerm: 15, summer: 0, costPerTerm: 20000, summerCost: 0, next: { season: 'Spring', year: 2027 } },
      scenarios: [{
        id: 'minor-1',
        name: 'Add a minor',
        extra: 18,
        perTerm: 12,
        summer: 3,
        cloudIds: { u1: '11111111-1111-4111-8111-111111111111' },
      }],
    }),
  );
  act(() => root.render(<GraduationSimulator done={60} accountId="u1" simulator />));

  const removalName = 'Remove scenario 1 of 1, Add a minor: 18 additional credits · 12 credits per fall or spring · 3 credits each summer · no study abroad adjustment';
  act(() => host.querySelector<HTMLButtonElement>(`button[aria-label="${removalName}"]`)!.click());

  expect(host.textContent).toContain('Remove this scenario from this device?');
  expect(host.textContent).toContain('18 additional credits, 12 credits per fall or spring, and 3 credits each summer');
  expect(host.textContent).toContain('The draft saved to your account stays there');
  expect(JSON.parse(localStorage.getItem(GRADUATION_KEY)!).scenarios).toHaveLength(1);

  const cancel = [...host.querySelectorAll('button')].find((button) => button.textContent === 'Cancel')!;
  act(() => cancel.click());
  expect(JSON.parse(localStorage.getItem(GRADUATION_KEY)!).scenarios).toHaveLength(1);

  act(() => host.querySelector<HTMLButtonElement>(`button[aria-label="${removalName}"]`)!.click());
  const confirm = [...host.querySelectorAll('button')].find((button) => button.textContent === 'Remove scenario')!;
  act(() => confirm.click());
  expect(JSON.parse(localStorage.getItem(GRADUATION_KEY)!).scenarios).toHaveLength(0);
  expect(host.textContent).toContain('removed from this device');
});

it('distinguishes same-name scenario removals by position and represented assumptions', () => {
  localStorage.setItem(
    GRADUATION_KEY,
    JSON.stringify({
      plan: { needed: 120, perTerm: 15, summer: 0, costPerTerm: 20000, summerCost: 0, next: { season: 'Spring', year: 2027 } },
      scenarios: [
        { id: 'minor-1', name: 'Add a minor', extra: 18, perTerm: 12, summer: 3 },
        { id: 'minor-2', name: 'Add a minor', extra: 24, perTerm: 15, summer: 0, abroad: { terms: 1, credits: 12, costPerTerm: 25000 } },
      ],
    }),
  );
  act(() => root.render(<GraduationSimulator done={60} />));

  const first = 'Remove scenario 1 of 2, Add a minor: 18 additional credits · 12 credits per fall or spring · 3 credits each summer · no study abroad adjustment';
  const second = 'Remove scenario 2 of 2, Add a minor: 24 additional credits · 15 credits per fall or spring · 0 credits each summer · 1 term abroad with 12 expected transfer credits at $25,000 per term';
  expect(host.querySelector(`button[aria-label="${first}"]`)).not.toBeNull();
  const removeSecond = host.querySelector<HTMLButtonElement>(`button[aria-label="${second}"]`)!;
  expect(removeSecond).not.toBeNull();

  act(() => removeSecond.click());
  expect(host.textContent).toContain('24 additional credits, 15 credits per fall or spring, and 0 credits each summer');
  expect(host.textContent).toContain('1 term abroad with 12 expected transfer credits');
  act(() => [...host.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent === 'Remove scenario')!.click());

  expect(JSON.parse(localStorage.getItem(GRADUATION_KEY)!).scenarios.map((scenario: { id: string }) => scenario.id)).toEqual(['minor-1']);
});

it('shows the editable assumptions behind the plan estimate', () => {
  act(() => root.render(<GraduationSimulator done={60} />));
  expect(host.textContent).toContain('This plan assumes');
  expect(host.textContent).toContain('15 credits per fall or spring');
  expect(host.textContent).toContain('Course sequencing and financial aid are not included');
  const edit = [...host.querySelectorAll('button')].find(b => b.textContent === 'Edit assumptions');
  expect(edit).toBeDefined();
  act(() => edit!.click());
  expect(document.activeElement).toBe(host.querySelector('.graduation-simulator input'));
});
