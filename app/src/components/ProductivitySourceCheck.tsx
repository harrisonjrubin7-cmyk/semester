import { useState } from 'react';
import { cloud, cloudConfigured } from '../lib/cloud';
export function ProductivitySourceCheck() {
  const [url, setUrl] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  return (
    <section className="productivity-card">
      <h3>Check a public source</h3>
      <p>
        Check availability and an exact excerpt on a public .edu page. This does
        not certify a requirement or change your evidence dates. Review the
        source before updating your decision.
      </p>
      <label className="productivity-field">
        Public source URL
        <input
          className="input"
          type="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setMessage('');
          }}
          maxLength={2000}
        />
      </label>
      <label className="productivity-field">
        Exact excerpt to verify
        <textarea
          className="input"
          value={excerpt}
          onChange={(e) => {
            setExcerpt(e.target.value);
            setMessage('');
          }}
          maxLength={1000}
        />
      </label>
      <button
        type="button"
        disabled={busy || !cloudConfigured || !url.trim()}
        onClick={() => {
          setBusy(true);
          setMessage('');
          void cloud()
            .then((c) =>
              c.functions.invoke('productivity-sourcecheck', {
                body: { url, excerpt },
              }),
            )
            .then(({ data, error }) => {
              if (error) throw error;
              if (data.error) throw new Error(data.error);
              setMessage(
                data.state === 'available'
                  ? `Page available. ${data.excerptFound ? 'Exact excerpt found.' : 'Excerpt not verified.'} Checked ${data.checkedAt}.`
                  : `Source unavailable (HTTP ${data.status}).`,
              );
            })
            .catch((e) => setMessage(e.message))
            .finally(() => setBusy(false));
        }}
      >
        Check source now
      </button>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
