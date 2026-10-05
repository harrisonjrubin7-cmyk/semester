import { useCallback, useEffect, useState } from 'react';
import { ALIAS_DISCLOSURE } from '../../community/alias';
import { claimAlias, dropAlias, loadAlias } from '../../community/client';
import { Trouble } from '../Trouble';

/**
 * A name for one community, and only this one.
 *
 * Shown only where a school has switched pseudonyms on, a community manager
 * approved this community, and the build flag is set — the parent decides.
 * The rules (unique here, never a member's handle, one change a day, kept
 * while a case is open) are the server's; this says them in words and shows
 * whatever the server refuses with.
 *
 * The disclosure is always visible, not behind a link: somebody choosing a
 * pseudonym should know before they post that Semester still knows who they
 * are, and when it looks.
 */
export function AliasPanel({ communityId, onAlias }: { communityId: string; onAlias: (name: string | null) => void }) {
  const [alias, setAlias] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const got = await loadAlias(communityId);
      setAlias(got?.name ?? null);
      onAlias(got?.name ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your name here.');
    }
  }, [communityId, onAlias]);

  // An account-backed resource, not render-derived state.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);

  const act = (work: () => Promise<void>) => {
    setBusy(true);
    setError('');
    void work()
      .then(async () => {
        setEditing(false);
        setDraft('');
        await refresh();
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'That did not work.'))
      .finally(() => setBusy(false));
  };

  const form = (
    <form
      aria-label={alias ? 'Change your name in this community' : 'Choose a name for this community'}
      style={{ display: 'grid', gap: 'var(--sp-3)' }}
      onSubmit={(event) => {
        event.preventDefault();
        act(() => claimAlias(communityId, draft.trim()));
      }}
    >
      <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
        {alias ? 'New name' : 'Name for this community'}
        <input
          className="input"
          required
          minLength={4}
          maxLength={24}
          pattern="[A-Za-z][A-Za-z0-9]{3,23}"
          autoComplete="off"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
      </label>
      <p style={{ margin: 0, color: 'var(--app-dim)' }}>
        4–24 letters and numbers, starting with a letter. It can’t be anybody’s handle here, and it’s only used in this
        community.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
        <button className="btn btn-primary" disabled={busy || draft.trim().length < 4}>
          {alias ? 'Change name' : 'Use this name'}
        </button>
        {alias && (
          <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );

  return (
    <section aria-label="Your name in this community" className="portal-panel" style={{ display: 'grid', gap: 'var(--sp-3)', marginBlock: 'var(--sp-4)' }}>
      <strong>Post under a different name here</strong>
      <p style={{ margin: 0 }}>{ALIAS_DISCLOSURE}</p>
      {alias && !editing ? (
        <>
          <p style={{ margin: 0 }}>
            Your name here is <strong>{alias}</strong>. It isn’t shown anywhere else, and nobody can search for it.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(true)}>
              Change name
            </button>
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => act(() => dropAlias(communityId))}>
              Stop using it
            </button>
          </div>
          <p style={{ margin: 0, color: 'var(--app-dim)' }}>
            You can change it once a day. Posts you made under it keep it.
          </p>
        </>
      ) : (
        form
      )}
      {error && <Trouble said={error} />}
    </section>
  );
}
