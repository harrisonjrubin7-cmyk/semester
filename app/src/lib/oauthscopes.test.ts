/// <reference types="node" />
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SCOPES, scopeParam } from './oauthscopes';
import { PROVIDERS, type ProviderId } from './connect';

/**
 * The exact scopes Semester asks for, pinned.
 *
 * `connect.scopes.test.ts` holds the prose on each account's card to its scope
 * string. This file holds the scope string itself: exactly these, and never a
 * broader one. A new scope is a decision somebody makes on purpose, in this
 * file and in `lib/oauthscopes.ts` together, with the call that needs it.
 */

const PINNED: Record<ProviderId, string[]> = {
  microsoft: ['openid', 'offline_access', 'Calendars.ReadWrite', 'Mail.Read', 'Tasks.ReadWrite', 'Files.ReadWrite'],
  google: [
    'openid',
    'https://www.googleapis.com/auth/calendar.events.owned',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/tasks',
  ],
  zoom: ['meeting:read', 'recording:read'],
  apple: [],
};

/**
 * Broader than anything the app calls, each with the narrower one it uses.
 * Any of these appearing is a widening, whatever else changed.
 */
const TOO_BROAD = [
  // Google
  'https://www.googleapis.com/auth/calendar', // all calendars, sharing, delete
  'https://www.googleapis.com/auth/calendar.events', // every editable calendar, not just yours
  'https://www.googleapis.com/auth/drive', // write and delete every file
  'https://www.googleapis.com/auth/drive.metadata',
  'https://mail.google.com/', // read, send, permanently delete
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.insert',
  'https://www.googleapis.com/auth/gmail.settings.basic',
  'https://www.googleapis.com/auth/gmail.settings.sharing',
  'https://www.googleapis.com/auth/contacts',
  'profile',
  'email',
  // Microsoft
  'User.Read',
  'User.ReadWrite',
  'User.Read.All',
  'User.RevokeSessions.All',
  'Mail.ReadWrite',
  'Mail.Send',
  'Mail.Read.Shared',
  'Calendars.ReadWrite.Shared',
  'Calendars.Read.Shared',
  'Files.Read.All',
  'Files.ReadWrite.All',
  'Sites.Read.All',
  'Sites.ReadWrite.All',
  'Tasks.ReadWrite.Shared',
  'Directory.Read.All',
  'Directory.ReadWrite.All',
  'Contacts.ReadWrite',
  // Zoom
  'user:read',
  'user:write',
  'meeting:write',
  'recording:write',
];

const IDS = Object.keys(PINNED) as ProviderId[];

describe('the scopes Semester asks for', () => {
  it.each(IDS)('%s asks for exactly the pinned list', (id) => {
    expect([...SCOPES[id]]).toEqual(PINNED[id]);
  });

  it.each(IDS)('%s: the consent URL is built from that one list', (id) => {
    expect(PROVIDERS[id].scopes).toBe(scopeParam(id));
    expect(PROVIDERS[id].scopes.split(/\s+/).filter(Boolean)).toEqual(PINNED[id]);
  });

  it('asks for nothing broader than the calls need', () => {
    for (const id of IDS) {
      for (const scope of SCOPES[id]) {
        expect(TOO_BROAD, `${id} asks for ${scope}`).not.toContain(scope);
      }
    }
  });

  it('no scope appears twice', () => {
    for (const id of IDS) expect(new Set(SCOPES[id]).size, id).toBe(SCOPES[id].length);
  });
});

describe('there is one list', () => {
  /*
   * A scope string written anywhere else in the app is a second source of
   * truth, and the second one is the one that drifts. Google's scopes are
   * URLs and easy to find; the Microsoft and Zoom ones are words, so the
   * search is for the shapes they take in a `scope` parameter.
   */
  const src = join(process.cwd(), 'src');
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) return files(p);
      return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [p] : [];
    });

  it('no other source file writes a scope string', () => {
    const offenders = files(src)
      .filter((f) => !f.endsWith(join('lib', 'oauthscopes.ts')))
      .filter((f) => {
        const text = readFileSync(f, 'utf8');
        return (
          /['"`]https:\/\/www\.googleapis\.com\/auth\//.test(text) ||
          // A quoted string made only of scope-shaped words — what a `scope`
          // parameter looks like. Prose that names a scope in a comment or a
          // sentence is not a second list.
          /['"](?:[\w.:/-]+ )*(?:(?:Calendars|Mail|Tasks|Files|User)\.[\w.]+|(?:meeting|recording|user):(?:read|write)[\w:]*)(?: [\w.:/-]+)*['"]/.test(
            text,
          )
        );
      })
      .map((f) => relative(src, f));
    expect(offenders).toEqual([]);
  });
});
