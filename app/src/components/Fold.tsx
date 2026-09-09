import {
  Fragment,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useMemo,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react';
import { ChevronRight } from './Icons';
import { SectionLabel } from './ui';
import { foldKey } from '../lib/folds';
import { useFold, useFoldAll } from '../lib/folds.hook';

/**
 * Every section on every screen, foldable, without editing every screen.
 *
 * The app draws about three hundred sections and each is written the same
 * way: a `SectionLabel` heading, then the section's content as its siblings,
 * until the next heading or the end of whatever holds them.
 *
 *     <SectionLabel>What’s coming</SectionLabel>
 *     <div>…the five things…</div>
 *     <SectionLabel>Today’s schedule</SectionLabel>
 *     {rail.map(…)}
 *
 * That shape is already the answer to "what is in this section" — it is what
 * a reader's eye does with it — so nothing had to be re-marked-up. What was
 * missing was somewhere to stand and read it. `<Page>` is the frame every
 * screen sits in and its `children` are the screen's own markup, so most of
 * the grouping happens there, once, on the way past.
 *
 * ## Why a transform rather than a `<Section>` everybody adopts
 *
 * Because the alternative is three hundred edits across eighty-three files,
 * landed in one diff, and a screen half-converted is worse than one not
 * converted at all — the difference between "fold anything" and "fold some
 * things, and you will find out which by trying" is the whole value.
 *
 * ## Where it has to be told
 *
 * At a component boundary, and only there. This walks plain elements,
 * fragments and the expressions between them; a component is opaque, because
 * React will not show anybody else's render output. Today's five sections are
 * five separate components and the screen's own markup contains none of them.
 *
 * So anything that draws its own headings wraps them in `<Folding>` — one
 * line, at the top of what it already returns. `Group` in
 * `components/shell/Rows.tsx` does its own instead, because it is handed its
 * heading and its contents as two props and has nothing to work out.
 *
 * And because a section can therefore be created by a component `<Page>`
 * cannot see, the "collapse all" control does not ask the page what it found.
 * Sections say they are on screen as they mount, and it reads that list —
 * `lib/folds.hook.ts` holds it.
 *
 * ## What folding does to the content
 *
 * Removes it. Not `display: none` — a screen here can hold a month grid, a
 * map, a PDF or a deck of flashcards, and the point of folding one away is
 * to stop paying for it. Long text somebody was typing survives regardless:
 * `useDraft` writes to the device, which is why it exists.
 *
 * Nothing is inserted around a section, either. The heading and the content
 * come back as the same siblings they were, so a section inside a flex column
 * or a grid lays out exactly as it did before any of this.
 */

/**
 * Where we are, for naming a section in a way that survives a reload.
 *
 * The screen, from `ShellBody`, and then whatever nested `Folding`s have
 * added — so two components on one screen that both head a section "This
 * week" fold separately. A context rather than the store: `<Page>` is
 * rendered in tests without a provider, and a fold key that falls back to
 * the heading alone is a working app, where a thrown error is not.
 */
const Scope = createContext('');

export const FoldScope = Scope.Provider;

export function useFoldScope(): string {
  return useContext(Scope);
}

/** How deep into a screen's own markup to look for headings. */
const DEEP = 12;

/**
 * Elements this does not read through.
 *
 * `svg` because its children are shapes, not sections. The interactive ones
 * because a heading with a button in it, inside a button, is not markup any
 * browser will agree about. Everything else — a `div`, a `section`, a
 * fragment — is exactly the wrapper a screen puts its sections in.
 */
const OPAQUE = new Set(['svg', 'button', 'a', 'label', 'select', 'textarea', 'input', 'pre', 'code']);

interface LabelProps {
  children?: ReactNode;
  style?: CSSProperties;
}

type Label = ReactElement<LabelProps>;

/**
 * A section heading, however it was written.
 *
 * `<SectionLabel>` everywhere in the app today. The second case is the same
 * heading written out longhand — `<h2 className="section-label">` — which is
 * what two of Today's sections were, because they have a count on the right
 * and the component had no way to say that. It does now (`aside`), and both
 * were converted, but the class is what actually makes a heading here: a
 * third one written the old way should fold like the rest rather than be a
 * section nobody can close for reasons only this file knows.
 */
function isLabel(node: ReactNode): node is Label {
  if (!isValidElement(node)) return false;
  if (node.type === SectionLabel) return true;
  if (node.type !== 'h2') return false;
  const { className } = node.props as { className?: string };
  return typeof className === 'string' && className.split(/\s+/).includes('section-label');
}

/**
 * A node's words, for naming its section.
 *
 * Headings in this app are usually a string, sometimes a string and a count,
 * occasionally a `<span>` wrapping both. All three want the same name, so
 * this flattens to text rather than caring which it got.
 */
export function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement(node)) return textOf((node.props as LabelProps).children);
  return '';
}

interface Pass {
  scope: string;
  /**
   * How many sections so far have said the same words.
   *
   * Two headings reading "Notes" on one screen are two sections, and they
   * have to fold separately — so the second is named as the second. Counted
   * per pass, so the answer does not depend on what was rendered before.
   */
  seen: Map<string, number>;
}

