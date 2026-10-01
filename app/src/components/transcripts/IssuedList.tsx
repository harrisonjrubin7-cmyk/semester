import { useState } from 'react';
import { EmptyState, SectionLabel } from '../ui';
import { Row, RowItem, Rows, Sub } from '../academic/Form';
import { formatDate, formatDateTime } from '../../lib/locale';
import type { Disclosure, Transcript } from '../../lib/transcripts/model';
import { NOTHING_ISSUED, copyText, courseLine, readBody, shortHash } from '../../lib/transcripts/views';

const stamp = (iso: string): string => formatDateTime(new Date(iso), { dateStyle: 'medium', timeStyle: 'short' });
const day = (iso: string): string => formatDate(new Date(`${iso}T12:00:00`).getTime(), { dateStyle: 'medium' });

/**
 * Copies the serial and the hash together. A person gives both to whoever has to
 * check the transcript; neither is a secret, and neither is any use alone.
 */
function CopyButton({ t }: { t: Transcript }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(copyText(t));
      setState('copied');
    } catch {
      setState('failed');
    }
  };
  return (
    <>
      <button type="button" className="btn" onClick={() => void copy()}>
        Copy the serial and hash
      </button>
      <span role="status" style={{ color: 'var(--app-dim)', fontSize: 'var(--type-sm)' }}>
        {state === 'copied' ? 'Copied.' : state === 'failed' ? 'Could not copy. Select the serial and hash above and copy them yourself.' : ''}
      </span>
    </>
  );
}

/** What the kept text says, as the ledger held it on that date, and the text itself for anyone who wants to check the hash. */
function Contents({ t }: { t: Transcript }) {
  const body = readBody(t.bodyText);
  return (
    <details>
      <summary>What this transcript says</summary>
      {body === null ? (
        <Sub>This build cannot read the kept text, so it shows it as it is, below.</Sub>
      ) : (
        <div style={{ display: 'grid', gap: 'var(--sp-3)', marginBlock: 'var(--sp-3)' }}>
          {body.terms.map((term) => (
            <div key={term.term}>
              <strong>{term.term === '' ? 'No term on the record' : term.term}</strong>
              <ul style={{ margin: 0, paddingInlineStart: 'var(--sp-6)' }}>
                {term.courses.map((c) => (
                  <li key={c.key}>{courseLine(c)}</li>
                ))}
              </ul>
            </div>
          ))}
          {[
            ['Transfer credit', body.transfer_credit],
            ['Standing', body.standing],
            ['Conferred', body.conferrals],
          ].map(([label, list]) =>
            (list as { key: string; value: string; effective_on: string }[]).length === 0 ? null : (
              <div key={label as string}>
                <strong>{label as string}</strong>
                <ul style={{ margin: 0, paddingInlineStart: 'var(--sp-6)' }}>
                  {(list as { key: string; value: string; effective_on: string }[]).map((l) => (
                    <li key={l.key}>
                      {l.key}: {l.value}, from {day(l.effective_on)}
                    </li>
                  ))}
                </ul>
              </div>
            ),
          )}
        </div>
      )}
      <Sub>The text the hash is of, exactly as kept:</Sub>
      <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 'var(--type-xs)', margin: 0 }}>{t.bodyText}</pre>
    </details>
  );
}

/**
 * The transcripts that were issued, newest first, each with its serial and hash
 * to copy, whether it was replaced, and the releases logged for it. A school
 * that has issued none is told so.
 */
export function IssuedList({
  transcripts,
  disclosures,
  who,
}: {
  transcripts: Transcript[];
  disclosures: Disclosure[];
  /** Whose record this is, for the sentence that says nothing was issued. */
  who: 'yours' | 'theirs';
}) {
  if (transcripts.length === 0) {
    return (
      <EmptyState
        inline
        title={NOTHING_ISSUED}
        body={
          who === 'yours'
            ? 'Your school has not issued a transcript of your record from Semester. Ask your registrar if you need one.'
            : 'Nothing has been issued for that student reference, or you cannot read what has been.'
        }
      />
    );
  }
  return (
    <>
      <SectionLabel>Issued</SectionLabel>
      <Rows label="Issued transcripts">
        {transcripts.map((t) => {
          const releases = disclosures.filter((d) => d.serial === t.serial && d.studentRef === t.studentRef);
          return (
            <RowItem key={t.id}>
              <div>
                <strong>Serial {t.serial}</strong>, as of {day(t.asOf)}
                {who === 'theirs' ? ` · student ${t.studentRef}` : ''}
              </div>
              <Sub>
                Issued {stamp(t.issuedAt)}.
                {t.replacedBy !== null ? ` Replaced by serial ${t.replacedBy}: ${t.replacedBecause ?? ''}` : ' Not replaced.'}
              </Sub>
              <div style={{ overflowWrap: 'anywhere' }}>
                <div>
                  Serial: <code>{t.serial}</code>
                </div>
                <div>
                  SHA-256: <code data-testid={`hash-${t.serial}`}>{t.bodySha256}</code>
                </div>
                <Sub>Begins {shortHash(t.bodySha256)}. Give the whole of it, with the serial, to whoever has to check it.</Sub>
              </div>
              <Row>
                <CopyButton t={t} />
              </Row>
              <Contents t={t} />
              {releases.length > 0 && (
                <div>
                  <strong>Released</strong>
                  <ul style={{ margin: 0, paddingInlineStart: 'var(--sp-6)' }}>
                    {releases.map((d) => (
                      <li key={d.id}>
                        {stamp(d.releasedAt)}: to {d.recipientName} ({d.recipientKind}), for {d.purpose}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </RowItem>
          );
        })}
      </Rows>
    </>
  );
}
