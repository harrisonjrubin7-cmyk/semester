// @vitest-environment jsdom
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ConfirmDialog } from '../ConfirmDialog';
import { fromSourceLabel } from '../../lib/factprovenance';
import { ActionPreview, recoveryLine, type Recovery } from './ActionPreview';

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

const labels = () => [...host.querySelectorAll('dt')].map((d) => d.textContent);
const values = () => [...host.querySelectorAll('dd')].map((d) => d.textContent);

describe('recoveryLine', () => {
  it('says each kind, and what to do when there is something to do', () => {
    expect(recoveryLine({ kind: 'undo' })).toBe('You can undo this.');
    expect(recoveryLine({ kind: 'undo', how: 'It stays in Recently removed for 30 days.' })).toBe('You can undo this. It stays in Recently removed for 30 days.');
    expect(recoveryLine({ kind: 'request', how: 'ask the Registrar’s office.' })).toBe('This can be reversed on request: ask the Registrar’s office.');
    expect(recoveryLine({ kind: 'none' })).toBe('This can’t be undone.');
    expect(recoveryLine({ kind: 'none', how: 'You can share again.' })).toBe('This can’t be undone. You can share again.');
  });

  it('refuses at the type level to leave reversibility out, or to promise a reversal with no way to ask', () => {
    // @ts-expect-error — `recovery` is required
    const missing = <ActionPreview says="x" />;
    // @ts-expect-error — a `request` recovery needs `how`
    const noHow: Recovery = { kind: 'request' };
    expect(missing).toBeTruthy();
    expect(noHow.kind).toBe('request');
  });
});

describe('ActionPreview', () => {
  it('asks the questions in the order a person does, and only the ones that apply', () => {
    act(() =>
      root.render(
        <ActionPreview
          subject="Midterm"
          says="Your advisor can open it until 20 December."
          exactly={<pre>Agenda…</pre>}
          doesNotChange="Your private notes stay private."
          subjectTo="Subject to your school’s official audit."
          recovery={{ kind: 'undo', how: 'Revoke it from Trust Center.' }}
        />,
      ),
    );
    expect(host.querySelector('.action-preview-subject')?.textContent).toBe('Midterm');
    expect(labels()).toEqual(['What happens', 'Exactly what', 'What stays the same', 'Taking it back']);
    expect(values()[3]).toBe('You can undo this. Revoke it from Trust Center.');
    expect(host.querySelector('.action-preview-caveat')?.textContent).toBe('Subject to your school’s official audit.');
  });

  it('draws no empty labels for what it was not given', () => {
    act(() => root.render(<ActionPreview says="Signs out every other device." recovery={{ kind: 'none' }} />));
    expect(labels()).toEqual(['What happens', 'Taking it back']);
    expect(host.querySelector('.action-preview-subject')).toBeNull();
    expect(host.querySelector('.action-preview-caveat')).toBeNull();
    expect(host.querySelector('.prov')).toBeNull();
  });

  it('draws provenance in the one vocabulary when given', () => {
    act(() =>
      root.render(<ActionPreview says="Publishes it to students." recovery={{ kind: 'request', how: 'withdraw it from the desk.' }} provenance={fromSourceLabel('institution_verified', { authority: 'Registrar' })} />),
    );
    expect(host.querySelector('.prov')?.textContent).toContain('Registrar');
  });

  it('has every label paired with a value', () => {
    act(() => root.render(<ActionPreview says="x" exactly="y" doesNotChange="z" recovery={{ kind: 'undo' }} />));
    expect(labels()).toHaveLength(values().length);
  });
});

describe('ActionPreview inside ConfirmDialog', () => {
  it('fills the preview slot, with focus on Cancel and the confirm button still the only way to commit', () => {
    const onConfirm = vi.fn();
    act(() =>
      root.render(
        <ConfirmDialog
          title="Revoke this share?"
          preview={<ActionPreview subject="Midterm plan" says="Your advisor can no longer open it." recovery={{ kind: 'none', how: 'You can share it again.' }} />}
          confirmLabel="Revoke"
          onConfirm={onConfirm}
          onCancel={() => {}}
        />,
      ),
    );
    const dialog = host.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.querySelector('.action-preview')).not.toBeNull();
    expect(document.activeElement?.textContent).toBe('Cancel');
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('ActionPreview accessibility (axe)', () => {
  it('has none', async () => {
    act(() =>
      root.render(
        <ActionPreview subject="Midterm" says="Shared." exactly="The summary." doesNotChange="Notes." subjectTo="Caveat." recovery={{ kind: 'undo' }} provenance={fromSourceLabel('estimated')} />,
      ),
    );
    const r = await axe.run(host, { rules: { 'color-contrast': { enabled: false } }, resultTypes: ['violations'] });
    expect(r.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});
