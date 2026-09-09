// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ReactNode } from 'react';
import { FilePick } from './ui';

/**
 * The one press in this app that must never be a press that does nothing.
 *
 * Every file input here was `display: none`, opened by a button calling
 * `.click()` on a ref. That is three ways for the control to fail silently —
 * a ref that is null, an engine that declines to open a picker for an element
 * that is not rendered, and a scripted click outside what the browser counts
 * as a gesture — and none of them throws, so the whole of it looks like an
 * app that ignores you.
 *
 * `FilePick` puts the real input across the button at zero opacity, so the
 * press lands on the control the browser already knows how to open. These are
 * the properties that keeps true.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

function show(node: ReactNode) {
  act(() => {
    root.render(node);
  });
}

const input = () => host.querySelector('input[type=file]') as HTMLInputElement;

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('FilePick', () => {
  it('renders a real input inside the label, never a hidden one', () => {
    show(
      <FilePick accept=".pdf" onPick={() => {}}>
        Choose files
      </FilePick>,
    );
    const el = input();
    expect(el).toBeTruthy();
    // The failure this exists to stop: `display: none` is the one state some
    // engines refuse to open a picker for, and it is invisible to every test
    // that only asks whether the button is on screen.
    expect(el.style.display).not.toBe('none');
    expect(el.style.visibility).not.toBe('hidden');
    expect(el.closest('label')?.textContent).toContain('Choose files');
    // Focusable, so the keyboard opens it too.
    expect(el.hasAttribute('hidden')).toBe(false);
    expect(el.tabIndex).toBe(0);
  });

  it('lies across the whole button, so the press lands on the input itself', () => {
    show(
      <FilePick accept=".pdf" onPick={() => {}}>
        Choose files
      </FilePick>,
    );
    const el = input();
    expect(el.style.position).toBe('absolute');
    expect(el.style.width).toBe('100%');
    expect(el.style.height).toBe('100%');
    expect(el.style.opacity).toBe('0');
  });

  it('lets the same file be chosen twice', () => {
    // An input keeps its value, so choosing a syllabus, taking it off the list
    // and choosing it again fired `change` once and looked like a dead button.
    const picked: string[][] = [];
    show(
      <FilePick accept=".txt" onPick={(files) => picked.push(files.map((f) => f.name))}>
        Choose files
      </FilePick>,
    );
    const el = input();
    // jsdom has no `DataTransfer`, and `input.files` is read-only there, so
    // the list is defined onto the element the way the browser would have set
    // it. The event is the real one either way.
    const drop = (name: string) => {
      const list = [new File(['x'], name, { type: 'text/plain' })] as unknown as FileList;
      Object.defineProperty(el, 'files', { value: list, configurable: true, writable: true });
      act(() => {
        el.dispatchEvent(new Event('change', { bubbles: true }));
      });
    };
    drop('syllabus.pdf');
    expect(el.value).toBe('');
    drop('syllabus.pdf');
    expect(picked).toEqual([['syllabus.pdf'], ['syllabus.pdf']]);
  });

  it('says nothing when the picker was cancelled', () => {
    const picked: string[][] = [];
    show(
      <FilePick accept=".txt" onPick={(files) => picked.push(files.map((f) => f.name))}>
        Choose files
      </FilePick>,
    );
    act(() => {
      input().dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(picked).toEqual([]);
  });

  it('tells the screen the picker is opening, before anything is chosen', () => {
    let opened = 0;
    show(
      <FilePick accept=".pdf" onPick={() => {}} onOpen={() => (opened += 1)}>
        Choose files
      </FilePick>,
    );
    // The press the browser sees. Import hangs its drop box off this, so the
    // box is open behind the dialog and still there if the dialog is dropped.
    act(() => {
      input().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(opened).toBe(1);
  });

  it('disables the input, not only the look of it', () => {
    show(
      <FilePick accept=".pdf" disabled onPick={() => {}}>
        Reading…
      </FilePick>,
    );
    expect(input().disabled).toBe(true);
  });
});
