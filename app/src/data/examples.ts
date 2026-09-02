import type { CourseId, Example } from '../lib/types';

/**
 * Cases mode — the concepts pointed at things you can actually see.
 * All four professors grade on applying an idea to a case you have not met
 * before, so this is the rep for that.
 */
export const EXAMPLES: Record<CourseId, Example[]> = {
  econ: [
    {
      tag: 'Elasticity',
      t: 'Why the campus dining plan never gets cheaper',
      d: 'Meal plans are close to perfectly inelastic for on-campus first-years — no substitutes, mandatory, and the budget share is fixed in advance. |ε| < 1 means a price rise raises revenue, which is exactly the incentive the seller faces.',
    },
    {
      tag: 'Sunk cost',
      t: 'The $180 textbook you already bought',
      d: 'Acemoglu, Laibson and List is “not formally required.” The money is gone either way, so the only question is whether the next hour with it beats the next hour without it. Buying it is not a reason to read it.',
    },
    {
      tag: 'Price ceiling',
      t: 'Rent control on 21st Avenue',
      d: 'A binding ceiling sits below equilibrium: more students want the apartment than landlords will supply, trade stops at Qs, and the rationing moves to queues, connections and condition. The shortage is the mechanism, not a side effect.',
    },
    {
      tag: 'Monopoly',
      t: 'The one printer in Sarratt',
      d: 'Market power is the ability to set price above marginal cost. Q comes from MR = MC, price comes off the demand curve — and the students who would have printed at cost but not at the posted price are the deadweight loss.',
    },
    {
      tag: 'Game theory',
      t: 'Group projects as a prisoner’s dilemma',
      d: 'Coasting dominates for each member, so (coast, coast) is the Nash equilibrium even though everyone prefers (work, work). Grading contribution individually changes the payoffs — which is the point.',
    },
    {
      tag: 'Adverse selection',
      t: 'Course reviews on Rate My Professor',
      d: 'Only the delighted and the furious write reviews — a hidden-type problem before the deal. The fix is better information, not a bigger sample of the same self-selected pool.',
    },
    {
      tag: 'Externality',
      t: 'The 2am group chat in a shared suite',
      d: 'Your marginal private benefit is high and the cost lands on people who were not party to the decision. MSC sits above MPC, so the activity is overproduced — and the Coase fix works here precisely because there are few parties and clear norms.',
    },
    {
      tag: 'Opportunity cost',
      t: 'An unpaid internship that “pays in experience”',
      d: 'The cost is the best foregone alternative, priced at your wage. Twelve weeks at 30 hours and $18 is about $6,500 — so the question is whether the experience is worth more than that, not whether the internship is free.',
    },
  ],
  psci: [
    {
      tag: 'Four hurdles',
      t: '“Vanderbilt students who join a club have higher GPAs.”',
      d: 'Hurdle 3 is easy. Hurdle 2: high-GPA students have the slack to join. Hurdle 4: family resources, prior preparation and course load cause both. The claim clears one hurdle of four.',
    },
    {
      tag: 'Selection on Y',
      t: 'Studying only the startups that made it',
      d: 'Every case has the same outcome, so nothing distinguishes causes from constants. KKV: select on X, never on Y. The same error kills “what makes a Rhodes Scholar” pieces.',
    },
    {
      tag: 'Ecological fallacy',
      t: 'Chocolate and Nobel prizes',
      d: 'r = 0.79, p < .0001, 23 countries — and not one laureate’s diet was ever observed. Messerli wrote it as a joke; it is on the syllabus because the joke keeps getting published seriously.',
    },
    {
      tag: 'Measurement',
      t: 'Turnout that never actually fell',
      d: 'Leighley & Nagler: 58.4–65.5% throughout, once you use citizens as the denominator. Noncitizens grew from under 2% to 8.4% of the voting-age population — the whole “decline” is a denominator artifact.',
    },
    {
      tag: 'Weighting',
      t: 'Four pollsters, one dataset, five points apart',
      d: 'Cohn gave 867 identical Florida interviews to four outside pollsters and got Clinton +4 through Trump +1. Zero sampling difference. Weighting and the likely-voter screen did all of it.',
    },
    {
      tag: 'Experiment',
      t: 'The mailer that shamed people into voting',
      d: '+8.1 points at $1.93 per vote against roughly $20 door-to-door. It also generated hundreds of angry calls — a good exam answer names the effect and the cost.',
    },
    {
      tag: 'Operationalization',
      t: 'Who counts as “working class” on a ballot map',
      d: 'Define it by degree and Bartels finds −5.9 points. Define it by income and the poorest white voters moved toward the Democrats. Frank never fixed his definition, so his thesis was never testable.',
    },
    {
      tag: 'Effect size',
      t: 'Why the newspapers got the crime decline wrong',
      d: 'Levitt’s four factors explain about 36 of the 43 points. Newspapers mentioned innovative policing 52 times and legalized abortion zero. Explanations get ranked by how satisfying they are, not by how much they explain.',
    },
  ],
  core: [
    {
      tag: 'Play',
      t: 'Pickup on the Rec turf vs. intramural league',
      d: 'Brown’s seven characteristics survive in pickup and thin out under leagues, refs and standings. Reflection #1 lives exactly here: making play serious can destroy the freedom that made it useful.',
    },
    {
      tag: 'Embodiment',
      t: 'Learning to swim at eighteen',
      d: 'The fear is not a fact about water — it is biology, history and practice folded into one body. That is embodiment in a sentence, and it is the reflection move Torres Colón rewards.',
    },
    {
      tag: 'Chunking',
      t: 'Why you can read a defence and your friend cannot',
      d: 'Same eyes, same reaction time. What differs is the database of patterns — De Groot’s chess masters, Abernethy’s occluded badminton forearm, Pujols against Jennie Finch.',
    },
    {
      tag: 'Race & genetics',
      t: 'The “sprint gene” test sold online',
      d: 'ACTN3 rules out roughly one in seven people worldwide and almost nobody of African descent. Foster: “the best genetic test right now is a stopwatch.”',
    },
    {
      tag: 'Endurance',
      t: 'Sophie Power at the Ultra-Trail du Mont-Blanc',
      d: '168 km while breastfeeding a three-month-old. Ocobock & Lacy close on it because motherhood at 500–600 kcal a day is itself a multi-year endurance event.',
    },
    {
      tag: 'Structure',
      t: 'Why Jamaica keeps producing sprinters',
      d: 'Champs since 1910, a 35,000-seat proving ground, boosters who move fast kids into track high schools. Talent is kept in the sprint pipeline instead of leaking to football as it does in the US.',
    },
    {
      tag: 'Biocultural',
      t: 'The Commodores’ strength programme',
      d: 'Not nature vs. nurture — how much each contributes, here. Training loads act on tendon stiffness and fibre type that already varied between athletes before anyone lifted anything.',
    },
    {
      tag: 'Ritual',
      t: 'The Anchor Down chant before kickoff',
      d: 'Gmelch’s finding is that ritual clusters where uncertainty is highest. A stadium doing the same thing every Saturday is the ball court, doing the work Fox says play has always done: agreeing on rules together.',
    },
  ],
  bus: [
    {
      tag: '5 C’s',
      t: 'Vanderbilt dining as a marketing problem',
      d: 'Customers: students on a mandatory plan. Collaborators: Rand, Commons, the food trucks. Competitors: not other dining halls — it is Hillsboro Village, DoorDash and skipping lunch. Context: a captive first-year market that ends after one year.',
    },
    {
      tag: '3-V',
      t: 'Why MoviePass died',
      d: 'Customer value enormous, collaborator value real, company value deeply negative. Two out of three is a bankruptcy — the cleanest test to run on any student business idea.',
    },
    {
      tag: 'Distribution & brand',
      t: 'Blockbuster’s late fees',
      d: 'Not a pricing footnote — the single association customers held about the company. A tactic set badly in one box redefined a different box entirely.',
    },
    {
      tag: 'Decoy effect',
      t: 'The Economist’s $125 print-only option',
      d: 'Nobody chose it. Deleting it moved print+web from 84% to 32% and cut revenue. An option nobody buys can be the most profitable thing on the menu.',
    },
    {
      tag: 'CLV',
      t: 'What a streaming subscriber is worth',
      d: '$15/mo × 12 × 60% margin × 3.5 years = $378. That is the ceiling on acquisition spend; at $120 CAC each subscriber nets about $258. Every “is this campaign worth it?” question reduces to this.',
    },
    {
      tag: 'Positioning',
      t: 'Franz boxed wine',
      d: 'Mekanism repositioned a low-status category through voice alone — irreverent, cheap, unembarrassed. No product change. Communication doing the work the perceptual map predicted.',
    },
    {
      tag: '4 A’s',
      t: 'Google Glass',
      d: 'Awareness was enormous and accessibility was fine. It failed acceptability — people did not want to be seen wearing it. Any offer that fails one of the four A’s fails.',
    },
    {
      tag: 'Segmentation',
      t: 'Naming an Opera Philadelphia segment properly',
      d: '“Lapsed single-ticket buyers who came for a festival production” beats “25–44 year-olds” every time. Behaviour and motivation, then show the mix changing for them — that is the 40% rubric line.',
    },
  ],
};
