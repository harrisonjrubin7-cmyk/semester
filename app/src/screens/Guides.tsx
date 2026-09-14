import { useMemo } from 'react';
import { useStore } from '../state/store';
import { Page } from '../components/Page';
import { SectionLabel } from '../components/ui';
import { secondLine } from '../lib/dim';
import { CardGrid, GridCard } from '../components/GridCard';
import { liveGuide } from '../lib/live';
import { modesFor } from '../lib/modes';
import { DESTINATIONS } from '../lib/nav';
import type { CourseId, Screen } from '../lib/types';

/**
 * The home screen of the `guides` navigation: your courses, and little else.
 *
 * ## Why a course is the top level
 *
 * Every other navigation in this app opens on the *day* — Today, the feed,
 * the springboard, the workspace's search page. That is the right shape for
 * an app you check, and this is not one. Four courses go in and eleven ways
 * of studying each come out; what somebody opens this for is to study one of
 * them. So the first screen is the four, drawn as the same tiles the guide
 * draws its study modes with, and opening one hands the whole display to its
 * guide.
 *
 * The two levels are deliberately the same gesture: a grid of tiles, each
 * saying what is behind it, and you are one tap from the thing itself. The
 * course tiles and the mode tiles are the same `GridCard` for that reason —
 * see `components/GridCard.tsx`.
 *
 * ## What each tile says
 *
 * Not just the code. A tile that reads `ECON 1020` and nothing else makes
 * four courses look identical and tells you nothing about which one has work
 * in it. So each carries the ways that are actually ready — "11 of 11 ways"
 * — computed the same way the guide computes them, through `modesFor`, so
 * the number on the home screen and the number of live tiles on the guide
 * cannot disagree.
 *
 * ## Everything else
 *
 * The app has ninety-odd screens and this navigation draws no chrome, so a
 * screen not linked from here is a screen reachable only by typing its
 * address. The second grid is the answer: the handful worth a tile, and
 * Progress, which is the app's own index of all of them. It is deliberately
 * below the courses and deliberately smaller — this is a study app with an
 * administration drawer, rather than an administration app with some courses
 * in it.
 */

/** The few non-course screens worth a tile, by the registry's own name. */
const ELSEWHERE: Screen[] = ['calendar', 'brief', 'ask', 'courses', 'import', 'me'];

export function Guides() {
  const { state, dispatch, catalog } = useStore();

  /*
   * One pass over the courses, outside the render, because `liveGuide` merges
   * every update into every guide and there is no reason to redo that while
   * somebody scrolls. Keyed on the two things that can change what it says.
   */
  const courses = useMemo(
    () =>
      catalog.courses.map((course) => {
        const guide = liveGuide(catalog, course.id, state.updates, state.reviews);
        const modes = modesFor(catalog, course.id, {
          guide,
          examples: guide.examples,
          lessons: catalog.lessons[course.id] ?? {},
          figures: catalog.figures[course.id] ?? {},
          extras: catalog.extraFigures[course.id] ?? [],
        });
        return {
          id: course.id,
          code: course.code,
          name: course.name,
          ready: modes.filter((m) => m.ready).length,
          total: modes.length,
        };
      }),
    [catalog, state.updates, state.reviews],
  );

  const open = (id: CourseId) => dispatch({ type: 'openGuide', id });

  return (
    <Page>
      {catalog.empty ? (
        /*
         * Not `EmptyState`: its centred block assumes a screen with nothing
         * on it, and this screen still has the second grid under it. A line
         * and the tile that fixes it reads better and keeps the way out of
         * here in the same shape as everything else on the screen.
         */
        <div
          style={{
            fontSize: 'var(--type-base)',
            ...secondLine(),
            lineHeight: 'var(--leading-normal)',
            marginBlock: 'var(--sp-1) var(--sp-7)',
            textWrap: 'pretty',
          }}
        >
          No courses yet. Import a syllabus and its units, cards, figures and
          readings arrive with it — and this screen fills up.
        </div>
      ) : (
        <>
          {/*
            Not foldable, for the reason the guide's mode grid is not: under
            this navigation the tiles below are how you reach a course, and
            there is no bar or rail beside them. "Everything else" under it
            stays foldable — that one is a drawer, not the way through.
          */}
          <SectionLabel
            fold={false}
            aside={`${courses.length} ${courses.length === 1 ? 'course' : 'courses'}`}
            style={{ marginBlock: 'var(--sp-1) var(--sp-4)' }}
          >
            Your courses
          </SectionLabel>
          <CardGrid min={164}>
            {courses.map((c) => (
              <GridCard
                key={c.id}
                label={c.code}
                meta={`${c.ready} of ${c.total} ways`}
                selected={c.id === state.guideId}
                title={c.name}
                onClick={() => open(c.id)}
                style={{ paddingBlock: 'var(--sp-6)', paddingInline: 'var(--sp-6)' }}
              />
            ))}
          </CardGrid>
        </>
      )}

      <SectionLabel style={{ marginBlock: 'var(--sp-7) var(--sp-4)' }}>Everything else</SectionLabel>
      <CardGrid min={132}>
        {ELSEWHERE.map((screen) => {
          const d = DESTINATIONS.find((x) => x.screen === screen);
          if (!d) return null;
          return (
            <GridCard
              key={screen}
              label={d.short ?? d.label}
              title={d.blurb}
              onClick={() => dispatch({ type: 'go', screen })}
            />
          );
        })}
      </CardGrid>
    </Page>
  );
}
