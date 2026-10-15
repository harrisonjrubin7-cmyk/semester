// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ErrorSummary, FieldMessage, fieldProps, messageId, useFieldErrors } from './FieldMessage';

/**
 * The shared field-error pattern, driven the way a form drives it.
 *
 * Two boxes, a hint on both, and a submit that checks them. Everything the
 * audit asked for is asserted from the DOM a screen reader would read:
 * `aria-invalid` only while wrong, `aria-describedby` reaching the hint and a
 * message that exists, words plus an icon rather than colour, focus on the
 * first wrong box *in screen order*, and no `role="alert"`.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function Form({ summary = false }: { summary?: boolean }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const fields = useFieldErrors(['name', 'amount'] as const);
  return (
    <>
      {summary ? <ErrorSummary {...fields.summary({ name: 'Name', amount: 'Amount' })} /> : null}
      <p id="hint">Both are needed.</p>
      <input
        aria-label="Name"
        value={name}
        {...fields.control('name', 'hint')}
        onChange={(e) => {
          setName(e.target.value);
          fields.clear('name');
        }}
      />
      <FieldMessage {...fields.message('name')} />
      <input
        aria-label="Amount"
        value={amount}
        {...fields.control('amount', 'hint')}
        onChange={(e) => {
          setAmount(e.target.value);
          fields.clear('amount');
        }}
      />
      <FieldMessage {...fields.message('amount')} />
      <button
        type="button"
        onClick={() =>
          fields.check({
            // Deliberately listed in the opposite order from the screen.
            amount: /^\d+$/.test(amount) ? '' : 'Amount has to be a number.',
            name: name.trim() ? '' : 'Say what it is.',
          })
        }
      >
        Add
      </button>
    </>
  );
}

const box = (label: string) => host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
const described = (el: HTMLElement) =>
  (el.getAttribute('aria-describedby') ?? '').split(' ').map((id) => document.getElementById(id));
const submit = () => act(() => host.querySelector('button')!.click());

function type(el: HTMLInputElement, value: string) {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('a field with the shared error pattern', () => {
  it('is not invalid, and its description resolves, before anything is wrong', () => {
    act(() => root.render(<Form />));
    const name = box('Name');
    expect(name.hasAttribute('aria-invalid')).toBe(false);
    // Hint and message both exist — the message is present while empty, so
    // the reference never dangles.
    const [hint, message] = described(name);
    expect(hint?.textContent).toBe('Both are needed.');
    expect(message).not.toBeNull();
    expect(message!.textContent).toBe('');
  });

  it('on a failed submit marks each wrong box, says why in words and an icon, and moves focus to the first on screen', () => {
    act(() => root.render(<Form />));
    type(box('Amount'), 'lots');
    submit();

    for (const [label, said] of [
      ['Name', 'Say what it is.'],
      ['Amount', 'Amount has to be a number.'],
    ] as const) {
      const el = box(label);
      expect(el.getAttribute('aria-invalid')).toBe('true');
      const message = described(el)[1]!;
      expect(message.id).toBe(messageId(el.id));
      expect(message.textContent).toBe(`Error: ${said}`);
      // Not colour alone: an icon is drawn, hidden from the reader because the
      // words already say it.
      expect(message.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    }

    // Name is first on screen though the check listed Amount first.
    expect(document.activeElement).toBe(box('Name'));
    // Announced by focus arriving and by a polite region — never an alert.
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect([...host.querySelectorAll('.field-message')].map((m) => m.getAttribute('aria-live'))).toEqual([
      'polite',
      'polite',
    ]);
  });

  it('is still announced when the submit comes from the field that is wrong', () => {
    // Enter in the Timers box: focus is already on the box, so moving it
    // there again fires nothing. The region was in the document, empty,
    // before the text arrived — which is what makes the insertion heard.
    act(() => root.render(<Form />));
    type(box('Name'), 'Rent');
    const amount = box('Amount');
    amount.focus();
    const region = described(amount)[1]!;
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.textContent).toBe('');
    submit();
    expect(document.activeElement).toBe(amount);
    expect(described(amount)[1]).toBe(region);
    expect(region.textContent).toBe('Error: Amount has to be a number.');
  });

  it('forgets a field’s error when it is edited, and focuses the next wrong one on the next submit', () => {
    act(() => root.render(<Form />));
    submit();
    type(box('Name'), 'Rent');
    expect(box('Name').hasAttribute('aria-invalid')).toBe(false);
    expect(described(box('Name'))[1]!.textContent).toBe('');
    expect(box('Amount').getAttribute('aria-invalid')).toBe('true');

    submit();
    expect(document.activeElement).toBe(box('Amount'));
  });

  it('passes a clean submit through without moving focus', () => {
    act(() => root.render(<Form />));
    type(box('Name'), 'Rent');
    type(box('Amount'), '12');
    const button = host.querySelector('button')!;
    button.focus();
    submit();
    expect(document.activeElement).toBe(button);
    expect(host.querySelectorAll('[aria-invalid]')).toHaveLength(0);
  });
});

describe('a field checked as it is typed', () => {
  it('uses a polite live region, never an alert', () => {
    act(() => root.render(<FieldMessage id="proxy" error="That is an API key, not an address." />));
    const message = host.querySelector('.field-message')!;
    expect(message.getAttribute('aria-live')).toBe('polite');
    expect(message.getAttribute('role')).toBeNull();
    expect(message.id).toBe('proxy-error');
  });

  it('builds the box’s attributes from the same ids', () => {
    expect(fieldProps('proxy', 'Wrong', 'h')).toEqual({
      id: 'proxy',
      'aria-invalid': true,
      'aria-describedby': 'h proxy-error',
    });
    expect(fieldProps('proxy', undefined)).toEqual({
      id: 'proxy',
      'aria-invalid': undefined,
      'aria-describedby': 'proxy-error',
    });
  });
});

describe('ErrorSummary', () => {
  const links = () => [...host.querySelectorAll<HTMLAnchorElement>('.error-summary a')];

  it('draws nothing before a submit, and nothing for a single problem', () => {
    act(() => root.render(<Form summary />));
    expect(host.querySelector('.error-summary')).toBeNull();
    type(box('Name'), 'Book');
    type(box('Amount'), 'lots');
    submit();
    // One wrong field: focus is on it and its own message is live; no summary.
    expect(host.querySelector('.error-summary')).toBeNull();
    expect(document.activeElement).toBe(box('Amount'));
  });

  it('lists every problem in screen order, as a named group of links', () => {
    act(() => root.render(<Form summary />));
    submit();
    const group = host.querySelector('.error-summary')!;
    expect(group.getAttribute('aria-labelledby')).toBe(group.querySelector('h3')!.id);
    expect(group.querySelector('h3')!.textContent).toBe('2 things need fixing');
    // `check` was given amount first; the list follows the screen: name, then amount.
    expect(links().map((a) => a.textContent)).toEqual(['Name: Say what it is.', 'Amount: Amount has to be a number.']);
    // Not a live region and not an alert: the first wrong field already speaks.
    expect(group.hasAttribute('aria-live')).toBe(false);
    expect(group.hasAttribute('role')).toBe(false);
  });

  it('moves focus to the field a link names, without touching the address', () => {
    act(() => root.render(<Form summary />));
    submit();
    expect(document.activeElement).toBe(box('Name'));
    const before = window.location.href;
    act(() => links()[1]!.click());
    expect(document.activeElement).toBe(box('Amount'));
    expect(window.location.href).toBe(before);
  });

  it('shrinks as the person fixes fields, and goes when one is left', () => {
    act(() => root.render(<Form summary />));
    submit();
    type(box('Name'), 'Book');
    expect(host.querySelector('.error-summary')).toBeNull();
  });
});
