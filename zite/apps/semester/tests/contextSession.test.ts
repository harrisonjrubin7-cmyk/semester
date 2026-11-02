import { test, eq } from './harness';
import { ContextSession } from '../src/lib/contextSession';

const base = { app: 'student', institution: 'U-A', policy: 1 };
test('a response from the current context is accepted (control)', () => { const s = new ContextSession(base); eq(s.accept(s.begin().token), true); });
test('a response that arrives after an app switch is rejected', async () => { const s = new ContextSession(base); const r = s.begin(); await s.switchApp('tutor'); eq(s.accept(r.token), false); });
test('switching aborts in-flight requests of the old context', async () => { const s = new ContextSession(base); const r = s.begin(); await s.switchApp('tutor'); eq(r.signal.aborted, true); });
test('requests of the new context are not aborted by the switch', async () => { const s = new ContextSession(base); await s.switchApp('tutor'); const r = s.begin(); eq(r.signal.aborted, false); eq(s.accept(r.token), true); });
test('A → B → A: a late response from the first visit to A is rejected', async () => {
  const s = new ContextSession(base); const first = s.begin(); await s.switchInstitution('U-B'); await s.switchInstitution('U-A');
  eq(s.key.institution, 'U-A'); eq(s.accept(first.token), false);
});
test('tokens are never reused', async () => { const s = new ContextSession(base); const seen = new Set([s.token]); for (let i = 0; i < 5; i++) { await s.switchApp(i % 2 ? 'a' : 'b'); eq(seen.has(s.token), false); seen.add(s.token); } });
test('switching institution clears the active app', async () => { const s = new ContextSession(base); await s.switchInstitution('U-B'); eq(s.key.app, null); });
test('a policy change invalidates the context', async () => { const s = new ContextSession(base); const r = s.begin(); await s.refreshPolicy(2); eq(s.accept(r.token), false); });
test('an unchanged policy keeps the context (control)', async () => { const s = new ContextSession(base); const r = s.begin(); await s.refreshPolicy(1); eq(s.accept(r.token), true); });
test('cleanups run on every transition', async () => { const s = new ContextSession(base); let n = 0; s.onTransition(() => { n++; }); await s.switchApp('x'); await s.switchApp('y'); eq(n, 2); });
test('a failing cleanup does not stop the transition or the others', async () => {
  const s = new ContextSession(base); let ran = false; s.onTransition(() => { throw new Error('boom'); }); s.onTransition(() => { ran = true; });
  const r = await s.switchApp('x'); eq(r.cleanupErrors, 1); eq(ran, true); eq(s.key.app, 'x');
});
test('unsubscribed cleanups no longer run', async () => { const s = new ContextSession(base); let n = 0; const off = s.onTransition(() => { n++; }); off(); await s.switchApp('x'); eq(n, 0); });
test('revocation rejects everything, including new requests', async () => { const s = new ContextSession(base); const r = s.begin(); await s.revoke(); eq(s.accept(r.token), false); eq(s.accept(s.begin().token), false); });
test('revocation aborts in-flight requests', async () => { const s = new ContextSession(base); const r = s.begin(); await s.revoke(); eq(r.signal.aborted, true); });
test('revocation clears app and institution', async () => { const s = new ContextSession(base); await s.revoke(); eq(s.key.app, null); eq(s.key.institution, null); });
