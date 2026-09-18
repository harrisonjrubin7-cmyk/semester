import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { keep, kind, named, tape } from './taping';

/**
 * The recorder, and the promise that the file does not leave the device.
 *
 * The rule chosen for this feature was that a recording stays with whoever
 * made it and Semester never receives it. A comment saying so is worth
 * nothing, so the last block here reads this module's own source and asserts
 * it contains no way to send anything anywhere.
 *
 * That probe has a control, and the control is not decoration: this file has
 * been caught three times in one repository counting a word in a comment, so
 * the comments come out before the scan and a test asserts they did.
 */

class FakeRecorder {
  static supported: string[] = ['video/webm;codecs=vp9,opus'];
  static isTypeSupported = (t: string) => FakeRecorder.supported.includes(t);
  state: 'inactive' | 'recording' = 'inactive';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  stream: MediaStream;
  options?: { mimeType?: string };
  // Written out rather than as parameter properties: the stricter config this
  // repository typechecks with has `erasableSyntaxOnly`, which rejects them.
  constructor(stream: MediaStream, options?: { mimeType?: string }) {
    this.stream = stream;
    this.options = options;
  }
  /** Every recorder built, so a test can reach the one `tape` made. */
  static built: FakeRecorder[] = [];
  start() {
    this.state = 'recording';
    // Pushed rather than assigned to a local: `const made = this` is a
    // `no-this-alias` warning, and this repository's lint budget is 25.
    FakeRecorder.built.push(this);
  }
  stop() {
    this.state = 'inactive';
    this.onstop?.();
  }
}

/** A recorder that produced nothing, which is what a denied camera looks like. */
class SilentRecorder extends FakeRecorder {
  override stop() {
    this.state = 'inactive';
    this.onstop?.();
  }
}

function withRecorder(Impl: typeof FakeRecorder, fn: () => void | Promise<void>) {
  const had = (globalThis as Record<string, unknown>).MediaRecorder;
  (globalThis as Record<string, unknown>).MediaRecorder = Impl;
  try {
    return fn();
  } finally {
    (globalThis as Record<string, unknown>).MediaRecorder = had;
  }
}

const stream = () => ({}) as MediaStream;

describe('choosing a format', () => {
  it('takes the best the browser admits to', () => {
    expect(kind((t) => t === 'video/webm;codecs=vp9,opus')).toBe('video/webm;codecs=vp9,opus');
  });

  it('falls back down the list', () => {
    expect(kind((t) => t === 'video/webm')).toBe('video/webm');
  });

  it('and hands back an empty string when the browser admits to none', () => {
    /*
     * Not a type it already rejected. An empty string means "you choose" to
     * `MediaRecorder`, so a browser this list does not cover still records;
     * passing back an unsupported type would make it throw instead.
     */
    expect(kind(() => false)).toBe('');
  });
});

describe('the name a file is offered under', () => {
  it('carries the date and time, because a call is not a document', () => {
    expect(named(new Date('2026-09-18T14:05:00.000Z'))).toBe('Semester call 2026-09-18 1405.webm');
  });

  it('and two calls in one day do not collide', () => {
    expect(named(new Date('2026-09-18T09:00:00.000Z'))).not.toBe(
      named(new Date('2026-09-18T17:00:00.000Z')),
    );
  });
});

describe('recording', () => {
  it('starts, and says it is running', () =>
    withRecorder(FakeRecorder, () => {
      const t = tape(stream());
      expect(t.running()).toBe(true);
    }));

  it('hands back what it captured', async () => {
    await withRecorder(FakeRecorder, async () => {
      FakeRecorder.built = [];
      const clock = vi.fn(() => new Date('2026-09-18T14:00:00.000Z'));
      const t = tape(stream(), clock);
      const made = FakeRecorder.built.at(-1);
      expect(made, 'tape did not build a recorder').toBeDefined();
      made!.ondataavailable?.({ data: new Blob(['x'.repeat(64)]) });
      const out = await t.stop();
      expect(out).not.toBeNull();
      expect(out!.blob.size).toBeGreaterThan(0);
      expect(out!.name).toContain('Semester call');
    });
  });

  it('can be stopped twice without throwing, because three things stop it', async () => {
    /*
     * The person pressing stop, somebody refusing, and somebody new joining —
     * two of which can land in the same tick. A second `stop()` on a stopped
     * `MediaRecorder` throws `InvalidStateError`, and an exception out of a
     * refusal handler is a refusal that did not take effect.
     */
    await withRecorder(FakeRecorder, async () => {
      const t = tape(stream());
      const first = t.stop();
      const second = t.stop();
      expect(second).toBe(first);
      await expect(second).resolves.not.toThrow();
    });
  });

  it('hands back nothing when nothing was captured', async () => {
    await withRecorder(SilentRecorder, async () => {
      const t = tape(stream());
      expect(await t.stop()).toBeNull();
    });
  });
});

describe('handing the file over', () => {
  it('goes through the browser download and revokes the url after', () => {
    const clicked: string[] = [];
    const revoked: string[] = [];
    const url = 'blob:fake';
    const oldCreate = URL.createObjectURL;
    const oldRevoke = URL.revokeObjectURL;
    URL.createObjectURL = () => url;
    URL.revokeObjectURL = (u: string) => revoked.push(u);
    try {
      const a = { href: '', download: '', click: () => clicked.push(a.download), remove: () => {} };
      const doc = {
        createElement: () => a,
        body: { appendChild: () => {} },
      } as unknown as Document;
      keep({ blob: new Blob(['x']), name: 'Semester call 2026-09-18 1405.webm', ms: 1 }, doc);
      expect(clicked).toEqual(['Semester call 2026-09-18 1405.webm']);
      // Revoked on the next tick, not this one: revoking before the browser
      // has begun reading it cancels the download in Safari.
      expect(revoked).toEqual([]);
    } finally {
      URL.createObjectURL = oldCreate;
      URL.revokeObjectURL = oldRevoke;
    }
  });
});

describe('the file does not leave the device', () => {
  const raw = readFileSync(join(__dirname, 'taping.ts'), 'utf8');
  /*
   * Comments out first. This repository has three separate cases of a source
   * scan convicting a file for a word in its own documentation — the module
   * explaining that it does not upload names the things it does not use.
   */
  const source = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('and the probe reads code rather than the paragraph about the code', () => {
    // The control. `fetch` appears in this module, and only in a comment.
    expect(raw, 'the header no longer says what it does not do').toContain('no `fetch`');
    expect(source, 'comments are still being scanned').not.toContain('no `fetch`');
    // And it still sees the real thing.
    expect(source).toContain('export function tape');
  });

  it('contains nothing that could send it anywhere', () => {
    for (const forbidden of ['fetch(', 'XMLHttpRequest', 'supabase', 'cloud(', 'navigator.sendBeacon', 'WebSocket']) {
      expect(source, `taping.ts reaches for ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('and the only place it puts the file is an object URL', () => {
    expect(source).toContain('URL.createObjectURL');
    // A data: URL would also be local, but it would go through a string the
    // length of the recording, which is how a long call runs the tab out of
    // memory on the way out.
    expect(source).not.toContain('data:video');
  });
});
