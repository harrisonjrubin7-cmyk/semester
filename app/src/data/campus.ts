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
];
