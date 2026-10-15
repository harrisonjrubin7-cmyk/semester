import { useCallback, useEffect, useRef, useState } from 'react';
import { ConfirmDialog } from './ConfirmDialog';
import { ErrorState, LoadingState } from './unity/States';
import { ActionPreview } from './unity/ActionPreview';
import { SemesterDesignSurface, SessionRow as DesignSessionRow } from './semester-design';
import {
  deviceLabel,
  endSession,
  formatSessionTime,
  listSessions,
  type SessionRevocationReceipt,
  type SessionRow as DeviceSession,
} from '../lib/devices';

type Load =
  | { status: 'loading' }
  | { status: 'ready'; rows: DeviceSession[]; checkedAt: string }
  | { status: 'error' };

type Operation =
  | { status: 'pending'; requestKey: string }
  | { status: 'refused'; requestKey: string }
  | { status: 'unknown'; requestKey: string };

const LINE = { fontSize: 'var(--type-sm)', lineHeight: 'var(--leading-relaxed)', textWrap: 'pretty' } as const;

const newRequestKey = () => globalThis.crypto.randomUUID();
const currentTime = () => new Date();

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
  requestKey = newRequestKey,
  now = currentTime,
}: {
  list?: () => Promise<DeviceSession[]>;
  end?: (id: string, requestKey: string) => Promise<SessionRevocationReceipt>;
  requestKey?: () => string;
  now?: () => Date;
}) {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [confirm, setConfirm] = useState<DeviceSession | null>(null);
  const [note, setNote] = useState('');
  const [operations, setOperations] = useState<Record<string, Operation>>({});
  const operationFocus = useRef<Record<string, HTMLElement | null>>({});
  const focusAfterRender = useRef<string | null>(null);

  useEffect(() => {
    const id = focusAfterRender.current;
    if (!id) return;
    operationFocus.current[id]?.focus({ preventScroll: true });
    focusAfterRender.current = null;
  });

  useEffect(() => {
    let live = true;
    list()
      .then((rows) => live && setLoad({ status: 'ready', rows, checkedAt: now().toISOString() }))
      .catch(() => live && setLoad({ status: 'error' }));
    return () => {
      live = false;
    };
  }, [list, attempt, now]);

  const retry = useCallback(() => {
    setLoad({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  const setOperation = (id: string, operation?: Operation) => {
    setOperations((current) => {
      const next = { ...current };
      if (operation) next[id] = operation;
      else delete next[id];
      return next;
    });
  };

  const ending = async (row: DeviceSession, retainedKey?: string) => {
    const key = retainedKey ?? requestKey();
    focusAfterRender.current = row.id;
    setConfirm(null);
    setNote('');
    setOperation(row.id, { status: 'pending', requestKey: key });
    try {
      const receipt = await end(row.id, key);
      if (receipt.outcome === 'revoked') {
        setOperation(row.id);
        setNote(`${deviceLabel(row.userAgent)} is signed out. It stops working within the hour at the latest.`);
        retry();
      } else if (receipt.outcome === 'already_ended') {
        setOperation(row.id);
        setNote(`${deviceLabel(row.userAgent)} had already signed out.`);
        retry();
      } else {
        focusAfterRender.current = row.id;
        setOperation(row.id, { status: 'refused', requestKey: key });
      }
    } catch {
      focusAfterRender.current = row.id;
      setOperation(row.id, { status: 'unknown', requestKey: key });
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
            {load.rows.map((row) => {
              const operation = operations[row.id];
              const label = deviceLabel(row.userAgent);
              return (
                <li key={row.id}>
                  <SemesterDesignSurface label={`${label} session`}>
                    <DesignSessionRow
                      device={label}
                      lastActive={`Signed in ${formatSessionTime(row.startedAt)}. Last active ${formatSessionTime(row.lastActiveAt)}.`}
                      current={row.isCurrent}
                      onSignOut={row.isCurrent ? undefined : () => setConfirm(row)}
                      signingOut={operation?.status === 'pending'}
                      confirmInline={false}
                      signOutLabel={`Sign out ${label}, signed in ${formatSessionTime(row.startedAt)}`}
                    />
                    {operation?.status === 'pending' ? (
                      <p
                        ref={(element) => { operationFocus.current[row.id] = element; }}
                        role="status"
                        aria-live="polite"
                        tabIndex={-1}
                        style={{ ...LINE, marginBlock: 'var(--sp-3) 0' }}
                      >
                        Checking whether {label} signed out…
                      </p>
                    ) : null}
                    {operation?.status === 'refused' ? (
                      <div style={{ ...LINE, marginBlock: 'var(--sp-3) 0' }}>
                        <p
                          ref={(element) => { operationFocus.current[row.id] = element; }}
                          role="alert"
                          tabIndex={-1}
                          style={{ margin: 0 }}
                        >
                          That device was not signed out. Refresh the list before trying again.
                        </p>
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{ marginTop: 'var(--sp-3)' }}
                          onClick={() => { setOperation(row.id); retry(); }}
                        >
                          Refresh list
                        </button>
                      </div>
                    ) : null}
                    {operation?.status === 'unknown' ? (
                      <div style={{ ...LINE, marginBlock: 'var(--sp-3) 0' }}>
                        <p
                          ref={(element) => { operationFocus.current[row.id] = element; }}
                          role="alert"
                          tabIndex={-1}
                          style={{ margin: 0 }}
                        >
                          We couldn&apos;t confirm the result. That device may or may not have signed out.
                        </p>
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{ marginTop: 'var(--sp-3)' }}
                          aria-label={`Check ${label} sign-out result again`}
                          onClick={() => void ending(row, operation.requestKey)}
                        >
                          Check again
                        </button>
                      </div>
                    ) : null}
                  </SemesterDesignSurface>
                </li>
              );
            })}
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
          <p style={{ ...LINE, color: 'var(--app-dim)', marginBlock: 'var(--sp-4) 0' }}>
            Source: Semester account sessions · checked {formatSessionTime(load.checkedAt)}
          </p>
        </>
      ) : null}

      {note ? (
        <p role="status" aria-live="polite">
          {note}
        </p>
      ) : null}

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
