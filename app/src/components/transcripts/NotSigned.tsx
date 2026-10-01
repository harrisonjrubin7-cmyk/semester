import { NOT_SIGNED_HEAD, NOT_SIGNED_REST } from '../../lib/transcripts/views';

/**
 * The line that has to be on the screen, in the body text, above the thing it
 * is about: an issued transcript here is not signed.
 *
 * Not `Notice`, whose `role="status"` is for something that just happened and is
 * read out once on mount. This is a permanent condition of the screen, so it is
 * ordinary prose that happens to be emphasised, the way `NotOfficial` is.
 */
export function NotSigned() {
  return (
    <p
      data-testid="not-signed"
      style={{
        fontSize: 'var(--type-sm)',
        lineHeight: 'var(--leading-normal)',
        border: '1px solid var(--app-warn-line)',
        background: 'var(--app-warn-wash)',
        borderRadius: 'var(--r-md)',
        padding: 'var(--sp-5)',
        marginBlock: 'var(--sp-4)',
        textWrap: 'pretty',
      }}
    >
      <strong>{NOT_SIGNED_HEAD}</strong> {NOT_SIGNED_REST}
    </p>
  );
}
