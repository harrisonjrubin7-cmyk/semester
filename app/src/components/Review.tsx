import { useStore } from '../state/store';
import { describe } from '../lib/conflicts';
import { stamp } from '../lib/merge';
import { formatDateTime } from '../lib/locale';

/**
 * The records two devices edited before either synced, and a choice for each.
 *
 * Drawn on Account, under the sync line that says there is something here.
 * Each is the two versions side by side — beside each other where there is
 * room, one above the other where there is not, which the wrap does without
 * asking the width — with the one in use marked in words rather than by
 * colour, and one button each. Nothing is chosen for the student: the app
 * keeps using the version the merge kept until they say otherwise, and the
 * other is kept on this device until they do.
 */
export function Review() {
  const { review, resolve, allItems } = useStore();
  if (review.length === 0) return null;
  /*
   * A tick's key is a deadline's id for the maps keyed by deadline — done,
   * started, submitted and the rest — and the id is not a name anybody
   * knows. Look it up, and fall back to the key where it is not one.
   */
  const named = (c: (typeof review)[number], title: string) => {
    if (c.field !== 'ticks') return title;
    const k = c.id.slice(c.id.indexOf('/') + 1);
    return allItems.find((i) => i.id === k)?.title ?? title;
  };

  return (
    <section aria-labelledby="review-head" style={{ marginTop: 'var(--sp-6)' }}>
      <h2 id="review-head" className="kicker" style={{ margin: 0 }}>
        Choose a version
      </h2>
      <p style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)', marginTop: 'var(--sp-3)', lineHeight: 'var(--leading-relaxed)' }}>
        {review.length === 1
          ? 'This was changed on two devices before either synced.'
          : `These ${review.length} were changed on two devices before either synced.`}{' '}
        Both versions are saved on this device until you choose.
      </p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {review.map((c) => {
          const about = describe(c.field, c.kept === 'mine' ? c.mine : c.theirs, c.id);
          return (
            <li
              key={c.key}
              style={{ marginTop: 'var(--sp-5)', paddingTop: 'var(--sp-5)', borderTop: '1px solid var(--app-line)' }}
            >
              <div style={{ fontSize: 'var(--type-xs)', color: 'var(--app-dim)' }}>{about.kind}</div>
              <div style={{ fontSize: 'var(--type-md)', marginTop: 'var(--sp-1)' }}>{named(c, about.title)}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)', marginTop: 'var(--sp-4)' }}>
                <Version
                  label="This device"
                  inUse={c.kept === 'mine'}
                  field={c.field}
                  id={c.id}
                  name={named(c, '')}
                  record={c.mine}
                  onKeep={() => resolve(c.key, 'mine')}
                />
                <Version
                  label="Other device"
                  inUse={c.kept === 'theirs'}
                  field={c.field}
                  id={c.id}
                  name={named(c, '')}
                  record={c.theirs}
                  onKeep={() => resolve(c.key, 'theirs')}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Version({
  label,
  inUse,
  field,
  id,
  name,
  record,
  onKeep,
}: {
  label: string;
  inUse: boolean;
  field: string;
  id: string;
  /** A better name than the record's own, where the list has one. Empty: none. */
  name: string;
  record: unknown;
  onKeep: () => void;
}) {
  const described = describe(field, record, id);
  const about = name ? { ...described, title: name } : described;
  const at = stamp(record);
  return (
    <div
      role="group"
      aria-label={`${label}${inUse ? ', in use now' : ''}`}
      style={{
        flex: '1 1 220px',
        minWidth: 0,
        padding: 'var(--sp-4)',
        borderRadius: 'var(--r-md)',
        border: '1px solid var(--app-line-top)',
      }}
    >
      <div style={{ fontSize: 'var(--type-xs)', color: 'var(--app-dim)' }}>
        {label}
        {inUse ? ' · in use now' : ''}
        {at > 1e11 ? ` · edited ${formatDateTime(at)}` : ''}
      </div>
      <div style={{ fontSize: 'var(--type-sm-plus)', marginTop: 'var(--sp-2)', overflowWrap: 'anywhere' }}>{about.title}</div>
      {about.preview ? (
        <div style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)', marginTop: 'var(--sp-2)', overflowWrap: 'anywhere' }}>
          {about.preview}
        </div>
      ) : null}
      <button
        type="button"
        className={inUse ? 'btn btn-secondary btn-block' : 'btn btn-primary btn-block'}
        onClick={onKeep}
        aria-label={`Keep the ${label.toLowerCase()} version of ${about.title}`}
        style={{ marginTop: 'var(--sp-4)', minHeight: 44 }}
      >
        Keep this one
      </button>
    </div>
  );
}
