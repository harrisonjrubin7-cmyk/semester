import type { CourseId, Figure, FigureMap } from '../lib/types';

/**
 * Figures, keyed by the index of the unit they illustrate.
 *
 * The prototype carried five; these are every figure the four field guides
 * actually draw, plus the curve pictures the ECON guide reproduces — which have
 * to be drawn rather than tabulated, hence the `diagram` type.
 */
export const FIGURES: Record<CourseId, FigureMap> = {
  econ: {
    0: {
      type: 'steps',
      title: 'The four-step study method',
      caption:
        'Prof. Stromme’s own sequence. Step 1 is where he says 95% of students fool themselves — “I recognise this” is not “I can explain this.”',
      steps: [
        { n: '1', t: 'Review the deck', d: 'Right after lecture. Explain every point out loud, no notes.' },
        { n: '2', t: 'Psets alone first', d: 'Ask which building block each problem is testing. Then friend, then TA.' },
        { n: '3', t: 'Read the key', d: 'Including for questions you got right — right answer, wrong reason still costs you.' },
        { n: '4', t: 'Practice exams', d: 'Timed, closed note. Then rewrite each question until you see what it tests.' },
      ],
    },
    2: {
      type: 'bars',
      title: 'How many hours to study?',
      caption:
        'Each hour costs $20 of foregone work. Total analysis peaks at 3 hours; marginal analysis stops there too — hour 3 is worth $25, hour 4 only $10. Same answer, less arithmetic.',
      unit: '$ net',
      max: 70,
      rows: [
        { l: '1 hour', v: 40 },
        { l: '2 hours', v: 60 },
        { l: '3 hours', v: 65 },
        { l: '4 hours', v: 55 },
      ],
    },
    3: {
      type: 'diagram',
      kind: 'supply-demand',
      title: 'Reading a market',
      caption:
        'Both curves are marginal curves — demand height is willingness to pay, supply height is willingness to accept. That is why the crossing point is efficient, not just tidy. Above P*, Qs exceeds Qd and sellers cut price; below it, buyers bid up.',
    },
    4: {
      type: 'diagram',
      kind: 'elasticity-along-demand',
      title: 'Elasticity is not slope',
      caption:
        'A straight-line demand curve has one constant slope and a changing elasticity: elastic on the upper half, unit elastic exactly at the midpoint, inelastic on the lower half. Total revenue is largest at that midpoint.',
    },
    5: {
      type: 'diagram',
      kind: 'cost-curves',
      title: 'The cost curve picture',
      caption:
        'MC always cuts AVC and ATC at their minimums — an average falls while the next value is below it and rises once it is above. The gap between ATC and AVC is AFC, shrinking forever as fixed cost spreads.',
    },
    7: {
      type: 'diagram',
      kind: 'externality',
      title: 'Externalities in four curves',
      caption:
        'Private parties trade where MPB = MPC. Society’s optimum is MSB = MSC. With a negative externality MSC sits above MPC, the market overproduces, and the shaded wedge is the deadweight loss.',
    },
    8: {
      type: 'diagram',
      kind: 'monopoly',
      title: 'Monopoly, in two steps',
      caption:
        'MR has the same intercept and twice the slope of demand. Find Q where MR = MC, then go straight up to the demand curve for the price. CS shrinks, part transfers to the firm, and the rest is deadweight loss.',
    },
  },
  psci: {
    1: {
      type: 'diagram',
      kind: 'validity-reliability',
      title: 'Validity vs. reliability',
      caption:
        'The dangerous box is the second one. A measure can be perfectly consistent and perfectly wrong — self-reported turnout is reliable and invalid. More data never fixes a validity problem.',
    },
    2: {
      type: 'diagram',
      kind: 'skew',
      title: 'Skew, and why the average moves',
      caption:
        'Income is the classic right-skewed variable: a handful of very rich people pull the mean far above the median. That is why “average income” flatters and “median income” describes. The mean always sits toward the tail.',
    },
    4: {
      type: 'steps',
      title: 'The four hurdles',
      caption:
        'Knock over any one and the claim is done. Most public arguments clear only Hurdle 3 and stop there. Random assignment clears 2 and 4 at once.',
      steps: [
        { n: '1', t: 'Mechanism', d: 'Is there a credible causal story connecting X to Y?' },
        { n: '2', t: 'Reverse causation', d: 'Can we rule out that Y causes X?' },
        { n: '3', t: 'Covariation', d: 'Do X and Y actually move together?' },
        { n: '4', t: 'Confounders', d: 'Have we controlled for Z?' },
      ],
    },
    6: {
      type: 'bars',
      title: 'Gerber, Green & Larimer (2008)',
      caption:
        'Turnout by treatment, 180,002 households. A dosage design: each step adds one ingredient, and the jump tells you what it is worth. $1.93 per vote for Neighbors, against roughly $20 door-to-door.',
      unit: '%',
      max: 40,
      rows: [
        { l: 'Control — no mail', v: 29.7 },
        { l: 'Civic Duty', v: 31.5 },
        { l: 'Hawthorne', v: 32.2 },
        { l: 'Self', v: 34.5 },
        { l: 'Neighbors', v: 37.8 },
      ],
    },
    7: {
      type: 'bars',
      title: 'Bartels: the Kansas shift, by slice',
      caption:
        'Change among white non-college voters, 1952–2004. Uncontrolled it looks like Frank is right. Control for region and the whole effect is Southern — outside the South, fifty-two years produced one point.',
      unit: 'pts',
      max: 20,
      rows: [
        { l: 'All white non-college', v: 5.9 },
        { l: '…in the South', v: 19.7 },
        { l: '…outside the South', v: 1.0 },
      ],
    },
    8: {
      type: 'bars',
      title: 'Margin of error shrinks with √n',
      caption:
        'A thousand people buys ±3 points. Halving that needs four times the sample — which is why national polls are 800–1,500. And the population size does not matter.',
      unit: '±%',
      max: 5.5,
      rows: [
        { l: 'n = 400', v: 5.0 },
        { l: 'n = 1,000', v: 3.2 },
        { l: 'n = 2,000', v: 2.2 },
        { l: 'n = 3,000', v: 1.8 },
      ],
    },
    10: {
      type: 'diagram',
      kind: 'normal-curve',
      title: 'The 68–95–99.7 rule',
      caption:
        'About 68% of cases within one SD of the mean, 95% within two, 99.7% within three. The z-score converts any value onto this scale: z = (value − mean) ÷ SD.',
    },
    12: {
      type: 'diagram',
      kind: 'scatter-chocolate',
      title: 'The most famous fake causal claim on the syllabus',
      caption:
        'Messerli (2012), NEJM. r = 0.79, so r² ≈ 0.62 — real, strong, highly significant, and not causal. No mechanism, live reverse causation, every confounder uncontrolled, and the unit of analysis is the country.',
    },
  },
  core: {
    2: {
      type: 'bars',
      title: 'Encephalization quotient — more brain, more play',
      caption:
        'Fox’s throughline: play tracks brain size across species. Dolphins sit between the great apes and us, which is why Kuczaj’s rough-toothed dolphins are the example most likely to be quizzed.',
      unit: 'EQ',
      max: 7.5,
      rows: [
        { l: 'Humans', v: 7.0 },
        { l: 'Dolphins', v: 4.5 },
        { l: 'Great apes', v: 2.3 },
      ],
    },
    3: {
      type: 'bars',
      title: 'Muscle fibre composition, vastus lateralis',
      caption:
        'Female vs. male, percent. Adapted from Ocobock & Lacy plus Haizlip et al. Every one of these is an average with heavy overlap — not a rule about individuals.',
      unit: '%',
      max: 50,
      rows: [
        { l: 'Type I — female', v: 41 },
        { l: 'Type I — male', v: 36 },
        { l: 'Type IIa — female', v: 34 },
        { l: 'Type IIa — male', v: 46 },
        { l: 'Type IIx — female', v: 23 },
        { l: 'Type IIx — male', v: 20 },
      ],
    },
    4: {
      type: 'bars',
      title: 'Hours of practice to reach chess master',
      caption:
        'Campitelli & Gobet, 104 players. The range is the finding — several logged 25,000+ hours and never made master. Epstein: “the 7,000-to-40,000-hours rule just doesn’t have the same ring to it.”',
      unit: 'hrs',
      max: 25000,
      rows: [
        { l: 'Fastest', v: 3000 },
        { l: '“The 10,000”', v: 10000 },
        { l: 'Average', v: 11053 },
        { l: 'Slowest', v: 23000 },
      ],
    },
    5: {
      type: 'bars',
      title: 'ACTN3 — who carries the XX genotype',
      caption:
        'The “sprint gene” mostly tells you who will not run an Olympic final. Of 32 Australian sprinters who reached the Olympics, zero were XX. Foster: “the best genetic test right now is a stopwatch.”',
      unit: '% XX',
      max: 28,
      rows: [
        { l: 'East Asian populations', v: 25 },
        { l: 'White Australians', v: 18 },
        { l: 'Zulu populations', v: 1 },
        { l: 'Australian Olympic sprinters', v: 0 },
      ],
    },
  },
  bus: {
    0: {
      type: 'bars',
      title: 'Where the grade actually comes from',
      caption:
        'The case and the final are 55% together. Attendance and SONA are the free 15% — zero studying required, and missing them turns an A into a B.',
      unit: '%',
      max: 32,
      rows: [
        { l: 'Midterm case write-up', v: 30 },
        { l: 'Final exam', v: 25 },
        { l: 'Group assignments (4×5%)', v: 20 },
        { l: 'Attendance', v: 10 },
        { l: 'Individual assignment', v: 10 },
        { l: 'SONA research', v: 5 },
      ],
    },
    1: {
      type: 'steps',
      title: 'The 5 C’s',
      caption:
        'The playbook for mapping a brand’s situation. Competitors is the one students define too narrowly — Netflix’s competitor was sleep, video games and going out.',
      steps: [
        { n: 'C1', t: 'Customers', d: 'Whose needs the company plans to fulfil. Size, needs, how they buy.' },
        { n: 'C2', t: 'Collaborators', d: 'Suppliers, retailers, agencies — those who create value with you.' },
        { n: 'C3', t: 'Competitors', d: 'Anyone fulfilling the same need for the same customers.' },
        { n: 'C4', t: 'Company', d: 'Resources, skills, offering, goals.' },
        { n: 'C5', t: 'Context', d: 'Economy, tech, regulation, culture.' },
      ],
    },
    2: {
      type: 'diagram',
      kind: 'three-v',
      title: 'The three legs of market value',
      caption:
        'Viable = customer value > 0 AND collaborator value > 0 AND company value > 0. Kill any leg and the offer collapses. MoviePass had two of three, which is a bankruptcy.',
    },
    7: {
      type: 'diagram',
      kind: 'perceptual-map',
      title: 'A perceptual map',
      caption:
        'Where a brand sits in the customer’s head. Open space is either an opportunity or a place nobody wants to be — your job is to say which, and why.',
    },
    8: {
      type: 'diagram',
      kind: 'funnel',
      title: 'The five-stage buying process',
      caption:
        'Buying is a process, not a moment. Each stage has its own lever, so naming the stage tells you which tactic to pull.',
    },
    9: {
      type: 'bars',
      title: 'The decoy effect — The Economist test',
      caption:
        'Nobody chose the $125 print-only option. Deleting it moved print+web from 84% down to 32% and cut revenue. An option nobody buys can be the most profitable thing on the menu.',
      unit: '% chosen',
      max: 90,
      rows: [
        { l: 'Web only — with decoy', v: 16 },
        { l: 'Print + web — with decoy', v: 84 },
        { l: 'Web only — decoy removed', v: 68 },
        { l: 'Print + web — decoy removed', v: 32 },
      ],
    },
    10: {
      type: 'bars',
      title: 'One campaign, worked through',
      caption:
        '100,000 impressions → 2,000 clicks → 60 signups on $3,000. CPA $50, first-year revenue $10,800, contribution $6,480 → ROMI 116%. And that is year one only, against a 3.5-year CLV.',
      unit: '%',
      max: 120,
      rows: [
        { l: 'CTR', v: 2.0 },
        { l: 'CVR', v: 3.0 },
        { l: 'ROMI', v: 116 },
      ],
    },
    11: {
      type: 'diagram',
      kind: 'brand-pyramid',
      title: 'Keller’s brand resonance pyramid',
      caption:
        'You cannot skip a level. Salience, then performance and imagery, then judgments and feelings, then resonance — loyalty, community, advocacy.',
    },
    12: {
      type: 'diagram',
      kind: 'channel-levels',
      title: 'Channel length',
      caption:
        'Each level adds reach and subtracts margin and control. And intensity must match positioning — luxury sold everywhere stops being luxury.',
    },
  },
};

