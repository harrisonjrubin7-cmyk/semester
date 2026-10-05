// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { KnownLimitations } from '../components/KnownLimitations';
import { KNOWN_LIMITATIONS, KNOWN_LIMITATIONS_AS_OF } from '../lib/knownlimitations';
import { SUPPORT } from '../lib/privacy';

/**
 * The known-limitations list is only published to a pilot user if they can
 * open it, and the app is the one place they can: the public site that prints
 * the same list has no deployment. So Help must carry it, and nothing but a
 * test holds it there — the same reason `help.statuslink.test.ts` exists.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const help = readFileSync(join(__dirname, 'Help.tsx'), 'utf8');

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  host?.remove();
  root = null;
  host = null;
});

describe('Help carries the known limitations', () => {
  it('renders the panel', () => {
    expect(help).toContain('<KnownLimitations />');
  });

  it('and the panel says every limitation, the date, and where to write', async () => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root!.render(<KnownLimitations />));
    const text = host.textContent ?? '';
    expect(KNOWN_LIMITATIONS.length).toBeGreaterThan(5);
    for (const l of KNOWN_LIMITATIONS) {
      expect(text, l.id).toContain(l.title);
      expect(text, l.id).toContain(l.instead);
    }
    expect(text).toContain(KNOWN_LIMITATIONS_AS_OF);
    expect(text).toContain(SUPPORT);
    // Collapsed by default, and openable without script: a <details>.
    expect(host.querySelector('details[data-known-limitations] > summary')).not.toBeNull();
  });
});
