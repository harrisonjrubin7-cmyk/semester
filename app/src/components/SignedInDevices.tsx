import { useCallback, useEffect, useState } from 'react';
import { ConfirmDialog } from './ConfirmDialog';
import { ErrorState, LoadingState } from './unity/States';
import { ActionPreview } from './unity/ActionPreview';
import { SemesterDesignSurface, SessionRow as DesignSessionRow } from './semester-design';
import { dateFormatter } from '../lib/locale';
import { deviceLabel, endSession, listSessions, type SessionRow as DeviceSession } from '../lib/devices';

type Load = { status: 'loading' } | { status: 'ready'; rows: DeviceSession[] } | { status: 'error' };

const LINE = { fontSize: 'var(--type-sm)', lineHeight: 'var(--leading-relaxed)', textWrap: 'pretty' } as const;

const when = (value: string) => dateFormatter({ dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

/**
 * Every place this account is signed in, and a way to end one.
 *
 * The device in use is marked and has no button: ending it is signing out, which
 * has its own control. Ending another asks first, says what it does not do, and
 * says when the device stops: the sign-in it holds runs out within the hour, not
 * at the moment of the click.
 *
 * A failure to read the list is a state with a way back, not an empty list. An
 * empty list reads as "signed in nowhere else", which is the one answer that
 * must not be given by mistake.
 */
export function SignedInDevices({
  list = listSessions,
  end = endSession,
}: {
  list?: () => Promise<DeviceSession[]>;
  end?: (id: string) => Promise<boolean>;
}) {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [confirm, setConfirm] = useState<DeviceSession | null>(null);
  const [note, setNote] = useState('');
  const [failure, setFailure] = useState('');

  useEffect(() => {
    let live = true;
    list()
      .then((rows) => live && setLoad({ status: 'ready', rows }))
      .catch(() => live && setLoad({ status: 'error' }));
    return () => {
      live = false;
    };
  }, [list, attempt]);

  const retry = useCallback(() => {
    setLoad({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  const ending = async (row: DeviceSession) => {
    setConfirm(null);
    setNote('');
    setFailure('');
    try {
      const done = await end(row.id);
      setNote(
        done
          ? `${deviceLabel(row.userAgent)} is signed out. It stops working within the hour at the latest.`
          : `${deviceLabel(row.userAgent)} had already signed out.`,
      );
      retry();
    } catch (err) {
      setFailure(err instanceof Error ? err.message : 'That device was not signed out.');
    }
  };

  return (
    <div>
      <h4 style={{ marginTop: 'var(--sp-6)' }}>Where you are signed in</h4>

      {load.status === 'loading' ? <LoadingState what="your devices" bars={[62, 62]} /> : null}

      {load.status === 'error' ? (
        <ErrorState
          title="Could not list your devices"
          body="We could not read where you are signed in. That does not mean nowhere else, and nothing has changed. Try again."
          recover={{ label: 'Try again', run: retry }}
        />
      ) : null}

      {load.status === 'ready' ? (
        <>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {load.rows.map((row) => (
              <li key={row.id}>
                <SemesterDesignSurface label={`${deviceLabel(row.userAgent)} session`}>
                  <DesignSessionRow
                    device={deviceLabel(row.userAgent)}
                    lastActive={`Signed in ${when(row.startedAt)}. Last active ${when(row.lastActiveAt)}.`}
                    current={row.isCurrent}
                    onSignOut={row.isCurrent ? undefined : () => setConfirm(row)}
                    confirmInline={false}
                    signOutLabel={`Sign out ${deviceLabel(row.userAgent)}, signed in ${when(row.startedAt)}`}
                  />
                </SemesterDesignSurface>
              </li>
            ))}
          </ul>
          {load.rows.length === 0 ? (
            <p role="status" style={{ ...LINE, margin: 0 }}>
              No sessions were found for this account.
            </p>
          ) : null}
          {load.rows.length > 0 && load.rows.every((r) => r.isCurrent) ? (
            <p role="status" style={{ ...LINE, color: 'var(--app-dim)', marginBlock: 'var(--sp-4) 0' }}>
              This is the only device signed in to this account.
            </p>
          ) : null}
        </>
      ) : null}

      {note ? (
        <p role="status" aria-live="polite">
          {note}
        </p>
      ) : null}
      {failure ? <p role="alert">{failure}</p> : null}

      {confirm ? (
        <ConfirmDialog
          title={`Sign out ${deviceLabel(confirm.userAgent)}?`}
          preview={
            <ActionPreview
              subject={deviceLabel(confirm.userAgent)}
              says="That device will be asked to sign in again. Until its current sign-in runs out, up to an hour, it can keep working."
              doesNotChange="This device stays signed in, and nothing is deleted."
              recovery={{ kind: 'none', how: 'That device signs in again itself.' }}
            />
          }
          confirmLabel="Sign out"
          onConfirm={() => void ending(confirm)}
          onCancel={() => setConfirm(null)}
        />
      ) : null}
    </div>
  );
}
