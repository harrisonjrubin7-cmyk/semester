import { useState } from 'react';
import { Blueprint } from './Blueprint';
import { ActionButton, FilePick, SectionLabel } from './ui';
import { useStore } from '../state/store';
import { download } from '../lib/deliver';
import { secondLine } from '../lib/dim';
import { stampedName } from '../lib/export';
import {
  readWorkspaceBackup,
  restoreWorkspaces,
  workspaceBackup,
  workspaceLabel,
  type WorkspaceBackup as Backup,
} from '../lib/workspace-backup';

/**
 * The second backup, for the six workspaces the first one cannot see.
 *
 * Its own control rather than another tick box in "What to take", because it
 * is a separate file with a separate restore path and separate failure modes —
 * see `lib/workspace-backup.ts`. Presenting it as one more part of the core
 * backup would be saying it is covered by restoring that, which it is not.
 *
 * ## It shows what it is about to replace, before it replaces it
 *
 * A restore here overwrites whole workspaces, and the list of which ones is
 * the only thing standing between "put my season back" and "replace the term
 * I have been working in". So the file is read and validated first, its
 * workspaces are named, and nothing is written until that has been looked at.
 */
export function WorkspaceBackup() {
  const { account } = useStore();
  const scope = account?.id || 'device';
  const [offered, setOffered] = useState<Backup | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const say = (e: unknown) => setError(e instanceof Error ? e.message : String(e));
  const count = (n: number) => `${n} workspace${n === 1 ? '' : 's'}`;
  const clear = () => {
    setError('');
    setDone('');
  };

  return (
    <>
      <SectionLabel>The other workspaces</SectionLabel>
      <div style={secondary}>
        Athletics, Career, Family, Pathway, Create and your university drafts are kept on this
        device under their own keys, so the backup above does not reach them. This is their file.
        Take both.
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)' }}>
        <ActionButton
          style={{ flex: '1 1 auto' }}
          onClick={() => {
            clear();
            try {
              const backup = workspaceBackup(scope);
              if (!backup.records.length) {
                setError('There is nothing in those six workspaces yet, so there is nothing to back up.');
                return;
              }
              download({
                name: `${stampedName('semester-workspaces')}.json`,
                body: JSON.stringify(backup, null, 2),
                mime: 'application/json',
              });
              setDone(`${count(backup.records.length)} saved.`);
            } catch (e) {
              say(e);
            }
          }}
        >
          Save the workspace file
        </ActionButton>

        <FilePick
          accept="application/json,.json"
          multiple={false}
          onPick={([file]) => {
            clear();
            setOffered(null);
            void file
              .text()
              .then((raw) => setOffered(readWorkspaceBackup(raw)))
              .catch(say);
          }}
          style={{ flex: '1 1 auto', height: 44, textTransform: 'none', letterSpacing: 'normal' }}
        >
          Bring a workspace file back
        </FilePick>
      </div>

      {offered && (
        <Blueprint style={{ paddingBlock: 'var(--sp-6)', paddingInline: 'var(--sp-7)', marginTop: 'var(--sp-5)' }}>
          <div className="kicker">This will replace</div>
          <ul style={{ margin: 'var(--sp-4) 0 0', paddingLeft: 'var(--sp-6)', lineHeight: 'var(--leading-relaxed)' }}>
            {offered.records.map((record) => (
              <li key={`${record.kind}:${record.term}`} style={{ fontSize: 'var(--type-base)' }}>
                {workspaceLabel(record)}
              </li>
            ))}
          </ul>
          <div style={{ ...secondary, marginTop: 'var(--sp-5)' }}>
            Each of these is replaced whole, not merged, and goes to{' '}
            {account?.id ? 'the account you are signed in to' : 'this device'}. Anything not listed
            is left exactly as it is. Save the current copy first if you might want it back.
          </div>
          <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-6)' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setOffered(null)}
              style={{ flex: 1, height: 42 }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                clear();
                try {
                  restoreWorkspaces(offered, scope);
                  setDone(`${count(offered.records.length)} restored.`);
                  setOffered(null);
                } catch (e) {
                  say(e);
                }
              }}
              style={{ flex: 1, height: 42 }}
            >
              Replace and restore
            </button>
          </div>
        </Blueprint>
      )}

      {(error || done) && (
        <p role="status" style={{ ...secondary, marginTop: 'var(--sp-5)' }}>
          {error || done}
        </p>
      )}
    </>
  );
}

/* `secondLine` rather than an opacity — see `lib/dim.ts` on why they differ. */
const secondary = {
  fontSize: 'var(--type-sm)',
  ...secondLine(),
  lineHeight: 'var(--leading-relaxed)',
  marginBottom: 'var(--sp-5)',
} as const;
