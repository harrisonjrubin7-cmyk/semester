import type { PostMedia } from '../../community/client';

/** Why an image did not go up, as its author is told. */
export const REJECTED_TEXT: Record<string, string> = {
  type_mismatch: 'the file wasn’t the kind of image it said it was',
  metadata_left: 'it still carried location or camera details',
  too_large: 'it was over 10 MB',
  bad_dimensions: 'it was too large to show',
};

/**
 * An image on a post, as this viewer may see it.
 *
 * Members only ever get here with a cleared image — the storage policy gives
 * them no address for anything else. The author also sees where their own
 * image stands, in words. A reviewer sees held images to decide on them,
 * except a known-abuse match, which is never shown to anybody: the notice
 * takes its place.
 */
export function PostImage({ media, viewer }: { media: PostMedia; viewer: 'member' | 'author' | 'reviewer' }) {
  if (media.knownAbuseMatch) {
    return viewer === 'reviewer' ? (
      <p role="alert" className="portal-panel" style={{ margin: 0 }}>
        Image withheld — it matched a known-abuse hash list. Do not try to view it. Remove the post and follow the legal
        reporting runbook (docs/COMMUNITY-MEDIA-SAFETY.md).
      </p>
    ) : null;
  }
  const note =
    viewer === 'author'
      ? media.status === 'pending'
        ? 'Your image is being checked. The post appears to others once it clears.'
        : media.status === 'held'
          ? 'Your post is with a reviewer before it appears.'
          : media.status === 'rejected'
            ? `Your image couldn’t be posted: ${REJECTED_TEXT[media.reasonCode] ?? 'it didn’t pass the checks'}.`
            : media.status === 'removed'
              ? 'A reviewer removed this image.'
              : null
      : viewer === 'reviewer' && media.status !== 'clear'
        ? `Image ${media.status}${media.reasonCode ? ` — ${media.reasonCode.replaceAll('_', ' ')}` : ''}.`
        : null;
  return (
    <div style={{ display: 'grid', gap: 'var(--sp-2)' }}>
      {media.url && media.status !== 'rejected' && (
        <img
          src={media.url}
          alt={media.altText}
          width={media.width ?? undefined}
          height={media.height ?? undefined}
          loading="lazy"
          style={{ maxWidth: '100%', height: 'auto', borderRadius: 'var(--r-2, 8px)' }}
        />
      )}
      {note && <p style={{ margin: 0, color: 'var(--app-dim)' }}>{note}</p>}
    </div>
  );
}
