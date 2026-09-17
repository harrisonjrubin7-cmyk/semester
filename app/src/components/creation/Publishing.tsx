import { useState } from 'react';
import { cloudConfigured } from '../../lib/cloud';
import { collect, publish, republish, shareLink, withdraw } from '../../lib/formshare';
import type { CreativeProject } from '../../lib/creations';
import { secondLine } from '../../lib/dim';

/**
 * Sending a form to people who are not you.
 *
 * Everything else in the form builder works on one device. This is the panel
 * where a form leaves it: a link anybody can open, answers that come back,
 * and a way to take the whole thing down again.
 *
 * ## Why the answers are fetched rather than watched
 *
 * A button, not a subscription. Responses arrive over hours or days, the
 * author is not sitting on this screen while they do, and a realtime channel
 * held open on a form's settings tab would be a socket per open tab for an
 * event that happens twice an afternoon. Pressing it says what came back
 * since last time, which is the honest shape of the thing.
 *
 * ## What "withdraw" means
 *
 * The row and every answer to it, deleted. Not `accepting = false` with the
 * responses left on a server — a form you have taken down should not still be
 * somewhere, and the migration's cascade is what makes that true rather than
 * a promise. The confirmation says so in those words, because it cannot be
 * undone and the answers are somebody else's writing.
 */
export function Publishing({
  project,
  onChange,
}: {
  project: CreativeProject;
  onChange: (patch: Partial<CreativeProject>) => boolean;
}) {
  const f = project.form;
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState(false);

  const line = { fontSize: 'var(--type-sm)', ...secondLine(), lineHeight: 'var(--leading-normal)' } as const;
  const body = { fontSize: 'var(--type-base)', lineHeight: 'var(--leading-normal)' } as const;
  const panel = {
    border: '1px solid var(--app-line)',
    borderRadius: 'var(--r-md)',
    padding: 'var(--sp-5)',
    marginTop: 'var(--sp-6)',
    minWidth: 0,
  } as const;

  const run = (what: string, job: () => Promise<void>) => {
    setBusy(what);
    setNote('');
    job()
      .catch((e: unknown) => setNote(e instanceof Error ? e.message : 'That did not work.'))
      .finally(() => setBusy(''));
  };

  if (!cloudConfigured) {
    return (
      <div style={panel}>
        <p style={{ ...body, textWrap: 'pretty' }}>
          This copy of Semester has no account service, so a form cannot be sent to anyone. Everything
          else on this screen still works, and the answers you record yourself stay on this device.
        </p>
      </div>
    );
  }

  const link = f.published
    ? shareLink(f.published, { origin: window.location.origin, pathname: window.location.pathname })
    : '';

  return (
    <div style={panel}>
      <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--type-lg)', margin: 0 }}>
        Send it to people
      </h3>

      {!f.published ? (
        <>
          <p style={{ ...body, marginTop: 'var(--sp-4)', textWrap: 'pretty' }}>
            Publishing puts the questions where anybody with the link can answer them, without an account
            and without this app. The answer key is not published — it stays here, and answers are marked
            on this device when you collect them.
          </p>
          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={!!busy || !f.questions.length}
            style={{ marginTop: 'var(--sp-5)' }}
            onClick={() =>
              run('publish', async () => {
                const id = await publish(project);
                onChange({ form: { ...f, published: id } });
              })
            }
          >
            {busy === 'publish' ? 'Publishing…' : 'Publish and get a link'}
          </button>
        </>
      ) : (
        <>
          <label style={{ display: 'block', marginTop: 'var(--sp-4)' }}>
            <span style={line}>Anybody with this link can answer</span>
            <input readOnly value={link} style={{ width: '100%', marginTop: 'var(--sp-2)' }} />
          </label>

          <div style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap', marginTop: 'var(--sp-5)' }}>
            <button
              type="button"
              className="btn"
              onClick={() => {
                // `writeText` is unavailable on an insecure origin and can be
                // refused outright, and the field above is selectable either
                // way — so a failure here says so rather than pretending.
                navigator.clipboard
                  ?.writeText(link)
                  .then(() => setCopied(true))
                  .catch(() => setNote('This browser would not let the page copy. Select the link and copy it.'));
              }}
            >
              {copied ? 'Copied' : 'Copy link'}
            </button>

            <button
              type="button"
              className="btn"
              disabled={!!busy}
              onClick={() => run('push', () => republish(f.published!, project))}
            >
              {busy === 'push' ? 'Sending…' : 'Send my edits'}
            </button>

            <button
              type="button"
              className="btn"
              disabled={!!busy}
              onClick={() =>
                run('collect', async () => {
                  const rows = await collect(f.published!, f);
                  const known = new Set(f.responses.map((r) => r.id));
                  const fresh = rows.filter((r) => !known.has(r.id));
                  if (!fresh.length) {
                    setNote('Nothing new has come back yet.');
                    return;
                  }
                  // Appended rather than replacing: a form can be answered
                  // here as well as through the link, and those responses
                  // exist nowhere else.
                  onChange({ form: { ...f, responses: [...f.responses, ...fresh] } });
                  setNote(`${fresh.length} new answer${fresh.length === 1 ? '' : 's'} collected.`);
                })
              }
            >
              {busy === 'collect' ? 'Collecting…' : 'Collect answers'}
            </button>

            <button
              type="button"
              className="btn"
              disabled={!!busy}
              onClick={() => {
                if (
                  !window.confirm(
                    'Take this form down? The link stops working and every answer sent through it is deleted. Answers you have already collected stay on this device.',
                  )
                ) {
                  return;
                }
                run('withdraw', async () => {
                  await withdraw(f.published!);
                  onChange({ form: { ...f, published: null } });
                });
              }}
            >
              {busy === 'withdraw' ? 'Taking down…' : 'Take it down'}
            </button>
          </div>

          <p style={{ ...line, marginTop: 'var(--sp-5)', textWrap: 'pretty' }}>
            Edits made here are not sent until you send them, so a form can be rewritten without the people
            holding the link seeing it change halfway through.
          </p>
        </>
      )}

      {note && (
        <p role="status" style={{ ...body, marginTop: 'var(--sp-5)', textWrap: 'pretty' }}>
          {note}
        </p>
      )}
    </div>
  );
}
