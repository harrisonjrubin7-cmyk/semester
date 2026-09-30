/**
 * One key per intent, sent again on every retry of that intent.
 *
 * The dining functions take a client key on every write
 * that moves money, and treat the same key with the same request as a replay:
 * they answer with what the first call made and change nothing. That only
 * protects anybody if the screen really does send the same key again — a
 * press that timed out, then a second press, must not mint a second key, or
 * the retry is a second payment.
 *
 * So a key belongs to an intent, described by a signature string (what is
 * being paid, how much, to whom). The same signature gets the same key until
 * the write is known to have landed (`settle`). A different signature — the
 * amount was changed — gets a new one, because the database refuses a key
 * reused for a different request, and that refusal would be a bug here, not
 * news for the student.
 *
 * The key is `[A-Za-z0-9-]`, 36 characters: inside the dining pattern
 * (`^[A-Za-z0-9_.:-]{8,64}$`).
 */

export type MakeKey = () => string;

function randomKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // Only a very old engine lacks randomUUID; the key still has to be unguessable
  // enough not to collide, and getRandomValues is older than randomUUID.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export class IntentKeys {
  private held = new Map<string, string>();
  private readonly make: MakeKey;

  constructor(make: MakeKey = randomKey) {
    this.make = make;
  }

  /** The key for this intent: the one already minted for it, or a new one. */
  keyFor(signature: string): string {
    let key = this.held.get(signature);
    if (!key) {
      key = this.make();
      this.held.set(signature, key);
    }
    return key;
  }

  /** The write landed: the next press of the same intent is a new payment, and gets a new key. */
  settle(signature: string): void {
    this.held.delete(signature);
  }
}
