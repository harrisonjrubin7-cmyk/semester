import {
  incomingCapture,
  discardIncomingCapture,
} from '../lib/productivity-arrival';
import { useState } from 'react';
import { id, type Productivity } from '../lib/productivity';
import { zipOf, download } from '../lib/deliver';
export function readBrowserCapture(raw: string): {
  title: string;
  source: string;
  context: string;
} {
  if (raw.length > 10000) throw new Error('Capture is too large.');
  const value = JSON.parse(raw);
  if (
    !value ||
    typeof value.title !== 'string' ||
    typeof value.source !== 'string' ||
    typeof value.context !== 'string' ||
    !value.title.trim() ||
    value.title.length > 300 ||
    value.source.length > 2000 ||
    value.context.length > 6000
  )
    throw new Error('Invalid browser capture.');
  const url = new URL(value.source);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error('Invalid capture link.');
  return { title: value.title, source: url.href, context: value.context };
}
export function ProductivityBrowserCapture({
  save,
}: {
  save: (change: (old: Productivity) => Productivity) => boolean;
}) {
  const [pending, setPending] = useState(() => {
    const raw = incomingCapture();
    if (!raw) return null;
    try {
      return readBrowserCapture(raw);
    } catch {
      return null;
    }
  });
  const [message, setMessage] = useState('');
  const clear = () => {
    discardIncomingCapture();
    setPending(null);
  };
  return (
    <section className="productivity-card">
      <h3>Browser capture</h3>
      <p>
        Install the optional Chrome extension with “Load unpacked” after
        extracting the downloaded ZIP. It uses the current page only when you
        open it; selected text is included only when requested.
      </p>
      <button
        type="button"
        onClick={() =>
          void Promise.all(
            ['manifest.json', 'popup.html', 'popup.js'].map(async (name) => {
              const response = await fetch(
                `${import.meta.env.BASE_URL}capture-extension/${name}`,
              );
              if (!response.ok)
                throw new Error('Extension download unavailable.');
              return { name, body: await response.text(), mime: 'text/plain' };
            }),
          )
            .then(zipOf)
            .then((body) =>
              download({
                name: 'semester-capture-extension.zip',
                body,
                mime: 'application/zip',
              }),
            )
            .catch((e) => setMessage(e.message))
        }
      >
        Download capture extension
      </button>
      {pending && (
        <>
          <h4>Review incoming browser capture</h4>
          <p>{pending.title}</p>
          <p>{pending.source}</p>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{pending.context}</pre>
          <button
            type="button"
            onClick={() => {
              if (
                save((old) => ({
                  ...old,
                  captures: [
                    ...old.captures,
                    {
                      ...pending,
                      id: id(),
                      kind: 'Website',
                      reason: '',
                      next: '',
                      due: '',
                      status: 'Saved for later',
                      authorized: false,
                    },
                  ],
                }))
              ) {
                clear();
                setMessage(
                  'Saved privately. Assistant use remains off until you authorize this capture.',
                );
              }
            }}
          >
            Save reviewed browser capture
          </button>
          <button type="button" onClick={clear}>
            Discard incoming capture
          </button>
        </>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
