import { ObjectsError, type ContentType } from '../../lib/workspace/objects';
import { Sub } from '../academic/Form';

/*
 * What the Documents list, one document's screen and an employer's reader
 * share. Its own module so none of them imports another's screen.
 */

/** The content schema every document made here is saved under. */
export const DOCUMENT_SCHEMA = 'semester.document/1';

/** The formats a student picks between. JSON is kept for objects made elsewhere. */
export const FORMATS: { id: ContentType; label: string }[] = [
  { id: 'text/plain', label: 'Plain text' },
  { id: 'text/markdown', label: 'Markdown' },
];

/** What a failure to load says, by kind: not set up is a notice, everything else an error with a way back. */
export function notSetUp(e: unknown): e is ObjectsError {
  return e instanceof ObjectsError && e.kind === 'not-set-up';
}

/** A version's text, read-only: wraps rather than scrolls sideways at 320px. */
export function ReadOnlyText({ body, label }: { body: string; label: string }) {
  return (
    <div
      role="document"
      aria-label={label}
      style={{
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere',
        border: '1px solid var(--app-line)',
        borderRadius: 'var(--r-md)',
        padding: 'var(--sp-5)',
        marginBlock: 'var(--sp-4)',
        fontSize: 'var(--type-base)',
        lineHeight: 'var(--leading-relaxed)',
      }}
    >
      {body === '' ? <Sub>This version has no text.</Sub> : body}
    </div>
  );
}

