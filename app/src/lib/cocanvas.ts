import { cloud, cloudConfigured } from './cloud';
import type { Edit } from './coedit';

/**
 * The channel two people share a canvas over.
 *
 * `lib/coedit.ts` is the arithmetic and this is the wire, separated for the
 * reason `lib/mesh.ts` and `lib/rtc.ts` are: everything that can be reasoned
 * about lives on the other side of this file, and what is here is the part
 * that needs a network to be wrong.
 *
 * It is the same broadcast channel a call's signalling rides on — a Supabase
 * Realtime topic — because the app already has one and a second transport
 * would be a second thing to configure, a second thing to fail, and a second
 * thing to explain. The topic is `canvas:<project id>`, and a project id is a
 * `crypto.randomUUID()`, which is what makes it unguessable.
 *
 * ## What this does not claim
 *
 * Anybody who has the id and the publishable key can join, exactly as anybody
 * with a call's code can. That is said on the screen. A canvas is not private
 * because it is shared over a channel nobody has been told the name of.
 *
 * ## `self: false`
 *
 * Broadcast does not echo to the sender, so a device applies its own edits
 * locally and hears only other people's. That is what keeps an edit from
 * being folded in twice and, more usefully, what keeps somebody's own drag
 * from arriving back as a remote edit a moment later and fighting the drag
 * still in progress.
 */

export interface Sharing {
  /** Send what just changed here. */
  send: (edits: Edit[]) => void;
  /** Ask whoever is already here to describe the canvas. */
  ask: () => void;
  /** Stop, and say so. */
  leave: () => void;
}

export interface Ears {
  onEdits: (edits: Edit[]) => void;
  /** Somebody arrived with nothing and wants the state. */
  onAsked: () => void;
  /** Who else is here, by name. */
  onHere: (names: string[]) => void;
  onTrouble: (said: string) => void;
}

/**
 * Join a canvas.
 *
 * Resolves when the channel is actually subscribed rather than when the object
 * exists, so a caller that sends immediately is not sending into nothing.
 */
export async function share(projectId: string, me: string, name: string, ears: Ears): Promise<Sharing> {
  if (!cloudConfigured) throw new Error('Sharing a canvas needs an account service, and this build has none.');

  const db = await cloud();
  const channel = db.channel(`canvas:${projectId}`, {
    config: { broadcast: { self: false }, presence: { key: me } },
  });

  channel.on('broadcast', { event: 'edits' }, ({ payload }) => {
    const edits = (payload as { edits?: unknown }).edits;
    if (Array.isArray(edits)) ears.onEdits(edits as Edit[]);
  });
  channel.on('broadcast', { event: 'ask' }, () => ears.onAsked());

  // Who else is on the canvas. Presence rather than a table, for the reason
  // `rooms.sql` gives about the green dot: a row saying somebody is editing is
  // a row that is wrong the moment a laptop lid closes.
  const announce = () => {
    const state = channel.presenceState() as Record<string, { name?: string }[]>;
    const names: string[] = [];
    for (const [key, entries] of Object.entries(state)) {
      if (key === me) continue;
      names.push(entries[0]?.name || 'Somebody');
    }
    ears.onHere(names);
  };
  channel.on('presence', { event: 'sync' }, announce);
  channel.on('presence', { event: 'join' }, announce);
  channel.on('presence', { event: 'leave' }, announce);

  await new Promise<void>((resolve, reject) => {
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        void channel.track({ name });
        resolve();
        return;
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        // Not fatal to the editor: the canvas keeps working on this device and
        // the screen says it is no longer shared.
        ears.onTrouble('Lost the connection to the shared canvas. Your work is still here.');
        reject(new Error('The shared canvas could not be reached.'));
      }
    });
  });

  return {
    send: (edits) => {
      if (edits.length === 0) return;
      void channel.send({ type: 'broadcast', event: 'edits', payload: { edits } });
    },
    ask: () => void channel.send({ type: 'broadcast', event: 'ask', payload: {} }),
    leave: () => void db.removeChannel(channel),
  };
}
