import { DatabaseSync } from 'node:sqlite';
import type {
  ActionInput,
  Receipt,
  Review,
  UniversityIdentity,
} from '../../../packages/institution/src/index.ts';
import type { IntelligenceAuditRecord } from './intelligence.ts';
import {
  assertJournalKey,
  journalOperation,
  openJournalRow,
  sealJournalRow,
} from './journal-crypto.ts';

/**
 * The record of every action that reached, or may have reached, a school.
 *
 * A durable single-host journal. It exists because of one situation: the
 * gateway called `execute`, and nobody knows what happened. The connection
 * dropped, the process restarted, the vendor timed out. A course may or may
 * not have been dropped; a payment may or may not have been taken.
 *
 * Without a journal the only options are to retry — which can do it twice —
 * or to forget, which loses the evidence. With one, the action is recorded
 * before it is attempted, marked `uncertain` if its outcome is unknown, and
 * can only be resolved by *asking* the institution what happened.
 *
 * ## States, and the one that matters
 *
 * `ready` → prepared, nothing sent. `processing` → claimed, being sent now.
 * `refused` → the adapter said no and wrote nothing; terminal, and unlike
 * `uncertain` there is nothing to reconcile.
 * `completed` / `pending` → the school answered. `uncertain` → it did not, and
 * the only way out is `reconcile`. Nothing transitions out of `uncertain` on a
 * timer or a retry.
 *
 * ## Encrypted at rest
 *
 * The body of a review is what somebody is about to do with their university:
 * a withdrawal, a payment, an appeal. It sits on disk in AES-256-GCM with a
 * key from the server's environment, so a stolen database file is not a
 * student's academic history. The columns left in the clear are the ones the
 * queries need — id, tenant, actor, expiry, state, and a hash.
 *
 * ## Single host
 *
 * `claim` is safe against concurrent requests on *this* process and this file
 * because SQLite serialises the write. Two gateway hosts against two files
 * would both claim the same action. For a multi-host deployment this class is
 * the thing to replace, with a transactional shared database — and the state
 * machine above is the contract a replacement has to keep.
 */

export interface SavedReview {
  review: Review;
  input: ActionInput;
  identity: UniversityIdentity;
  state: 'ready' | 'processing' | 'completed' | 'pending' | 'refused' | 'uncertain';
  receipt?: Receipt;
}

/**
 * The action state machine the gateway depends on, independent of storage.
 *
 * SQLite implements it synchronously for the single-host development server.
 * A production store may use a shared database and therefore return promises.
 * Keeping both shapes behind this contract lets the request path await every
 * durability boundary without making the local journal artificially async.
 */
export interface ActionJournalStore {
  healthy(): boolean | Promise<boolean>;
  save(row: SavedReview): void | Promise<void>;
  get(id: string, identity: UniversityIdentity): SavedReview | null | Promise<SavedReview | null>;
  claim(id: string, identity: UniversityIdentity, now: number): boolean | Promise<boolean>;
  finish(
    row: SavedReview,
    state: 'completed' | 'pending' | 'refused' | 'uncertain',
    receipt?: Receipt,
  ): void | Promise<void>;
  audit(
    identity: UniversityIdentity,
    area: string,
    event: string,
    reviewId?: string | null,
  ): void | Promise<void>;
  auditIntelligence?(
    identity: UniversityIdentity,
    record: IntelligenceAuditRecord,
  ): void | Promise<void>;
  purge?(now?: number): void | Promise<void>;
  close?(): void | Promise<void>;
}

/** How long a settled row is kept before `purge` may drop it. */
const KEEP = {
  /** A prepared review nobody confirmed. */
  ready: 86_400_000,
  /** A finished one, for the student to look back at. */
  completed: 90 * 86_400_000,
  audit: 180 * 86_400_000,
} as const;

export class ActionJournal implements ActionJournalStore {
  private db: DatabaseSync;
  private key: Buffer;

