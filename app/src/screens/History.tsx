/**
 * Visit history, grouped by time.
 *
 * Device-local record of where this person was on this device, grouped into
 * Today, Yesterday, This week, and Older. Search filters by title. The layout
 * matches the destinations (courses, screens, etc.) that the app draws
 * everywhere else.
 */

import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { useTrail } from '../lib/trail.hook';
import { DESTINATIONS, saysFor } from '../lib/nav';
import { secondLine } from '../lib/dim';
import type { Destination } from '../lib/nav';
import type { Visit } from '../lib/trail';

function groupByTime(visits: Visit[]): Record<string, Visit[]> {
  const now = Date.now();
  const groups: Record<string, Visit[]> = {
    today: [],
    yesterday: [],
    week: [],
    older: [],
  };

  for (const visit of visits) {
    const daysSince = Math.floor((now - visit.at) / (1000 * 60 * 60 * 24));
    if (daysSince === 0) groups.today.push(visit);
    else if (daysSince === 1) groups.yesterday.push(visit);
    else if (daysSince < 7) groups.week.push(visit);
    else groups.older.push(visit);
  }

  return groups;
}

function visitToDestination(visit: Visit): Destination | null {
  return DESTINATIONS.find((d) => d.screen === visit.screen) || null;
}

export function History() {
  const { dispatch, school } = useStore();
  const trail = useTrail();
  const [query, setQuery] = useState('');
  const caps = school.capabilities;

  const grouped = useMemo(() => {
    const groups = groupByTime(trail);

    // Filter by query
    if (query) {
      const q = query.toLowerCase();
      for (const key in groups) {
        groups[key] = groups[key].filter((v) => {
          const dest = visitToDestination(v);
          if (!dest) return false;
          const says = saysFor(dest, caps);
          return says.label.toLowerCase().includes(q);
        });
      }
    }

    return groups;
  }, [trail, query, caps]);

  // Recent: unique screens from trail, in order, limited to 4
  const recent = useMemo(() => {
    const seen = new Set<string>();
    const screens: string[] = [];
    for (const visit of trail) {
      if (!seen.has(visit.screen)) {
        seen.add(visit.screen);
        screens.push(visit.screen);
        if (screens.length >= 4) break;
      }
    }
    return screens;
  }, [trail]);

  return (
    <div className="history-screen">
      <input
        type="text"
        placeholder="Search history..."
        aria-label="Search history"
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
        className="history-search"
      />

      {recent.length > 0 && (
        <section className="history-section">
          <h2>Recent</h2>
          <div className="history-list">
            {recent.map((screen) => {
              const dest = DESTINATIONS.find((d) => d.screen === screen);
              if (!dest) return null;
              const says = saysFor(dest, caps);
              return (
                <button
                  key={screen}
                  className="history-item"
                  onClick={() => dispatch({ type: 'go', screen: dest.screen })}
                >
                  <div className="history-title">{says.label}</div>
                  <div className="history-subtitle" style={secondLine()}>
                    {says.blurb}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {grouped.today.length > 0 && (
        <section className="history-section">
          <h2>Today</h2>
          <div className="history-list">
            {grouped.today.map((visit, i) => {
              const dest = visitToDestination(visit);
              if (!dest) return null;
              const says = saysFor(dest, caps);
              return (
                <button
                  key={i}
                  className="history-item"
                  onClick={() => {
                    if (visit.id) {
                      dispatch({ type: 'go', screen: dest.screen });
                      // TODO: Navigate to the specific id if needed
                    } else {
                      dispatch({ type: 'go', screen: dest.screen });
                    }
                  }}
                >
                  <div className="history-title">{says.label}</div>
                  <div className="history-subtitle" style={secondLine()}>
                    {says.blurb}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {grouped.yesterday.length > 0 && (
        <section className="history-section">
          <h2>Yesterday</h2>
          <div className="history-list">
            {grouped.yesterday.map((visit, i) => {
              const dest = visitToDestination(visit);
              if (!dest) return null;
              const says = saysFor(dest, caps);
              return (
                <button
                  key={i}
                  className="history-item"
                  onClick={() => dispatch({ type: 'go', screen: dest.screen })}
                >
                  <div className="history-title">{says.label}</div>
                  <div className="history-subtitle" style={secondLine()}>
                    {says.blurb}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {grouped.week.length > 0 && (
        <section className="history-section">
          <h2>This week</h2>
          <div className="history-list">
            {grouped.week.map((visit, i) => {
              const dest = visitToDestination(visit);
              if (!dest) return null;
              const says = saysFor(dest, caps);
              return (
                <button
                  key={i}
                  className="history-item"
                  onClick={() => dispatch({ type: 'go', screen: dest.screen })}
                >
                  <div className="history-title">{says.label}</div>
                  <div className="history-subtitle" style={secondLine()}>
                    {says.blurb}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {grouped.older.length > 0 && (
        <section className="history-section">
          <h2>Older</h2>
          <div className="history-list">
            {grouped.older.map((visit, i) => {
              const dest = visitToDestination(visit);
              if (!dest) return null;
              const says = saysFor(dest, caps);
              return (
                <button
                  key={i}
                  className="history-item"
                  onClick={() => dispatch({ type: 'go', screen: dest.screen })}
                >
                  <div className="history-title">{says.label}</div>
                  <div className="history-subtitle" style={secondLine()}>
                    {says.blurb}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
