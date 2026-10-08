// @vitest-environment jsdom
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DateField } from './DateField';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function Harness(props: { min?: string; max?: string; required?: boolean; error?: string; hint?: string }) {
  const [v, setV] = useState('');
  return <DateField label="Due date" value={v} onChange={setV} {...props} />;
}
const input = () => host.querySelector('input')!;
const message = () => host.querySelector('.field-message')!.textContent ?? '';
function set(value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input(), value);
    input().dispatchEvent(new Event('input', { bubbles: true }));
  });
}
const leave = () => act(() => void input().dispatchEvent(new FocusEvent('focusout', { bubbles: true })));

describe('DateField', () => {
  it('is the browser’s own date control, named by a visible label', () => {
    act(() => root.render(<Harness />));
    expect(input().type).toBe('date');
    expect(host.querySelector(`label[for="${input().id}"]`)?.textContent).toBe('Due date');
  });

  it('does not nag mid-entry, and says what is wrong once the person leaves', () => {
    act(() => root.render(<Harness min="2026-10-01" />));
    set('2026-09-01');
    expect(message()).not.toMatch(/on or after/);
    expect(input().getAttribute('aria-invalid')).toBeNull();
    leave();
    expect(message()).toMatch(/Enter a date on or after .*October.*2026/);
    expect(input().getAttribute('aria-invalid')).toBe('true');
    expect(input().getAttribute('aria-describedby')).toContain(host.querySelector('.field-message')!.id);
  });

  it('clears the complaint when the date is fixed', () => {
    act(() => root.render(<Harness min="2026-10-01" />));
    set('2026-09-01');
    leave();
    set('2026-10-15');
    expect(input().getAttribute('aria-invalid')).toBeNull();
    expect(message()).not.toMatch(/on or after/);
  });

  it('asks for a required date only after it has been left blank', () => {
    act(() => root.render(<Harness required />));
    expect(message()).toBe('');
    leave();
    expect(message()).toMatch(/Enter a date\./);
    expect(host.querySelector('label')?.textContent).toContain('(required)');
  });

  it('shows the caller’s own error at once, ahead of the range check', () => {
    act(() => root.render(<Harness error="That date is a holiday." />));
    expect(message()).toContain('That date is a holiday.');
  });

  it('ties the hint to the box', () => {
    act(() => root.render(<Harness hint="The day the work is due." />));
    expect(input().getAttribute('aria-describedby')).toContain(host.querySelector('.combo-hint')!.id);
  });
});

describe('DateField accessibility (axe)', () => {
  it('has none, clean or in error', async () => {
    const run = async () =>
      (await axe.run(host, { rules: { 'color-contrast': { enabled: false } }, resultTypes: ['violations'] })).violations.map((v) => `${v.id}: ${v.help}`);
    act(() => root.render(<Harness min="2026-10-01" hint="The day the work is due." required />));
    expect(await run()).toEqual([]);
    set('2026-09-01');
    leave();
    expect(await run()).toEqual([]);
  });
});
