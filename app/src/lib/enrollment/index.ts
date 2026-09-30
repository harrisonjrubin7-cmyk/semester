/**
 * The official registration transaction: enroll, waitlist, drop, withdraw,
 * holds, prerequisites, clashes, credit load, and the registrar's overrides
 * and approvals. Pure; the server half is
 * `supabase/migrations/20260929300000_registration_transaction.sql`.
 */
export * from './model';
export * from './service';