/** JSX hands over an array for several children and one node for one. */
function list(children: ReactNode): ReactNode[] {
  return Array.isArray(children) ? (children as ReactNode[]) : [children];
}

/**
 * A key for an element that is about to sit in an array it was not written
 * into.
 *
 * Static JSX children carry no keys — React matches them by position — and
 * regrouping them into arrays would earn a console warning per child and, on
 * the next render, matching by position within the new array anyway. Keying
 * by the original index says the same thing out loud, and keeps a section's
 * contents from remounting when a section above it opens or closes.
 */
function keyed(node: ReactNode, at: number): ReactNode {
  if (!isValidElement(node) || node.key !== null) return node;
  return cloneElement(node, { key: `f${at}` });
}

/** What came back from one child, and whether a section was found under it. */
interface Read {
  node: ReactNode;
  found: boolean;
}

/**
 * One run of children: the sections in it, and everything else left as it was.
 *
 * ## Where a section ends
 *
 * At the next heading — and "next" means the next one on screen, not the next
 * one that happens to be a sibling. A screen writes this all the time:
 *
 *     <SectionLabel>What’s coming</SectionLabel>
 *     <div>…the five things…</div>
 *     <div>
 *       <SectionLabel>Today’s schedule</SectionLabel>
 *       …
 *     </div>
 *
 * Both headings read as peers going down the page, and nobody folding the
 * first would expect the second to go with it. So a run stops at any sibling
 * with a heading of its own inside — which is what the `found` half of this
 * is for. It is also why every child is read exactly once, up front: reading
 * one twice would name its sections twice and count the second copy as a
 * different section that happened to say the same words.
 */
function walk(children: ReactNode, pass: Pass, depth: number): Read {
  const kids = list(children);
  const parts = kids.map((child) => (isLabel(child) ? null : read(child, pass, depth)));
  const here = kids.some(isLabel);

  if (!here) {
    const inner = parts.some((part) => part?.found === true);
    let moved = false;
    const out = kids.map((child, at) => {
      const node = parts[at]?.node ?? child;
      if (node !== child) moved = true;
      return node;
    });
    // Handed back by identity when nothing under here changed, so a screen
    // with no sections is the same tree it was and re-renders no differently.
    if (!moved) return { node: children, found: inner };
    return { node: Array.isArray(children) ? out.map(keyed) : out[0], found: inner };
  }

  const out: ReactNode[] = [];
  for (let at = 0; at < kids.length; ) {
    const child = kids[at];
    if (!isLabel(child)) {
      out.push(keyed(parts[at]?.node, at));
      at += 1;
      continue;
    }

    const opened = at;
    const said = textOf(child.props.children);
    const nth = pass.seen.get(said) ?? 0;
    pass.seen.set(said, nth + 1);
    const key = foldKey(pass.scope, said, nth);

    at += 1;
    const body: ReactNode[] = [];
    while (at < kids.length && !isLabel(kids[at]) && parts[at]?.found !== true) {
      body.push(keyed(parts[at]?.node, at));
      at += 1;
    }

    out.push(
      <Fold key={child.key ?? `f${opened}`} name={key} label={child}>
        {body}
      </Fold>,
    );
  }
  return { node: out, found: true };
}

/** One child, read through if it is the kind of thing sections hide inside. */
function read(child: ReactNode, pass: Pass, depth: number): Read {
  if (Array.isArray(child)) return walk(child, pass, depth);
  if (!isValidElement(child) || depth >= DEEP) return { node: child, found: false };

  const type = child.type;
  const host = typeof type === 'string';
  if (!host && type !== Fragment) return { node: child, found: false };
  if (host && OPAQUE.has(type)) return { node: child, found: false };

  const props = child.props as { children?: ReactNode; dangerouslySetInnerHTML?: unknown };
  if (props.children === undefined || props.dangerouslySetInnerHTML) return { node: child, found: false };

  const inside = walk(props.children, pass, depth + 1);
  if (inside.node === props.children) return { node: child, found: inside.found };
  return { node: cloneElement(child, undefined, inside.node), found: inside.found };
}

/** The markup back with its sections foldable. */
export function useFolding(children: ReactNode, name = ''): ReactNode {
  const parent = useFoldScope();
  const scope = name ? `${parent}/${name}` : parent;
  return useMemo(() => {
    return walk(children, { scope, seen: new Map() }, 0).node;
  }, [children, scope]);
}

/**
 * Folding for a component that draws its own headings.
 *
 * `<Page>` covers everything a screen writes itself. This is for the shared
 * components a screen drops in — `YourCourses`, `Insights`, `Walks` — whose
 * markup React will not let anybody else look at. One wrapper around what the
 * component already returned, and its headings fold like the rest.
 *
 * `name` separates it from the screen around it, so a component headed "This
 * week" on a screen that also has one does not fold both at once.
 */
export function Folding({ children, name = '' }: { children: ReactNode; name?: string }) {
  const parent = useFoldScope();
  const body = useFolding(children, name);
  if (!name) return <>{body}</>;
  return <Scope.Provider value={`${parent}/${name}`}>{body}</Scope.Provider>;
}