  constructor(file: string, key: Buffer) {
    assertJournalKey(key);
    this.key = key;
    this.db = new DatabaseSync(file, { timeout: 5000 });
    this.db.exec(`
      PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS reviews(
        id TEXT PRIMARY KEY,
        tenant TEXT NOT NULL,
        actor TEXT NOT NULL,
        expires INTEGER NOT NULL,
        state TEXT NOT NULL,
        operation TEXT NOT NULL,
        body TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS audit(
        id INTEGER PRIMARY KEY,
        at TEXT NOT NULL,
        tenant TEXT NOT NULL,
        actor TEXT NOT NULL,
        area TEXT NOT NULL,
        event TEXT NOT NULL,
        review_id TEXT
      );
      CREATE TABLE IF NOT EXISTS intelligence_audit(
        id INTEGER PRIMARY KEY,
        at TEXT NOT NULL,
        tenant TEXT NOT NULL,
        actor TEXT NOT NULL,
        category TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        input_tokens INTEGER NOT NULL,
        output_tokens INTEGER NOT NULL,
        cost_cents REAL NOT NULL,
        policy_decision TEXT NOT NULL,
        action_id TEXT,
        confirmation TEXT
      );
    `);
  }

  /**
   * Whether this journal could actually record an action right now.
   *
   * Not "was it constructed" — that happened at boot and proves nothing about
   * a disk that filled up at four in the morning. The two-phase action records
   * an attempt *before* making it, so a journal that cannot write is not a
   * degraded gateway, it is one that must refuse work: the alternative is
   * calling a university with no record that it was called, which is the exact
   * situation the `uncertain` state exists to make impossible.
   *
   * `BEGIN IMMEDIATE` rather than a `SELECT`, because taking a RESERVED lock
   * is the cheapest statement that asks for write intent rather than read
   * access, and the `ROLLBACK` means no page is ever dirtied.
   *
   * ## What this is known to catch, and what it is not
   *
   * Proven: a connection that can no longer serve — the database closed under
   * it, which is what a lost volume looks like from inside a process that is
   * otherwise still answering. `gateway.test.ts` stages exactly that.
   *
   * **Not proven: a read-only file, or a full disk.** The obvious test for the
   * first — chmod the file and probe — cannot run here, because the suite runs
   * as root and root bypasses the permission bits: a plain `INSERT` against a
   * 0444 database succeeds, so the case never arises to be caught. That was
   * measured rather than assumed, and the test was removed rather than left
   * passing for a reason unrelated to the thing it named.
   *
   * So do not read this as a promise about disks. It answers whether the
   * journal can be written to *now*, by the only means available without
   * writing; it cannot predict a write that has not been attempted, and no
   * cheap probe can. The honest scope is: an unusable journal is reported,
   * a journal that is about to become unusable is not.
   */
  healthy(): boolean {
    try {
      this.db.exec('BEGIN IMMEDIATE; ROLLBACK;');
      return true;
    } catch {
      return false;
    }
  }

  /** AES-256-GCM, with the IV and tag carried in front of the ciphertext. */
  private seal(v: unknown): string {
    return sealJournalRow(this.key, v as SavedReview);
  }

  private open(text: string): SavedReview {
    return openJournalRow<SavedReview>(this.key, text);
  }

  /**
   * What this action *is*, as a hash, so two of it can be recognised.
   *
   * Institution, student, area, record and action — not the field values. Two
   * attempts to drop the same course are the same operation even if the
   * stated reason differs, and `claim` uses this to refuse the second while
   * the first is unresolved.
   */
  private operation(row: SavedReview): string {
    return journalOperation(row);
  }

  save(row: SavedReview): void {
    this.db
      .prepare('INSERT INTO reviews VALUES(?,?,?,?,?,?,?)')
      .run(
        row.review.id,
        row.identity.institutionId,
        row.identity.userId,
        Date.parse(row.review.expiresAt),
        row.state,
        this.operation(row),
        this.seal(row),
      );
  }

