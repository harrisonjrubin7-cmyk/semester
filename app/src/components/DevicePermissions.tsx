import { useCallback, useEffect, useState } from 'react';
import { SectionLabel } from './ui';
import { ErrorState, LoadingState, PermissionNotice } from './unity/States';
import {
  CAPABILITIES,
  GRANT_WORDS,
  allowAgainSteps,
  allowedCount,
  grantOf,
  readGrant,
  revokeSteps,
  type CapabilityId,
  type Grant,
} from '../lib/permissions';

type Grants = Record<CapabilityId, Grant>;
type Load = { status: 'loading' } | { status: 'ready'; grants: Grants } | { status: 'error' };

const LINE = { fontSize: 'var(--type-sm-plus)', lineHeight: 'var(--leading-relaxed)', textWrap: 'pretty' } as const;

/**
 * What this app may use on this device, one entry each, and how to take it back.
 *
 * It reads; it never asks. Each feature asks for its own permission at the
 * moment the student starts the job that needs it, and a panel that asked for
 * all four on arrival would get all four refused. So this is only the answer,
 * the reason, what still works without it, and the way back (`lib/permissions.ts`
 * says why the way back is directions for three of them and a link for one).
 *
 * It follows the browser without a refresh: a change made in site settings
 * reaches the page as a `change` event on the permission and the entry updates.
 * Nothing here needs the network, so it reads the same offline.
 *
 * `openAlerts` is where notifications are actually switched off; the push
 * subscription is the app's own, so the switch is there and this links to it.
 */
export function DevicePermissions({ openAlerts }: { openAlerts: () => void }) {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    const watching: { status: PermissionStatus; handler: () => void }[] = [];

    (async () => {
      try {
        const readings = await Promise.all(CAPABILITIES.map((c) => readGrant(c.id)));
        if (!live) return;
        const grants = Object.fromEntries(CAPABILITIES.map((c, i) => [c.id, readings[i].grant])) as Grants;
        setLoad({ status: 'ready', grants });
        readings.forEach((r, i) => {
          if (!r.status) return;
          const id = CAPABILITIES[i].id;
          const status = r.status;
          // The status is live, so the change is read off it rather than asked for again.
          const handler = () => {
            if (live) setLoad((cur) => (cur.status === 'ready' ? { status: 'ready', grants: { ...cur.grants, [id]: grantOf(status) } } : cur));
          };
          r.status.addEventListener('change', handler);
          watching.push({ status: r.status, handler });
        });
      } catch {
        if (live) setLoad({ status: 'error' });
      }
    })();

    return () => {
      live = false;
      watching.forEach((w) => w.status.removeEventListener('change', w.handler));
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setLoad({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  return (
    <section aria-labelledby="device-permissions-heading">
      <SectionLabel style={{ marginTop: 'calc(22px * var(--density, 1))', marginInline: '0', marginBottom: 'calc(5px * var(--density, 1))' }}>
        <span id="device-permissions-heading">On this device</span>
      </SectionLabel>
      <p style={{ ...LINE, color: 'var(--app-dim)', marginBlock: '0 var(--sp-5)' }}>
        What this app can use on this device, what for, and how to take it back. Nothing is asked for here.
      </p>

      {load.status === 'loading' ? <LoadingState what="your permissions" bars={[62, 62, 62]} /> : null}

      {load.status === 'error' ? (
        <ErrorState
          title="Could not check your permissions"
          body="Your browser would not say what this app is allowed to use. Nothing has changed. Try again, or look in your browser's site settings."
          recover={{ label: 'Try again', run: retry }}
        />
      ) : null}

      {load.status === 'ready' ? (
        <>
          {allowedCount(load.grants) === 0 && !CAPABILITIES.some((c) => load.grants[c.id] === 'denied') ? (
            <p role="status" style={{ ...LINE, marginBlock: '0 var(--sp-5)' }}>
              Nothing has been allowed yet. Each one is asked for only when you start the thing that needs it, and
              everything here works without it.
            </p>
          ) : null}
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {CAPABILITIES.map((c) => {
              const grant = load.grants[c.id];
              const word = GRANT_WORDS[grant];
              return (
                <li key={c.id} style={{ paddingBlock: 'var(--sp-5)', borderBottom: '1px solid var(--app-line-soft)' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--sp-4)' }}>
                    <strong style={{ fontSize: 'var(--type-base-plus)' }}>{c.label}</strong>
                    <span className="status-chip" data-tone={word.tone}>
                      <span className="status-glyph" aria-hidden="true">
                        {word.glyph}
                      </span>
                      {word.word}
                    </span>
                  </div>
                  <p style={{ ...LINE, marginBlock: 'var(--sp-4) var(--sp-2)' }}>
                    <strong>Used for.</strong> {c.purpose}
                  </p>
                  <p style={{ ...LINE, color: 'var(--app-dim)', margin: 0 }}>
                    <strong>Without it.</strong> {c.fallback}
                  </p>
                  {grant === 'denied' ? (
                    <div style={{ marginTop: 'var(--sp-5)' }}>
                      <PermissionNotice changed={`${c.label} is blocked`} why={allowAgainSteps(c.id)} />
                    </div>
                  ) : null}
                  {grant === 'granted' && c.id !== 'notifications' ? (
                    <p style={{ ...LINE, color: 'var(--app-dim)', marginBlock: 'var(--sp-4) 0' }}>
                      <strong>To take it back.</strong> {revokeSteps(c.id)}
                    </p>
                  ) : null}
                  {grant === 'unknown' ? (
                    <p style={{ ...LINE, color: 'var(--app-dim)', marginBlock: 'var(--sp-4) 0' }}>
                      This browser reports it only once it has been asked, so it cannot say yet. {revokeSteps(c.id)}
                    </p>
                  ) : null}
                  {grant === 'unsupported' ? (
                    <p style={{ ...LINE, color: 'var(--app-dim)', marginBlock: 'var(--sp-4) 0' }}>
                      This browser or device does not offer it, so the app never asks. Nothing to take back.
                    </p>
                  ) : null}
                  {c.id === 'notifications' && grant !== 'unsupported' ? (
                    <button type="button" className="bare link-quiet tap-y" onClick={openAlerts}>
                      {grant === 'granted' ? 'Turn reminders off in Alerts' : 'Choose what reminds you in Alerts'}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </section>
  );
}
