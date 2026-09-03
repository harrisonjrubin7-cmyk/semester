import type { CampusLink } from '../lib/types';

/**
 * The other places a Vanderbilt semester actually lives.
 *
 * None of these have a public API a student can use on their own, so what the
 * app can honestly offer is the shortest path to them: one tap from the Connect
 * screen, opening the installed app where the phone handles the address and the
 * site where it does not.
 *
 * Every address here is a starting point, not a fact. They are editable in the
 * app and the edit is what persists — so if your school opens a portal at a
 * different address, or the university moves one, you fix it once in the app
 * rather than waiting for the code to change.
 *
 * myVU ships with no address on purpose. It is the one whose location differs
 * most between people and devices, and a wrong link that looks confident is
 * worse than an empty field that asks.
 */
export const CAMPUS_LINKS: CampusLink[] = [
  {
    id: 'onevu',
    name: 'oneVU',
    url: 'https://onevu.vanderbilt.edu',
    hint: '',
    note: 'The portal the other apps sit behind. Everything there is single-sign-on, so the app links you to it rather than pretending to read it — open an app you use often, copy its address, and add it below as a link of your own.',
  },
  {
    id: 'myvu',
    name: 'myVU',
    url: '',
    hint: 'https://www.vanderbilt.edu/myvu/',
    note: 'Open myVU on your phone, copy the address, and paste it here. On a phone the link hands off to the app itself where the OS recognises it.',
  },
  {
    id: 'brightspace',
    name: 'Brightspace',
    url: 'https://brightspace.vanderbilt.edu',
    hint: '',
    note: 'Course shells, submissions, grades. Its calendar feed is above — that part the app can read.',
  },
  {
    id: 'yes',
    name: 'YES',
    url: 'https://yes.vanderbilt.edu',
    hint: '',
    note: 'Your Enrollment Services — registration, the official schedule, transcripts.',
  },
  {
    id: 'anchorlink',
    name: 'AnchorLink',
    url: 'https://anchorlink.vanderbilt.edu',
    hint: '',
    note: 'Organisations and campus events. Event pages usually offer an .ics you can add above.',
  },

  // ── Tickets ─────────────────────────────────────────────────────────────
  {
    id: 'tix-students',
    name: 'Student tickets',
    url: 'https://vucommodores.evenue.net/students',
    hint: '',
    note: 'Claim your student ticket for a game. Sign in with your VUnetID; claiming usually opens a few days before and closes when the allocation runs out.',
    group: 'Tickets',
  },
  {
    id: 'tix-info',
    name: 'How student ticketing works',
    // The address this was taken from carried email-tracking parameters —
    // elq_cid, ehash, aid, rid — which identify one specific recipient. This
    // app is used by more than one person, so shipping them would hand one
    // student's identifier to the university every time anybody else tapped
    // the link. The page is the same without them.
    url: 'https://vucommodores.com/vanderbilt-student-ticketing',
    hint: '',
    note: 'The rules: which sports need a claim, when claiming opens, the loyalty policy for no-shows.',
    group: 'Tickets',
  },
  {
    id: 'commodores',
    name: 'Vanderbilt Athletics',
    url: 'https://vucommodores.com',
    hint: '',
    note: 'Schedules, scores and rosters. Most event pages offer a calendar file you can add above, which puts the games on the same rail as your classes.',
    group: 'Tickets',
  },

  // ── Social ──────────────────────────────────────────────────────────────
  // These are the app's best guess at the official accounts, not verified
  // facts — the same rule as every other address here. Each is one tap to
  // correct, and the correction is what persists.
  {
    id: 'ig-vu',
    name: 'Vanderbilt on Instagram',
    url: 'https://instagram.com/vanderbiltu',
    hint: 'https://instagram.com/…',
    note: 'Opens the Instagram app where the phone recognises the address.',
    group: 'Social',
  },
  {
    id: 'x-vu',
    name: 'Vanderbilt on X',
    url: 'https://x.com/vanderbiltu',
    hint: 'https://x.com/…',
    note: 'Announcements, closures, the things that reach you faster here than by email.',
    group: 'Social',
  },
  {
    id: 'ig-vandy',
    name: 'Commodores on Instagram',
    url: 'https://instagram.com/vandyathletics',
    hint: 'https://instagram.com/…',
    note: 'Athletics. Check the handle once and fix it here if it is wrong.',
    group: 'Social',
  },
  {
    id: 'x-vandy',
    name: 'Commodores on X',
    url: 'https://x.com/vandyathletics',
    hint: 'https://x.com/…',
    note: 'Live game updates. Check the handle once and fix it here if it is wrong.',
    group: 'Social',
  },
];
