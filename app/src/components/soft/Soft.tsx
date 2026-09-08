/**
 * The soft shell's seven parts.
 *
 * Hero, stat, pill, numbered step, light tile, dark tile, bottom bar. Thin
 * components over the classes in app.css: the markup is here so a screen does
 * not hand-roll it, and every colour is a per-ground token so the same markup
 * is right on Bone, Ink and Parchment.
 *
 * ## Built on Blueprint, not on `.card`
 *
 * The handoff says to build on `Blueprint` and `.card`, describing both as in
 * real use. `Blueprint` is — sixty-nine files — and the frame, the marks and
 * the `plain` escape are all reused below.
 *
 * `.card` is not, and could not be. It paints `--color-surface`, which is a
 * static `#e9e9ea` written once in industry.css and never emitted by
 * `tokensFor`; app.css does not reference a single `--color-*` token. A card
 * built on it is a pale grey box on a near-black ground, which fails the
 * handoff's own rule that every ground renders the structure recoloured. Zero
 * callers is what that looks like from the outside, and adopting it across
 * seven components would have propagated the bug rather than the class.
 *
 * So the raised surface here is `.surface` — the ground-aware one added with
 * the tokens in step 1 — and `.card` is left where it is.
 */

import type { CSSProperties, ReactNode } from 'react';
import { Blueprint } from '../Blueprint';

/** A caps label. The one piece of typography every part of the shell shares. */
export function Caps({ children, quiet = false }: { children: ReactNode; quiet?: boolean }) {
  return <div className={`soft-caps${quiet ? ' soft-caps-quiet' : ''}`}>{children}</div>;
}

/**
 * The hero. One dominant fact, and the two smaller ones that qualify it.
 *
 * `figure` is the number. When a screen has no number it passes `said`
 * instead and gets the same slot at sentence size — the handoff is firm that
 * an empty hero is never rendered, and a hero with a dash in it is an empty
 * hero with extra steps.
 */
export function Hero({
  label,
  meta,
  figure,
  said,
  foot,
  delta,
}: {
  label: ReactNode;
  meta?: ReactNode;
  figure?: ReactNode;
  said?: ReactNode;
  foot?: ReactNode;
  delta?: ReactNode;
}) {
  return (
    <Blueprint className="soft-hero surface">
      <div className="soft-hero-top">
        <Caps>{label}</Caps>
        {meta ? <Caps quiet>{meta}</Caps> : null}
      </div>
      <div className={`soft-figure${figure === undefined ? ' soft-figure-said' : ''}`}>
        {figure ?? said}
      </div>
      {foot || delta ? (
        <div className="soft-hero-foot">
          <div>{foot}</div>
          {delta ? <div className="soft-delta">{delta}</div> : null}
        </div>
      ) : null}
    </Blueprint>
  );
}

/** Two or three across. The column count is a token so the row can be either. */
export function StatRow({ cols = 3, children }: { cols?: 2 | 3; children: ReactNode }) {
  return (
    <div className="soft-stats" style={{ ['--soft-stat-cols' as string]: String(cols) }}>
      {children}
    </div>
  );
}

export function Stat({
  label,
  value,
  fraction,
}: {
  label: ReactNode;
  value: ReactNode;
  /** 0–1, or omitted for a stat with nothing to fill. */
  fraction?: number;
}) {
  return (
    <Blueprint plain className="soft-stat surface">
      <Caps>{label}</Caps>
      <div className="soft-stat-value">{value}</div>
      {fraction === undefined ? null : (
        <div className="soft-track">
          <i style={{ width: `${Math.round(Math.max(0, Math.min(1, fraction)) * 100)}%` }} />
        </div>
      )}
    </Blueprint>
  );
}

/**
 * The pill.
 *
 * `on` fills with `--app-accent-fill`, which resolves to the accent's darkest
 * stop on a light ground — white on the lighter stop is about 2.4:1 and
 * fails, on the darker one about 6:1 and passes. That decision is made once
 * upstream in `tokensFor` rather than here.
 */