/** Figures that belong to no single unit — shown only in Figures mode. */
export const EXTRA_FIGURES: Partial<Record<CourseId, Figure[]>> = {
  econ: [
    {
      type: 'diagram',
      kind: 'price-ceiling',
      title: 'An effective price ceiling',
      caption:
        'A binding ceiling sits below equilibrium: buyers want a lot, sellers offer little, and trade stops at Qs. Ceiling gives excess demand — a shortage. A floor sits above and gives excess supply. Draw the horizontal line before you answer.',
    },
  ],
  psci: [
    {
      type: 'diagram',
      kind: 'causal-diagrams',
      title: 'Four things a correlation can mean',
      caption:
        'Learn to tell the third panel from the fourth. An antecedent Z sits before X and destroys the claim. An intervening M sits between X and Y and explains it. Same-looking diagram, opposite verdict — a favourite exam distinction.',
    },
    {
      type: 'bars',
      title: 'Bertrand & Mullainathan (2004) — callback rates',
      caption:
        '~5,000 résumés to 1,300+ ads. A 3.2-point gap, 50% higher, worth about eight extra years of experience. And the gap widens as résumés improve: +2.29 points for white names, +0.51 (not significant) for Black ones.',
      unit: '%',
      max: 12,
      rows: [
        { l: 'White-sounding names', v: 9.65 },
        { l: 'Black-sounding names', v: 6.45 },
      ],
    },
    {
      type: 'bars',
      title: 'Levitt: share of the 1990s homicide decline explained',
      caption:
        'Homicide fell 43% between 1991 and 2001; four factors account for roughly 36 points. Meanwhile the ten largest newspapers mentioned innovative policing 52 times and legalized abortion — his second-largest factor — zero times.',
      unit: 'pts of 43',
      max: 14,
      rows: [
        { l: 'More police', v: 10 },
        { l: 'Rising prison population', v: 12 },
        { l: 'Legalized abortion', v: 10 },
        { l: 'Receding crack epidemic', v: 4 },
      ],
    },
    {
      type: 'bars',
      title: 'Representativeness among voters, 1972 vs. 2008',
      caption:
        'The punchline is the top line: it did not move. Across thirty-six years of exploding inequality the bottom income fifth sat at 0.79 both years. Race is where the change happened. 1.0 is parity.',
      unit: 'ratio',
      max: 1.2,
      rows: [
        { l: 'Bottom income fifth, 1972', v: 0.79 },
        { l: 'Bottom income fifth, 2008', v: 0.79 },
        { l: 'Aged 18–24, throughout', v: 0.77 },
        { l: 'Aged 76–84, 1972', v: 0.91 },
        { l: 'Aged 76–84, 2008', v: 1.11 },
      ],
    },
  ],
  bus: [
    {
      type: 'diagram',
      kind: 'product-life-cycle',
      title: 'The product life cycle',
      caption:
        'The stage dictates the tactic: build awareness in introduction, distribution and line extensions in growth, defend share and cut cost in maturity, harvest or kill in decline. Naming the wrong tactic for the stage is the classic wrong answer.',
    },
    {
      type: 'bars',
      title: 'Bigger samples buy precision, with sharp diminishing returns',
      caption:
        'Read the curve, not the number. 100 → 500 more than halves your error. 1,000 → 2,000 buys under a point for double the money. That trade-off is why research budgets get argued about.',
      unit: '±%',
      max: 10,
      rows: [
        { l: 'n = 100', v: 9.8 },
        { l: 'n = 500', v: 4.4 },
        { l: 'n = 1,000', v: 3.1 },
        { l: 'n = 2,000', v: 2.2 },
      ],
    },
  ],
  core: [
    {
      type: 'steps',
      title: 'Epstein’s hardware / software model',
      caption:
        'The chapter’s whole point. Skill is learned pattern-recognition running on physical equipment that varies between people — and both halves are real.',
      steps: [
        {
          n: 'SW',
          t: 'Software — chunks',
          d: 'Learned patterns. Pujols had none for Finch; chess masters lose their edge on random boards.',
        },
        {
          n: 'HW',
          t: 'Hardware — the body',
          d: 'Holm’s 1.8-ton Achilles vs. Thomas’s 10¼-inch one. Same event, opposite equipment.',
        },
        {
          n: '→',
          t: 'Talent transfer',
          d: 'Move good hardware into a better-suited sport: surf-lifesavers to Olympic skeleton in 14 months.',
        },
      ],
    },
    {
      type: 'bars',
      title: 'The data gap in sport science',
      caption:
        'A favourite quiz fact. Ocobock & Lacy’s point is not that women were studied badly — it is that the traits where males have the advantage are the only ones that got measured.',
      unit: '%',
      max: 70,
      rows: [
        { l: 'Female participants, sport & exercise science', v: 34 },
        { l: 'Female participants, supplement research', v: 14 },
        { l: 'Female-only performance publications', v: 3 },
        { l: 'Male-only performance publications', v: 63 },
      ],
    },
    {
      type: 'steps',
      title: 'Fox’s structure of argument',
      caption:
        'Notice the move: name the cost, then show a measured benefit. Reuse this shape in reflections — it is the form the rubric rewards.',
      steps: [
        { n: '1', t: 'The paradox', d: 'Everyone defines play as useless. Caillois called it “an occasion of pure waste.”' },
        { n: '2', t: 'The cost', d: 'Up to 15% of calories; 22 of 26 Peruvian sea pups killed while playing in tidal pools.' },
        { n: '3', t: 'The benefit', d: 'Higher BDNF in play-reared rats; bigger relative brain size tracks more play across 15 species.' },
        { n: '4', t: 'The conclusion', d: 'Evolution kept it for a reason — it builds brains, bodies and the ability to agree on rules.' },
      ],
    },
  ],
};
