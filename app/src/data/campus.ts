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
    id: 'yes-landing',
    name: 'YES · Student Landing',
    // The address this was taken from carried ?studentId=C… — one specific
    // student's number. Everyone else tapping it would have been sending
    // somebody else's identifier to the university, and YES resolves the
    // signed-in student from the session anyway, so the parameter is not
    // only unsafe to ship, it is unnecessary.
    url: 'https://landing.app.vanderbilt.edu/landing/student-landing',
    hint: '',
    note: 'The page YES opens on: enrolment, holds, your advisor, the official schedule.',
  },
  {
    id: 'yes-classes',
    name: 'YES · Search Classes',
    // Same again: the original carried ?commodoreIdToLoad=001049871.
    url: 'https://more.app.vanderbilt.edu/more/SearchClasses!input.action',
    hint: '',
    note: 'The class search — what is offered, when it meets, what is still open. Copy a schedule out of it and paste it into Add a course.',
  },
  {
    id: 'cbord',
    name: 'Meal plan & Commodore Cash',
    // get.cbord.com is behind single sign-on and publishes no API a student
    // can use, so the app links to the balance page and holds the numbers you
    // read off it. What it adds is the arithmetic the site does not do.
    url: 'https://get.cbord.com/vanderbilt/full/funds_home.php',
    hint: '',
    note: 'Swipes, Commodore Cash and meal money. Log the balances under Meal plan and the app works out what they are a day, and when they run out at the rate you are actually eating.',
  },
  {
    id: 'starrez',
    name: 'Housing portal',
    // Deliberately the portal root. The address this was taken from carried a
    // session path and a ?UrlToken= — one specific student's login. Everyone
    // else tapping it would have been sending somebody else's token to the
    // university, and StarRez resolves the signed-in student anyway.
    url: 'https://vanderbilt.starrezhousing.com/StarRezPortalX/',
    hint: '',
    note: 'Room assignment, housing selection, roommate groups and move-out. Its dates are the kind that cost money — put them under Term deadlines and the app will count them down.',
  },
  {
    id: 'access',
    name: 'Student Access',
    url: 'https://augusta.accessiblelearning.com/Vanderbilt/dashboard/Default.aspx',
    hint: '',
    note: 'Accommodation letters and testing-centre bookings. A booking has a lead time, so the exam runway counts it back from the exam rather than from the day you remember.',
  },
  {
    id: 'tophat',
    name: 'Top Hat',
    // app.tophat.com/e/ is the join-by-code entry. It takes you to the course
    // you are already enrolled in once you are signed in, which is why the
    // address ships without a code in it — a code belongs to one section.
    url: 'https://app.tophat.com/e/',
    hint: '',
    note: 'In-class polls and attendance. Worth pinning if a course counts Top Hat participation — ECON 1020 puts three points of extra credit on it, and those are points nobody earns by studying harder.',
  },
  {
    id: 'anchorlink',
    name: 'AnchorLink',
    url: 'https://anchorlink.vanderbilt.edu',
    hint: '',
    note: 'Organisations and campus events. Event pages usually offer an .ics you can add above.',
  },

  // ── The university's own services ───────────────────────────────────────
  //
  // The dozen places the university sends a student to that were not here
  // before: the calendar the term deadlines come out of, the office that
  // holds the money, the number you call at two in the morning. Each was
  // something you reached through a search engine, which is the argument for
  // the screen.
  //
  // Same rule as everything above, and it matters more here rather than less:
  // these are starting points, not facts. None was read by the build, a
  // university moves a page whenever it likes, and the correction you make is
  // what persists.
  {
    id: 'registrar',
    name: 'Registrar · Academic calendar',
    url: 'https://registrar.vanderbilt.edu/calendars/',
    hint: '',
    note: 'The published term calendar — first day of class, the drop and withdrawal deadlines, reading days, finals. The app cannot read it, so copy the dates that cost money or points into Term deadlines and it will count them down for you.',
  },
  {
    id: 'registration-dates',
    name: 'Registration dates',
    url: 'https://www.vanderbilt.edu/enrollmentbulletin/registration-essentials/registration-dates/',
    hint: '',
    note: 'When your enrolment window opens, by school and by year. The window is the appointment; missing it is how you end up in the eight a.m. section.',
  },
  {
    id: 'dining',
    name: 'Campus Dining · Meal plans',
    url: 'https://www.vanderbilt.edu/dining/meal-plans/undergraduate-plans/',
    hint: '',
    note: 'What each plan actually contains, which is the number Meal plan needs from you. The balance page is above under Meal plan & Commodore Cash — this is the one that says what a plan was meant to hold.',
  },
  {
    id: 'ohare',
    name: 'Housing and Residential Experience',
    url: 'https://www.vanderbilt.edu/ohare/',
    hint: '',
    note: 'The office rather than the portal: selection timelines, what a room includes, who to ask. The portal itself is above under Housing portal.',
  },
  {
    id: 'financialaid',
    name: 'Financial Aid and Scholarships',
    url: 'https://www.vanderbilt.edu/financialaid/',
    hint: '',
    note: 'Aid, scholarships and the deadlines that renew them. Aid deadlines are the other kind that costs money, so they belong under Term deadlines beside the registrar’s.',
  },
  {
    id: 'career',
    name: 'Career Center',
    url: 'https://www.vanderbilt.edu/career/',
    hint: '',
    note: 'Advising, recruiting and the campus interview calendar. Deadlines from here go in the job workspace rather than beside your coursework.',
  },
  {
    id: 'library',
    name: 'Vanderbilt Libraries',
    url: 'https://www.library.vanderbilt.edu',
    hint: '',
    note: 'Catalogue, databases, hours and study rooms. Worth pinning in a term with a research paper in it.',
  },
  {
    id: 'student-care',
    name: 'Student Care Network',
    url: 'https://www.vanderbilt.edu/student-care-network/',
    hint: '',
    note: 'Health, counselling, care coordination and wellbeing, under one roof. Student Care Coordination answers on 615-343-WELL (9355).',
  },
  {
    id: 'publicsafety',
    name: 'Public Safety (VUPD)',
    url: 'https://publicsafety.vanderbilt.edu/',
    hint: '',
    note: 'Emergencies are 911. VUPD non-emergency is 615-322-2745 — the number for an escort across campus at night, a lost card, or something that is wrong but not urgent.',
  },
  {
    id: 'vuit',
    name: 'Vanderbilt IT',
    url: 'https://it.vanderbilt.edu/',
    hint: '',
    note: 'Accounts, wifi, software and the help desk on 615-343-9999. The office to call when the thing keeping you out of Brightspace is the login rather than the course.',
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

  // ── Books and kit ───────────────────────────────────────────────────────
  {
    id: 'bookstore',
    name: 'Vanderbilt Bookstore',
    // The address this was taken from was a paid-search landing URL carrying
    // cm_mmc, gad_source, gad_campaignid, gbraid and gclid — an advertising
    // campaign id and a Google click id, which identifies one specific click
    // by one specific person. This app is used by more than one person, so
    // shipping them would attribute everybody's visit to one student's ad
    // click. The store is the same page without them.
    url: 'https://www.bkstr.com/vanderbiltstore/home',
    hint: '',
    note: 'Textbooks, supplies and kit. Course materials can be looked up by term and course number, which is what the codes on your Courses screen are.',
    group: 'Books',
  },
  {
    id: 'bookstore-textbooks',
    name: 'Course materials',
    url: 'https://www.bkstr.com/vanderbiltstore/shop/textbooks-and-course-materials',
    hint: '',
    note: 'The textbook lookup itself. Check it against your syllabus before buying — an edition listed here is not always the edition assigned.',
    group: 'Books',
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
