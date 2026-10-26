// Display-context session (unified-ecosystem blueprint §4, "app switching must not leak the previous context"). Pure module.
// Every context (app, institution, policy version) gets a fresh, never-reused token. A request records the token it started
// under; its response is accepted only if that exact token is still current. Returning to an earlier context (A → B → A)
// mints a new token, so a late response from the first visit to A is rejected. This is display hygiene, not authorization:
// the server re-checks authority on every request and command.
export type CtxKey = { app: string | null; institution: string | null; policy: number };
type Listener = () => void | Promise<void>;

export class ContextSession {
  private seq = 0;
  private current: { key: CtxKey; token: number };
  private controllers = new Map<number, Set<AbortController>>();
  private cleanups: Listener[] = [];
  revoked = false;

  constructor(key: CtxKey) { this.current = { key, token: ++this.seq }; }
  get token() { return this.current.token; }
  get key() { return this.current.key; }

  /** Register cleanup run on every transition (clear selections, search results, AI context, subscriptions). */
  onTransition(fn: Listener) { this.cleanups.push(fn); return () => { this.cleanups = this.cleanups.filter((f) => f !== fn); }; }

  /** Start a request bound to the current context. */
  begin(): { token: number; signal: AbortSignal } {
    const c = new AbortController();
    const set = this.controllers.get(this.current.token) ?? new Set();
    set.add(c); this.controllers.set(this.current.token, set);
    return { token: this.current.token, signal: c.signal };
  }
  /** True only if the response belongs to the context that is current now. */
  accept(token: number) { return !this.revoked && token === this.current.token; }

  /** Move to a new context: abort old requests, run cleanups (failures do not block), mint a new token. */
  async transition(key: CtxKey): Promise<{ token: number; cleanupErrors: number }> {
    const old = this.current.token;
    for (const c of this.controllers.get(old) ?? []) c.abort();
    this.controllers.delete(old);
    this.current = { key, token: ++this.seq };
    let cleanupErrors = 0;
    for (const f of this.cleanups) { try { await f(); } catch { cleanupErrors++; } }
    return { token: this.current.token, cleanupErrors };
  }
  switchApp(app: string) { return this.transition({ ...this.current.key, app }); }
  switchInstitution(institution: string) { return this.transition({ ...this.current.key, institution, app: null }); }
  refreshPolicy(policy: number) { return policy === this.current.key.policy ? Promise.resolve({ token: this.current.token, cleanupErrors: 0 }) : this.transition({ ...this.current.key, policy }); }
  /** Access revoked: nothing from any context is accepted until a new session is created. */
  async revoke() { await this.transition({ app: null, institution: null, policy: this.current.key.policy }); this.revoked = true; }
}

/** The app-wide session the UI uses. */
export const contextSession = new ContextSession({ app: null, institution: null, policy: 0 });