  /**
   * One review, for the account that created it.
   *
   * Scoped by tenant and actor in the query rather than checked afterwards, so
   * a review id guessed or leaked from another account matches no row at all
   * and is indistinguishable from one that never existed.
   */
  get(id: string, identity: UniversityIdentity): SavedReview | null {
    const row = this.db
      .prepare('SELECT state,body FROM reviews WHERE id=? AND tenant=? AND actor=?')
      .get(id, identity.institutionId, identity.userId);
    return row ? { ...this.open(String(row.body)), state: row.state as SavedReview['state'] } : null;
  }

  /**
   * Take exclusive ownership of a review before executing it.
   *
   * The whole of double-submission prevention is this one statement, and each
   * clause is load-bearing. It moves `ready` to `processing` only if the row
   * is still this account's, still `ready`, not expired, **and no other review
   * of the same operation is unresolved** — which is what stops a student
   * preparing the same action twice in two tabs and confirming both.
   *
   * An atomic conditional UPDATE rather than a read and a write: between a
   * `SELECT state` and an `UPDATE`, a second request fits.
   *
   * Returns whether it won. The caller must not execute on false.
   */
  claim(id: string, identity: UniversityIdentity, now: number): boolean {
    return (
      this.db
        .prepare(
          `UPDATE reviews SET state='processing'
             WHERE id=? AND tenant=? AND actor=? AND state='ready' AND expires>?
               AND NOT EXISTS (
                 SELECT 1 FROM reviews AS other
                  WHERE other.operation=reviews.operation
                    AND other.state IN ('processing','uncertain','pending')
               )`,
        )
        .run(id, identity.institutionId, identity.userId, now).changes === 1
    );
  }

  finish(row: SavedReview, state: 'completed' | 'pending' | 'refused' | 'uncertain', receipt?: Receipt): void {
    this.db
      .prepare('UPDATE reviews SET state=?,body=? WHERE id=?')
      .run(state, this.seal({ ...row, state, receipt }), row.review.id);
  }

  audit(identity: UniversityIdentity, area: string, event: string, reviewId: string | null = null): void {
    this.db
      .prepare('INSERT INTO audit(at,tenant,actor,area,event,review_id) VALUES(?,?,?,?,?,?)')
      .run(new Date().toISOString(), identity.institutionId, identity.userId, area, event, reviewId);
  }

  /**
   * Metadata only. Source bodies and model prose are deliberately absent from
   * both this signature and the table, so logging cannot accidentally turn a
   * protected course source into a second ungoverned copy.
   */
  auditIntelligence(identity: UniversityIdentity, record: IntelligenceAuditRecord): void {
    this.db
      .prepare(`INSERT INTO intelligence_audit(
        at,tenant,actor,category,provider,model,input_tokens,output_tokens,
        cost_cents,policy_decision,action_id,confirmation
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(
        new Date().toISOString(), identity.institutionId, identity.userId,
        record.category, record.provider, record.model, record.inputTokens,
        record.outputTokens, record.costCents, record.policyDecision,
        record.actionId ?? null, record.confirmation ?? null,
      );
  }

  /**
   * Drop what is safely done with. Never what is unresolved.
   *
   * `processing` and `uncertain` rows are deliberately not in either
   * condition, at any age. They are the ones where somebody may have been
   * charged, and deleting them would destroy the only record that a
   * reconciliation is owed. A journal that tidies away its unknowns is worse
   * than no journal, because it looks clean.
   */
  purge(now = Date.now()): void {
    this.db
      .prepare(
        "DELETE FROM reviews WHERE (state='ready' AND expires<?) OR (state IN ('completed','refused') AND expires<?)",
      )
      .run(now - KEEP.ready, now - KEEP.completed);
    this.db.prepare('DELETE FROM audit WHERE at<?').run(new Date(now - KEEP.audit).toISOString());
    this.db.prepare('DELETE FROM intelligence_audit WHERE at<?').run(new Date(now - KEEP.audit).toISOString());
  }

  close(): void {
    this.db.close();
  }
}