/**
 * One section: its heading, now a control, and its contents when it is open.
 *
 * The heading stays the `SectionLabel` it was, with the same style the screen
 * gave it, so nothing moves. What is new is inside it: a button carrying the
 * words and a chevron that turns.
 *
 * ## The target, and the negative margin that pays for it
 *
 * A caps label is about fifteen pixels tall and a fingertip is not. The
 * button takes six pixels of padding above and below — enough to clear the
 * 24×24 WCAG 2.2 asks for — and gives them straight back as a negative
 * margin, so the box grows without the layout moving. The growth stays inside
 * the heading's own margin, which is the reason this is safe where a `tap-y`
 * overlay would not be: it never reaches into the row below and starts
 * winning taps meant for it. `styles/taps.test.ts` has the story of the four
 * pixels that taught everyone that.
 */
function Fold({ name, label, children }: { name: string; label: Label; children: ReactNode }) {
  const { shut, toggle } = useFold(name);
  /*
   * Shut, the heading is the section: the space it was holding open for
   * content that is no longer there would read as a gap rather than as
   * rhythm. Only the bottom margin, and only on a `SectionLabel`, whose
   * margins this app owns — a hand-written heading has been given its own
   * for a reason, usually that something sits beside it in the same row.
   */
  const tighter = shut && label.type === SectionLabel;
  return (
    <>
      {cloneElement(
        label,
        tighter ? { style: { ...label.props.style, marginBottom: 'var(--sp-3)' } } : undefined,
        <FoldHead shut={shut} toggle={toggle}>
          {label.props.children}
        </FoldHead>,
      )}
      {shut ? null : children}
    </>
  );
}

/**
 * A heading that is also the control, for anything that heads its own
 * section rather than being found by the transform.
 *
 * `Group` in `components/shell/Rows.tsx` is the other one: it already knows
 * where its section begins and ends, so it says so instead of being read.
 * Both draw the same thing, which is the point of this being a component.
 */
export function FoldHead({
  shut,
  toggle,
  children,
}: {
  shut: boolean;
  toggle: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="bare"
      aria-expanded={!shut}
      onClick={toggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-3)',
        width: '100%',
        // Six pixels of reach above and below, handed straight back as a
        // negative margin: the box grows, the layout does not move. See the
        // note on this component's use above.
        padding: 'var(--sp-3) 0',
        margin: 'calc(-1 * var(--sp-3)) 0',
        background: 'none',
        border: 'none',
        font: 'inherit',
        color: 'inherit',
        letterSpacing: 'inherit',
        textTransform: 'inherit',
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      <ChevronRight
        size={12}
        style={{
          flex: 'none',
          opacity: 0.55,
          transform: shut ? 'none' : 'rotate(90deg)',
          transition: 'transform 160ms ease',
        }}
      />
      {/* Wide, so a heading sharing its line with a count keeps its words
          on the left where they were. */}
      <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
    </button>
  );
}

/**
 * One section, named by what its heading says, for a component that owns one.
 *
 * The transform names sections the same way — see `foldKey` — so a `Group`
 * and a bare `SectionLabel` reading the same words on the same screen are the
 * same section, which is what somebody folding one of them would expect.
 */
export function useSection(label: ReactNode): { shut: boolean; toggle: () => void; said: string } {
  const scope = useFoldScope();
  const said = textOf(label);
  const { shut, toggle } = useFold(foldKey(scope, said));
  return { shut, toggle, said };
}

/**
 * The one control above the sections: shut them all, or bring them back.
 *
 * One button rather than a pair, because at any moment only one of the two
 * moves anything — `nextForAll` in `lib/folds.ts` picks which. It appears
 * only where there are at least two sections; on a screen with one, the
 * heading is already that control.
 */
export function FoldAll({ style }: { style?: CSSProperties }) {
  const scope = useFoldScope();
  const { count, said, press } = useFoldAll(scope);
  if (count < 2) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', ...style }}>
      <button
        type="button"
        className="bare tappable tap-x"
        onClick={press}
        style={{
          width: 'auto',
          /*
           * `tap-x` reaches sideways; this reaches up and down, and the two
           * are not interchangeable. The button drew 72x29 — wide enough and
           * fifteen pixels short — so the axis it was missing was the one the
           * class does not grow.
           *
           * Not a `tap-y` overlay, for the reason written against the heading
           * above: the first section heading sits directly under this and is
           * itself a button, so an overlay reaching down would start winning
           * taps meant for it. This is the same padding-and-negative-margin
           * the heading uses — the box grows past 44px, the layout does not
           * move, and more of the growth goes up (into the row's own top
           * padding, which is whitespace) than down (towards that heading).
           */
          paddingBlock: 'var(--sp-7) var(--sp-6)',
          marginBlock: 'calc(var(--sp-3) - var(--sp-7)) calc(var(--sp-3) - var(--sp-6))',
          paddingInline: 0,
          fontFamily: 'var(--font-heading)',
          fontSize: 'var(--type-xs)',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          opacity: 0.55,
        }}
      >
        {said}
      </button>
    </div>
  );
}
