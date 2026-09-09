import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadSeed } from '../data/seed';
import { hasTranscript, readingTime, speaker, type Transcript } from './transcript';
import econ from '../data/transcripts/econ';
import psci from '../data/transcripts/psci';
import bus from '../data/transcripts/bus';
import core from '../data/transcripts/core';

/**
 * The transcript says what the recording says.
 *
 * Two things can go wrong and neither is visible on the page. A script can be
 * re-recorded and the generated file left behind, so the app shows the words
 * of a recording nobody can hear any more. Or the chapter names can drift
 * apart, so a transcript stops lining up with the chapters that play it — the
 * one structure both halves share.
 *
 * Both are checked against the source rather than against a copy of it: the
 * `audio/scripts/` files are what `audio/synth.py` spoke, so they are the only
 * honest thing to compare a transcript to.
 */
const SCRIPTS = join('..', 'audio', 'scripts');
const SPOKEN: Record<string, Transcript> = { econ, psci, bus, core };

interface Line {
  chapter?: string;
  v: string;
  t: string;
}

function script(course: string): { id: string; lines: Line[]; voices: Record<string, string> } {
  const file = readdirSync(SCRIPTS).find(
    (f) => f.endsWith('.json') && !f.endsWith('.chapters.json') && JSON.parse(readFileSync(join(SCRIPTS, f), 'utf8')).course === course,
  );
  if (!file) throw new Error(`no script for ${course}`);
  return JSON.parse(readFileSync(join(SCRIPTS, file), 'utf8'));
}

describe('every generated transcript', () => {
  it('is one per course with a podcast', () => {
    // Guards everything below: were the generator to stop writing a course,
    // an empty loop would pass each assertion in turn.
    expect(Object.keys(SPOKEN).sort()).toEqual(['bus', 'core', 'econ', 'psci']);
  });

  for (const [course, t] of Object.entries(SPOKEN)) {
    describe(course, () => {
      it('holds every line of the script it was spoken from', () => {
        const said = t.chapters.flatMap((c) => c.said);
        const lines = script(course).lines;
        expect(said.length, 'a line was dropped or invented').toBe(lines.length);
        // Word for word, in order. `tidy` only touches apostrophes and dashes,
        // so the words themselves must be identical.
        const words = (s: string) => s.replace(/[’']/g, "'").replace(/—/g, '--').trim();
        said.forEach((line, i) => {
          expect(words(line.text), `line ${i}`).toBe(words(lines[i].t));
          expect(line.who).toBe(lines[i].v);
        });
      });

      it('names its chapters the way the edition does', async () => {
        /*
         * The join. An edition's chapters carry the second each starts at, and
         * this carries the words — a name that matches on one side and not the
         * other is a transcript sitting beside the audio rather than with it.
         * One episode really did differ, by a straight apostrophe against a
         * curly one, which is exactly the kind of drift nothing else notices.
         */
        const edition = (await loadSeed())
          .flatMap((m) => m.podcast?.editions ?? [])
          .find((e) => e.id === t.episode);
        expect(edition, `${t.episode} is not an edition any course offers`).toBeDefined();
        const named = new Set(edition!.chapters.map((c) => c.name));
        const orphans = t.chapters.map((c) => c.name).filter((n) => !named.has(n));
        expect(orphans, 'chapters with no mark to play them from').toEqual([]);
      });

      it('is the transcript of an episode that exists and is offered one', () => {
        expect(t.episode).toMatch(/-podcast$/);
        expect(hasTranscript(course, t.episode)).toBe(true);
      });
    });
  }

  it('is not offered for a recording it is not the transcript of', () => {
    // A Full read is the study guide spoken, and its text alternative is the
    // guide — already in the app, in Read and in Field guide. Handing it the
    // podcast's words would be a transcript of a different recording.
    expect(hasTranscript('econ', 'econ-guide')).toBe(false);
    expect(hasTranscript('psci', 'psci-full')).toBe(false);
    expect(hasTranscript('nosuch', 'nosuch-podcast')).toBe(false);
  });
});

describe('how a transcript reads', () => {
  it('names its speakers rather than numbering them', () => {
    expect(speaker('host')).toBe('Host');
    expect(speaker('expert')).toBe('Expert');
    // A third voice on a re-record is labelled, not left anonymous.
    expect(speaker('caller')).toBe('Caller');
  });

  it('says how long a chapter takes to read', () => {
    expect(readingTime([{ who: 'host', text: 'a '.repeat(400).trim() }])).toBe('2 min read');
    // Never "0 min read" over a chapter that plainly has words in it.
    expect(readingTime([{ who: 'host', text: 'Short.' }])).toBe('1 min read');
  });
});

describe('the generator', () => {
  it('is what wrote these files, and says so in each', () => {
    // The files are 150KB of prose and the only safe way to change them is to
    // change the script and re-run. A file edited by hand loses that, silently,
    // until a re-record disagrees with it.
    for (const course of Object.keys(SPOKEN)) {
      const src = readFileSync(join('src', 'data', 'transcripts', `${course}.ts`), 'utf8');
      expect(src).toContain('npm run transcripts');
      expect(src).toContain('Do not edit');
    }
  });

  it('is wired into the package scripts', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(pkg.scripts.transcripts).toBeDefined();
  });
});
