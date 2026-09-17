/**
 * Types for the one JavaScript module the test suite calls into.
 *
 * `scripts/` is plain node — these instruments drive a browser and are not
 * part of the build — but `src/lib/sweepscreens.test.ts` has to *call* this
 * one rather than read it as text, because the claim it makes is that the
 * parse equals `DESTINATIONS`, and a string comparison cannot say that.
 */
export declare function destinations(): { screen: string; label: string }[];
export declare const PROOF: Record<string, { h1?: string; css?: string }>;
export declare function proofSelector(screen: string): string | null;
export declare function arrived(
  screen: string,
  label: string,
  seen: { h1?: string; css?: boolean } | null,
): boolean;
