import type { CSSProperties, ReactNode } from 'react';

/**
 * The line that has to be on the screen, not in a footer.
 *
 * Eligibility and name-image-likeness are the two places in this app where a
 * student could read a number the app computed and act on it as though
 * somebody had checked it. Nobody has. An hours log is arithmetic over what
 * was typed in; an eligibility checklist is the student's own reading of their
 * own requirements; a disclosure countdown is a date this app worked out from
 * a threshold the student told it about. All three are useful and none of them
 * is an answer from an office that can give one.
 *
 * So the sentence stays visible while the screen is being used, in the body
 * text, above the thing it is about. Not in a terms-of-service page, not
 * behind a fold, not shown once on first open and remembered as dismissed.
 * The failure this exists to prevent is somebody deciding on the strength of a
 * figure here and finding out in a compliance meeting, and a disclaimer that
 * has scrolled off the top of a page did not prevent it.
 *
 * ## Why not `Notice`
 *
 * `components/ui.tsx`'s `Notice` carries `role="status"`, which is for
 * something that just happened — a save, an error, a count that changed. A
 * screen reader announces it when it appears and then leaves it alone, which
 * is exactly wrong for a permanent condition of the screen: it would be read
 * out once, on mount, as though it were news. This is ordinary prose that
 * happens to be emphasised, and it reads in its place in the document like the
 * rest of the page.
 */
export function NotOfficial({
  children,
  style,
}: {
  /** What this particular screen adds, after the standing sentence. */
  children?: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <p
      style={{
        fontSize: 'var(--type-sm)',
        lineHeight: 'var(--leading-normal)',
        border: '1px solid var(--app-warn-line)',
        background: 'var(--app-warn-wash)',
        borderRadius: 'var(--r-md)',
        padding: 'var(--sp-5)',
        marginBlock: 'var(--sp-4)',
        textWrap: 'pretty',
        ...style,
      }}
    >
      <strong>This is not official — confirm with your compliance office.</strong>
      {children ? ' ' : null}
      {children}
    </p>
  );
}
