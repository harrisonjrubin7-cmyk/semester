// @vitest-environment jsdom
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Combobox, type ComboOption } from './Combobox';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ALL: ComboOption[] = [
  { id: 'econ', label: 'ECON 1020', detail: 'Principles of Microeconomics' },
  { id: 'ecol', label: 'ECOL 2100', detail: 'General Ecology' },
  { id: 'math', label: 'MATH 1300' },
];

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

function Harness({ onChoose }: { onChoose: (o: ComboOption) => void }) {
  const [text, setText] = useState('');
  const options = text.trim() === '' ? [] : ALL.filter((o) => o.label.toLowerCase().includes(text.toLowerCase()));
  return <Combobox label="Find a course" value={text} onValueChange={setText} options={options} onChoose={onChoose} />;
}

const input = () => host.querySelector('input')!;
const list = () => host.querySelector('[role="listbox"]');
const rows = () => [...host.querySelectorAll('[role="option"]')];
function type(value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input(), value);
    input().dispatchEvent(new Event('input', { bubbles: true }));
  });
}
function press(key: string) {
  const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  act(() => {
    input().dispatchEvent(ev);
  });
  return ev;
}

describe('Combobox', () => {
  it('is an editable combobox with a list popup, named by its label', () => {
    act(() => root.render(<Harness onChoose={() => {}} />));
    const el = input();
    expect(el.getAttribute('role')).toBe('combobox');
    expect(el.getAttribute('aria-autocomplete')).toBe('list');
    expect(el.getAttribute('aria-expanded')).toBe('false');
    expect(el.hasAttribute('aria-controls')).toBe(false);
    expect(host.querySelector(`label[for="${el.id}"]`)?.textContent).toBe('Find a course');
    expect(list()).toBeNull();
  });

  it('opens when typing finds something, and stays closed when it finds nothing', () => {
    act(() => root.render(<Harness onChoose={() => {}} />));
    type('ec');
    expect(input().getAttribute('aria-expanded')).toBe('true');
    expect(rows().map((r) => r.firstElementChild?.textContent)).toEqual(['ECON 1020', 'ECOL 2100']);
    expect(input().getAttribute('aria-controls')).toBe(list()!.id);
    type('zzz');
    expect(input().getAttribute('aria-expanded')).toBe('false');
    expect(list()).toBeNull();
  });

  it('moves a virtual cursor with the arrows while real focus stays in the box', () => {
    act(() => root.render(<Harness onChoose={() => {}} />));
    type('ec');
    expect(input().hasAttribute('aria-activedescendant')).toBe(false);
    press('ArrowDown');
    expect(input().getAttribute('aria-activedescendant')).toBe(rows()[0].id);
    expect(rows()[0].getAttribute('aria-selected')).toBe('true');
    expect(rows()[1].getAttribute('aria-selected')).toBe('false');
    press('ArrowDown');
    expect(input().getAttribute('aria-activedescendant')).toBe(rows()[1].id);
    press('ArrowDown'); // wraps
    expect(input().getAttribute('aria-activedescendant')).toBe(rows()[0].id);
    press('ArrowUp'); // wraps back
    expect(input().getAttribute('aria-activedescendant')).toBe(rows()[1].id);
  });

  it('chooses with Enter on the cursor row, closes, and does not eat Enter when no row is chosen', () => {
    const chosen = vi.fn();
    act(() => root.render(<Harness onChoose={chosen} />));
    type('ec');
    expect(press('Enter').defaultPrevented).toBe(false); // no row yet: the form's Enter
    expect(chosen).not.toHaveBeenCalled();
    press('ArrowDown');
    press('ArrowDown');
    expect(press('Enter').defaultPrevented).toBe(true);
    expect(chosen).toHaveBeenCalledWith(ALL[1]);
    expect(list()).toBeNull();
    expect(input().getAttribute('aria-expanded')).toBe('false');
  });

  it('puts the list away with Escape, keeping the text, and clears it with the next', () => {
    act(() => root.render(<Harness onChoose={() => {}} />));
    type('ec');
    press('Escape');
    expect(list()).toBeNull();
    expect(input().value).toBe('ec');
    press('Escape');
    expect(input().value).toBe('');
  });

  it('chooses with a pointer press that does not take focus from the box', () => {
    const chosen = vi.fn();
    act(() => root.render(<Harness onChoose={chosen} />));
    type('ma');
    const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    act(() => {
      rows()[0].dispatchEvent(down);
    });
    expect(down.defaultPrevented).toBe(true);
    expect(chosen).toHaveBeenCalledWith(ALL[2]);
  });

  it('closes on blur', () => {
    act(() => root.render(<Harness onChoose={() => {}} />));
    type('ec');
    act(() => {
      input().dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
    expect(list()).toBeNull();
  });

  it('does nothing with an arrow when closed and empty, and leaves Home and End alone', () => {
    act(() => root.render(<Harness onChoose={() => {}} />));
    expect(press('ArrowDown').defaultPrevented).toBe(false);
    type('ec');
    expect(press('Home').defaultPrevented).toBe(false);
    expect(press('End').defaultPrevented).toBe(false);
  });

  it('shows a second line for a row that has one', () => {
    act(() => root.render(<Harness onChoose={() => {}} />));
    type('ec');
    expect(rows()[0].querySelector('.combo-detail')?.textContent).toBe('Principles of Microeconomics');
  });
});

describe('Combobox accessibility (axe)', () => {
  const violations = async () =>
    (await axe.run(host, { rules: { 'color-contrast': { enabled: false } }, resultTypes: ['violations'] })).violations.map((v) => `${v.id}: ${v.help}`);

  it('has none closed or open', async () => {
    act(() => root.render(<Harness onChoose={() => {}} />));
    expect(await violations()).toEqual([]);
    type('ec');
    press('ArrowDown');
    expect(await violations()).toEqual([]);
  });
});
