/**
 * Search: one index, many tenants, and a filter the caller cannot omit.
 *
 * The danger in a shared search index is not the index; it is the *query*. A
 * code path that builds the query and forgets the tenant filter returns
 * another school's gradebook to a student typing "grade". So the filter is
 * not something callers add. A `SearchScope` can only be made from a
 * `RequestContext` plus the caller's access tokens, and `SearchIndex.query`
 * *requires* one — the tenant predicate and the access-control predicate are
 * applied inside the index implementation, after the caller has finished with
 * the query. There is no unscoped `query()` to reach for.
 *
 * Access is document-level: each document carries `acl` tokens
 * (`person:<id>`, `node:<id>`, `role:<name>`, `public`) and a caller sees a
 * document only if one of their tokens matches. Education records are
 * excluded unless the scope explicitly includes them, which a surface must
 * ask policy for. Search results never contain more than a title, an excerpt
 * and a reference — the record itself is fetched through its own authorised
 * route, so a stale index cannot disclose a revoked record's content.
 *
 * Ranking is out of scope here (ADR 0006 keeps one ranker for the app); this
 * is the isolation contract any ranker or engine must sit behind.
 */

import type { ResourceClassification } from '../seam/institution.ts';
import type { RequestContext } from '../tenancy/context.ts';
import { PlatformError } from '../gateway/errors.ts';

export interface SearchDocument {
  id: string;
  tenantId: string;
  kind: string;
  classification: ResourceClassification;
  title: string;
  /** Bounded plain text. Never the record body of an education record. */
  excerpt: string;
  /** Tokens that may see it. */
  acl: readonly string[];
}

export interface SearchHit {
  id: string;
  kind: string;
  title: string;
  excerpt: string;
  score: number;
}

declare const scopeBrand: unique symbol;

/** Constructed only by `scopeFor`. The brand makes a hand-built object a type error; the runtime checks make it a refusal. */
export interface SearchScope {
  readonly [scopeBrand]: true;
  readonly tenantId: string;
  readonly acl: readonly string[];
  readonly includeRecords: boolean;
}

export function scopeFor(ctx: RequestContext, acl: readonly string[], opts: { includeRecords?: boolean } = {}): SearchScope {
  const tokens = [`person:${ctx.actor.personId}`, 'public', ...acl];
  return Object.freeze({ tenantId: ctx.tenantId, acl: Object.freeze([...new Set(tokens)]), includeRecords: opts.includeRecords === true }) as unknown as SearchScope;
}

export interface SearchIndex {
  index(doc: SearchDocument): Promise<void>;
  remove(tenantId: string, id: string): Promise<void>;
  query(scope: SearchScope, text: string, limit: number): Promise<SearchHit[]>;
}

const tokenize = (s: string): string[] => s.toLowerCase().normalize('NFKD').split(/[^\p{L}\p{N}]+/u).filter((t) => t.length > 1);

export class MemorySearchIndex implements SearchIndex {
  private readonly docs = new Map<string, SearchDocument>();

  async index(doc: SearchDocument): Promise<void> {
    this.docs.set(JSON.stringify([doc.tenantId, doc.id]), { ...doc, acl: [...doc.acl] });
  }

  async remove(tenantId: string, id: string): Promise<void> {
    this.docs.delete(JSON.stringify([tenantId, id]));
  }

  async query(scope: SearchScope, text: string, limit: number): Promise<SearchHit[]> {
    if (!scope || typeof scope.tenantId !== 'string' || !Array.isArray(scope.acl)) {
      throw new PlatformError('internal', 'A search needs a scope built from a request.');
    }
    const terms = tokenize(text);
    if (terms.length === 0) return [];
    const acl = new Set(scope.acl);
    const hits: SearchHit[] = [];
    for (const d of this.docs.values()) {
      // The two predicates that make this a shared index and not a shared secret.
      if (d.tenantId !== scope.tenantId) continue;
      if (!d.acl.some((t) => acl.has(t))) continue;
      if (d.classification === 'education_record' && !scope.includeRecords) continue;
      const title = tokenize(d.title);
      const body = tokenize(d.excerpt);
      let score = 0;
      for (const t of terms) {
        if (title.includes(t)) score += 3;
        else if (body.includes(t)) score += 1;
        else if (title.some((w) => w.startsWith(t))) score += 1;
      }
      if (score > 0) hits.push({ id: d.id, kind: d.kind, title: d.title, excerpt: d.excerpt, score });
    }
    return hits.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1)).slice(0, Math.max(1, Math.min(limit, 50)));
  }
}
