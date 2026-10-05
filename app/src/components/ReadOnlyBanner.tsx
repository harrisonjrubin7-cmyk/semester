import { READ_ONLY, READ_ONLY_NOTICE } from '../lib/readonly';

/**
 * The read-only notice, on every screen, for as long as the build is one.
 *
 * Under the header with the other standing conditions (a device that has
 * stopped saving, the sync line, the offline banner), and not a toast: it is
 * true for the whole session, and a sentence that fades after four seconds
 * would leave somebody to wonder why their laptop has not caught up. One
 * sentence, `role="status"`, so a screen reader hears it once on load and is
 * not interrupted by it again. See `lib/readonly.ts` for what the mode does.
 */
export function ReadOnlyBanner() {
  if (!READ_ONLY) return null;
  return (
    <div
      role="status"
      data-read-only
      style={{
        flex: 'none',
        paddingTop: 'calc(10px * var(--density, 1))', paddingInline: 'calc(18px * var(--density, 1))', paddingBottom: 'calc(11px * var(--density, 1))',
        background: 'var(--app-warn-wash)',
        borderBottom: '1px solid var(--app-warn-line)',
        color: 'var(--app-fg)',
        fontSize: 'var(--type-sm-plus)',
        lineHeight: 'var(--leading-normal)',
        textWrap: 'pretty',
      }}
    >
      {READ_ONLY_NOTICE}
    </div>
  );
}