export function Pill({
  children,
  on = false,
  disabled = false,
  onClick,
}: {
  children: ReactNode;
  on?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={`bare pill-soft${on ? ' is-on' : ''}`}
      aria-pressed={onClick ? on : undefined}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/** A numbered step. Onboarding, how-to, and the guided fixes. */
export function Step({
  n,
  head,
  children,
}: {
  n: number;
  head: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Blueprint plain className="soft-step surface">
      <div className="soft-step-n">{n}</div>
      <div>
        <div className="soft-step-head">{head}</div>
        {children ? <div className="soft-tile-sub">{children}</div> : null}
      </div>
    </Blueprint>
  );
}

/**
 * The default tile: one glyph, a caps label, a sentence under it.
 *
 * `figure` is the slot a tile gets when the thing it stands for has a number
 * worth reading — a course and its grade. Optional, because most tiles are a
 * name and a sentence and a number would be an invention.
 *
 * `tint` is the course colour, drawn as an edge rather than a wash for the
 * reason the drawn card gives: four tinted tiles is a dashboard, and the look
 * is not one. It is a custom property rather than a class because the value
 * comes from data — the same reason `StatRow` sets its column count inline.
 */
export function LightTile({
  glyph,
  label,
  figure,
  sub,
  tint,
  onClick,
}: {
  glyph?: ReactNode;
  label: ReactNode;
  figure?: ReactNode;
  sub?: ReactNode;
  tint?: string;
  onClick?: () => void;
}) {
  return (
    <Blueprint
      plain
      as="button"
      onClick={onClick}
      className={`soft-tile surface${tint ? ' is-tinted' : ''}`}
      style={tint ? ({ ['--tile-edge' as string]: tint } as CSSProperties) : undefined}
    >
      {glyph ? <div className="soft-tile-glyph">{glyph}</div> : null}
      <Caps>{label}</Caps>
      {figure === undefined ? null : <div className="soft-tile-figure">{figure}</div>}
      {sub ? <div className="soft-tile-sub">{sub}</div> : null}
    </Blueprint>
  );
}

/**
 * The dark tile. The launcher's one piece of deliberate contrast.
 *
 * Label and sub-label are rendered by the caller, outside the tile and on the
 * ground, because the tile already holds a cluster of glyphs and one live
 * value and a name inside it would be a third kind of text competing with the
 * number that is the point.
 */
export function DarkTile({
  glyphs,
  value,
  onClick,
}: {
  glyphs: ReactNode;
  value: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button type="button" className="bare soft-dark" onClick={onClick}>
      <div className="soft-dark-glyphs">{glyphs}</div>
      <div className="soft-dark-rule" />
      <div className="soft-dark-value">{value}</div>
    </button>
  );
}

/**
 * The bottom bar: a status line, a segmented row, one primary and its
 * secondaries.
 *
 * Sticky rather than fixed. Fixed would sit over the tab bar on a phone,
 * which is the one piece of furniture the app cannot cover.
 */
export function BottomBar({
  status,
  segments,
  primary,
  onPrimary,
  secondaries,
}: {
  status?: ReactNode;
  segments?: ReactNode;
  primary: ReactNode;
  onPrimary?: () => void;
  secondaries?: ReactNode;
}) {
  return (
    <div className="soft-bar">
      {status ? <Caps quiet>{status}</Caps> : null}
      {segments ? <div className="soft-bar-row">{segments}</div> : null}
      <div className="soft-bar-row">
        <button type="button" className="bare soft-bar-primary" onClick={onPrimary}>
          {primary}
        </button>
        {secondaries}
      </div>
    </div>
  );
}

/** One of the small round secondaries beside the primary action. */
export function BarButton({ children, onClick, label }: { children: ReactNode; onClick?: () => void; label: string }) {
  return (
    <button type="button" className="bare soft-bar-second surface" onClick={onClick} aria-label={label}>
      {children}
    </button>
  );
}
