import { useEffect, useRef } from 'react';
import { MicOffIcon, HandIcon } from '../../components/Icons';
import { initials } from '../../lib/classmates';

/**
 * One person, at whatever size the gallery worked out.
 *
 * A `<video>` element cannot take a `MediaStream` as an attribute — it is a
 * property, set from JavaScript — which is the one thing about rendering video
 * in React that catches everybody once. Hence the ref and the effect, and
 * hence this being a component rather than three lines inlined in the grid.
 *
 * Everything drawn over the video is the state somebody needs to read at a
 * glance and cannot hear: who this is, whether they are muted, whether their
 * hand is up, and whether they are the one talking. The speaking ring is drawn
 * as a border on the frame rather than as a glow, because at four tiles across
 * on a phone a glow is invisible and a border is not.
 */
export function Tile({
  stream,
  name,
  muted,
  camera,
  hand,
  speaking,
  mirrored = false,
  you = false,
  mark = '',
  width,
  height,
  volume = 1,
  onClick,
}: {
  stream: MediaStream | null;
  name: string;
  muted: boolean;
  camera: boolean;
  hand: boolean;
  speaking: boolean;
  mirrored?: boolean;
  you?: boolean;
  mark?: string;
  width?: number;
  height?: number;
  /** 0 to 1, from the call's own slider. Ignored on your own tile. */
  volume?: number;
  onClick?: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (video.current) video.current.srcObject = stream;
  }, [stream]);

  useEffect(() => {
    if (video.current) video.current.volume = volume;
  }, [volume]);

  return (
    <button
      type="button"
      className="bare"
      aria-label={`${name}${you ? ' (you)' : ''}${muted ? ', muted' : ''}${hand ? ', hand up' : ''}`}
      onClick={onClick}
      style={{
        position: 'relative',
        width: width ? `${width}px` : '100%',
        height: height ? `${height}px` : undefined,
        aspectRatio: height ? undefined : '16 / 9',
        background: '#0b0b0d',
        overflow: 'hidden',
        border: speaking ? '2px solid var(--app-accent)' : '1px solid var(--app-line)',
        padding: 0,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <video
        ref={video}
        autoPlay
        playsInline
        // Your own tile is the one that must never play its own audio: a
        // browser that does would feed the microphone back into the room.
        muted={you}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: mirrored ? 'scaleX(-1)' : undefined,
          display: stream && camera ? 'block' : 'none',
        }}
      />

      {(!stream || !camera) && (
        <span
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            color: '#fff',
            fontSize: 'var(--type-xl)',
            letterSpacing: '0.04em',
          }}
        >
          {initials(name)}
        </span>
      )}

      {mark ? (
        <span
          aria-hidden="true"
          style={{ position: 'absolute', top: 6, right: 6, fontSize: 'var(--type-xl)' }}
        >
          {mark}
        </span>
      ) : null}

      <span
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--sp-3)',
          padding: 'var(--sp-2) var(--sp-4)',
          background: 'linear-gradient(transparent, rgba(0,0,0,0.62))',
          color: '#fff',
          fontSize: 'var(--type-xs)',
        }}
      >
        {muted ? <MicOffIcon size={13} /> : null}
        {hand ? <HandIcon size={13} /> : null}
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {you ? `${name} (you)` : name}
        </span>
      </span>
    </button>
  );
}
