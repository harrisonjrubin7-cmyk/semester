import { describe, expect, it } from 'vitest';
import { TRUST_TEXT } from '../lib/source';
import { EXTERNAL_NOTICE, NEVER_INGESTED, PROVIDERS, REQUIREMENTS, assertNothingIngested, connect, disconnect, publish, type ConnectRequest, type Connection } from './integrations';

const TODAY = '2026-09-28';
const req = (over: Partial<ConnectRequest> = {}): ConnectRequest => ({
  provider: 'instagram', owner: 'transfer-student-association', ownerKind: 'organization', accountType: 'organization_owned',
  purpose: 'Show our approved public posts on the club page', scopes: ['public_posts.read'], credential: { kind: 'oauth', token: 't' }, today: TODAY, ...over,
});

describe('the providers', () => {
  it('are the seven, each with what a student sees, who controls it, a boundary and a minimal scope', () => {
    expect(PROVIDERS).toHaveLength(7);
    for (const p of PROVIDERS) {
      expect(p.student.length, p.id).toBeGreaterThan(10);
      expect(p.control.length, p.id).toBeGreaterThan(10);
      expect(p.boundary.length, p.id).toBeGreaterThan(10);
      expect(p.scopes.length, p.id).toBe(1);
    }
    expect(REQUIREMENTS).toHaveLength(8);
    expect(REQUIREMENTS[0]).toMatch(/OAuth only/);
  });

  it('labels external content with the app\'s own external trust kind', () => {
    expect(EXTERNAL_NOTICE).toMatch(/^Hosted outside Semester\./);
    expect(EXTERNAL_NOTICE).toContain(TRUST_TEXT.external);
  });
});

describe('connecting', () => {
  it('works with OAuth, an owned account, an owner, a purpose and the minimal scope', () => {
    const v = connect(req());
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.connection).toMatchObject({ provider: 'instagram', connectedOn: TODAY, lastSyncOn: null, disconnectedOn: null, postingEnabled: false });
  });

  it('refuses a password, a personal account for an organization, a wider scope, and no purpose', () => {
    const v = connect(req({ credential: { kind: 'password', secret: 'x' }, accountType: 'personal', scopes: ['public_posts.read', 'direct_messages.read'], purpose: 'posts' }));
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.reasons).toEqual([
      'OAuth only; Semester never holds a social-media password',
      'an organization connection uses an organization-owned or officer-approved account',
      'a connection says what it is for',
      'scopes beyond the minimal set: direct_messages.read',
    ]);
  });

  it('a student may connect a personal calendar; an unknown provider is refused', () => {
    expect(connect(req({ provider: 'calendar', ownerKind: 'student', owner: 'u1', accountType: 'personal', scopes: ['calendar.events.write'] })).ok).toBe(true);
    const v = connect(req({ provider: 'facebook' as never }));
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reasons[0]).toMatch(/not a provider/);
  });
});

describe('publishing and disconnecting', () => {
  const c = (): Connection => { const v = connect(req()); if (!v.ok) throw new Error(); return { ...v.connection, postingEnabled: true }; };

  it('nothing is published without a preview and a named yes; nothing after a disconnect', () => {
    expect(publish({ connection: c(), body: 'Meet Thursday', previewedOn: null, confirmedBy: null }, TODAY)).toEqual({ ok: false, reason: 'nobody has previewed this' });
    expect(publish({ connection: c(), body: 'Meet Thursday', previewedOn: TODAY, confirmedBy: null }, TODAY)).toEqual({ ok: false, reason: 'publishing needs a named confirmation' });
    expect(publish({ connection: c(), body: 'Meet Thursday', previewedOn: TODAY, confirmedBy: 'president' }, TODAY)).toEqual({ ok: true, publishedOn: TODAY });
    expect(publish({ connection: { ...c(), postingEnabled: false }, body: 'x', previewedOn: TODAY, confirmedBy: 'p' }, TODAY).ok).toBe(false);
    expect(publish({ connection: disconnect(c(), TODAY), body: 'x', previewedOn: TODAY, confirmedBy: 'p' }, TODAY)).toEqual({ ok: false, reason: 'this connection was disconnected' });
  });

  it('disconnecting always works and turns posting off', () => {
    expect(disconnect(c(), TODAY)).toMatchObject({ disconnectedOn: TODAY, postingEnabled: false });
  });

  it('never ingests messages, followers, contacts, browsing or the social graph', () => {
    expect(NEVER_INGESTED).toHaveLength(6);
    expect(() => assertNothingIngested({ posts: [], caption: 'x' })).not.toThrow();
    for (const bad of ['direct_messages', 'followers', 'follower_count', 'contacts', 'browsing_history', 'social_graph', 'friends', 'behaviour_signals']) expect(() => assertNothingIngested({ [bad]: [] }), bad).toThrow(/never ingests/);
  });
});
