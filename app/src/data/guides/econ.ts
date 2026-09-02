import type { Guide } from '../../lib/types';

/** Built from econ1020_study_guide.pdf — the plain-English guide. */
export const ECON_GUIDE: Guide = {
  code: 'ECON 1020',
  name: 'Principles of Microeconomics',
  blurb: 'Ten chapters, the formula sheet, and the traps that cost the most points.',
  source: 'econ1020_study_guide.pdf — your plain-English guide',
  mastery: 52,
  audio: true,
  units: [
    {
      name: '0 · How to actually pass this class',
      mastery: 68,
      cards: [
        {
          q: 'How is the grade built?',
          a: '80% exams, 20% problem sets, plus up to 3% extra credit from Top Hat. Your best exam counts 30%, the other two 25% each — or swap Midterm 3 for a comprehensive final worth 40% if it helps.',
        },
        {
          q: 'What quietly protects you in the syllabus?',
          a: 'Your lowest problem set is dropped (missing ones can be emailed at term’s end for 50%), and about five classes of Top Hat are excused. But no pset extensions, ever.',
        },
        {
          q: 'Step 1 of the four-step method?',
          a: 'Review each slide deck right after lecture, ruthlessly: could you explain every point to a friend, out loud, with no notes? He says 95% of students fool themselves here.',
        },
        {
          q: 'Step 2 and 3?',
          a: 'Do the psets alone first — every problem targets one building block, so ask which concept it is testing. Then friend, then TA. Then read the answer key carefully, including for questions you got right: a right answer for the wrong reason still costs you.',
        },
        {
          q: 'Step 4, and the thing he asks you to do yourself?',
          a: 'Practice exams, timed and closed-note — then modify every question. What would make a different answer correct? Can you reverse it Jeopardy-style? He asks you to do this rep yourself rather than having AI generate questions for you.',
        },
        {
          q: 'What separates A students?',
          a: 'Memorizers do fine until a question asks them to do something new with a definition. Top grades go to students who learned the connections between building blocks, not just the blocks.',
        },
      ],
    },
    {
      name: '1 · What economics is',
      mastery: 82,
      cards: [
        {
          q: 'Define economics and an economic agent.',
          a: 'The study of how agents choose to allocate scarce resources and how those choices affect society. An agent is anyone making choices — a person, household, firm or government.',
        },
        {
          q: 'Positive vs. normative — and the trap?',
          a: 'Positive is an objective, falsifiable claim; normative is a value judgment. The trap: a positive statement can be wrong and still be positive. What makes it positive is that it could be checked.',
        },
        {
          q: 'State the course definition of equilibrium — both halves.',
          a: 'Everyone is optimizing AND nobody believes they would personally be better off changing their own choice, holding everyone else’s fixed. Students drop the second half.',
        },
        {
          q: 'The two approaches to cause and effect in economics?',
          a: 'Theory-driven — build a model, change one thing, see what happens. Statistics-driven — imitate a controlled experiment using observational data. Real research sits on the spectrum between.',
        },
      ],
    },
    {
      name: '3 · Optimization & opportunity cost',
      mastery: 74,
      cards: [
        {
          q: 'Define opportunity cost.',
          a: 'The value of the best foregone alternative — used both as a broad idea and to put a dollar value on time.',
        },
        {
          q: 'Why do sunk costs never matter?',
          a: 'They are already spent and unrecoverable. Only future costs and benefits bear on what to do next.',
        },
        {
          q: 'Total vs. marginal analysis — why does marginal win?',
          a: 'Same answer, less arithmetic. Keep going while MB ≥ MC and stop where they cross, instead of computing net benefit for every option.',
        },
        {
          q: 'Where is the optimum, exactly?',
          a: 'Where MB and MC cross — not where total benefit is highest and not where cost is lowest. MB falls as you do more; MC usually rises.',
        },
      ],
    },
    {
      name: '4 · Supply, demand, equilibrium',
      mastery: 63,
      cards: [
        {
          q: 'What do the heights of the two curves mean?',
          a: 'Demand height is willingness to pay — the buyer’s marginal benefit. Supply height is willingness to accept — the seller’s marginal cost.',
        },
        {
          q: 'Movement along vs. shift — the #1 tested thing?',
          a: 'A change in the good’s own price moves you along the curve. A change in anything else shifts the whole curve. If price changed on its own, do not shift.',
        },
        {
          q: 'What shifts demand? What shifts supply?',
          a: 'Demand: income, substitute and complement prices, tastes, expectations, number of buyers. Supply: input prices, technology, expectations, number of sellers.',
        },
        {
          q: 'Both curves shift — what can you conclude?',
          a: 'Whichever effect the two shifts push in the same direction is certain; the other is ambiguous and depends on which shift is bigger.',
        },
        {
          q: 'Ceiling or floor — which gives a shortage?',
          a: 'An effective ceiling sits below equilibrium → excess demand → shortage, with trade only up to Qs. A floor sits above → excess supply. A ceiling above equilibrium is not binding and does nothing.',
        },
      ],
    },
    {
      name: '5 · Surplus & elasticity',
      mastery: 41,
      cards: [
        {
          q: 'Write the midpoint elasticity formula.',
          a: 'ε = [(Q₂−Q₁) ÷ ((Q₁+Q₂)/2)] ÷ [(P₂−P₁) ÷ ((P₁+P₂)/2)]. The only elasticity formula you need.',
        },
        {
          q: 'Price $4→$6, quantity 100→80. Elastic or inelastic?',
          a: '%ΔQ = −20/90 = −22.2%; %ΔP = 2/5 = 40%; ε = −0.56 → inelastic.',
        },
        {
          q: 'Which way does revenue move?',
          a: 'Inelastic: revenue moves with price. Elastic: revenue moves against it. Unit elastic: revenue unchanged and at its maximum.',
        },
        {
          q: 'Why is elasticity not slope?',
          a: 'A straight-line demand curve has one constant slope and a changing elasticity — elastic on the upper half, unit elastic at the midpoint, inelastic on the lower half. Revenue peaks at that midpoint.',
        },
        {
          q: 'What makes demand more elastic?',
          a: 'More close substitutes, a luxury rather than a necessity, a large share of the budget, a long time to adjust, and a narrowly defined market.',
        },
        {
          q: 'Consumer surplus — the two ways to find it?',
          a: 'From a table, subtract price from each unit’s WTP and add the positives. From a graph, the area below demand and above price out to Q traded — usually ½ × base × height.',
        },
        {
          q: 'Cross-price and income elasticity — what does the sign say?',
          a: 'Cross-price positive = substitutes, negative = complements. Income positive = normal good, negative = inferior good.',
        },
        {
          q: '“Bang for your buck” condition?',
          a: 'You are optimizing when MBx/Px = MBy/Py. If one side is bigger, buy more of that good.',
        },
      ],
    },
    {
      name: '6 · Producers & cost curves',
      mastery: 38,
      cards: [
        {
          q: 'Why does MC eventually rise?',
          a: 'The law of diminishing returns — adding more of one input to fixed inputs eventually raises output by smaller and smaller amounts. Ten cooks, one oven.',
        },
        {
          q: 'Economic vs. accounting profit?',
          a: 'Economic profit subtracts all opportunity costs including the salary you gave up; accounting profit subtracts only explicit money costs. Economic ≤ accounting, always.',
        },
        {
          q: 'Why does MC cut AVC and ATC at their minimums?',
          a: 'An average falls while the next value is below it and rises once the next value is above it — so the curves cross exactly at the bottom.',
        },
        {
          q: 'Shutdown vs. exit rule?',
          a: 'Short run: shut down if P < min AVC. Long run: exit if P < min ATC. Breakeven price = min ATC, where economic profit is exactly zero.',
        },
        {
          q: 'The trap on computing marginals from a table?',
          a: 'Divide by the change in Q. If output jumps 10 → 14, MC = ΔTC ÷ 4, not ΔTC.',
        },
        {
          q: 'What is the firm’s supply curve?',
          a: 'Its MC curve above the relevant shutdown point. Add firms horizontally for market supply; entry drives price to min long-run ATC and zero economic profit.',
        },
        {
          q: 'What makes supply more elastic?',
          a: 'Anything that makes the producer more flexible — inventories, non-perishability, the long run, easily adjusted variable inputs. Heavy fixed inputs make it less elastic.',
        },
      ],
    },
    {
      name: '7 · The invisible hand & efficiency',
      mastery: 57,
      cards: [
        {
          q: 'What does “efficient” mean here?',
          a: 'Total surplus (CS + PS) is maximised. Every unit left of Q* has MB above MC and is worth trading; every unit right of it costs more than it is worth.',
        },
        {
          q: 'Define deadweight loss and how to compute it.',
          a: 'The surplus destroyed when the market does not trade the efficient quantity. On a graph, the triangle between D and S over the units that failed to trade: ½ × base × height.',
        },
        {
          q: 'Pareto efficient vs. Pareto improvement?',
          a: 'Pareto efficient: you cannot make anyone better off without making someone worse off. A Pareto improvement makes at least one person better off and nobody worse off.',
        },
        {
          q: 'The equity–efficiency tradeoff?',
          a: 'Efficiency is the size of total surplus; equity is who gets it. Economics alone cannot say which balance is right — that is normative.',
        },
      ],
    },
    {
      name: '9 · Externalities',
      mastery: 34,
      cards: [
        {
          q: 'Name the four curves and what each captures.',
          a: 'MPB = value to the buyer (the demand curve). MSB = MPB plus spillover benefits. MPC = cost to the seller (the supply curve). MSC = MPC plus spillover costs.',
        },
        {
          q: 'Negative externality — which way does the market err?',
          a: 'Overproduction. MSC sits above MPC, so Q_market exceeds Q_optimal and the gap is deadweight loss. Flip it for a positive externality: MSB above MPB, underproduction.',
        },
        {
          q: 'State the Coase theorem — and its limit.',
          a: 'With clear property rights and low transaction costs, the parties bargain to the efficient quantity no matter who holds the right. Who holds it changes who pays whom, not the efficient quantity. It fails with many parties, murky rights or costly bargaining — which is why it does not solve climate change.',
        },
        {
          q: 'Command-and-control vs. market-based fixes?',
          a: 'Command-and-control sets direct rules — caps, bans, mandated technology. Market-based tools — taxes, subsidies, tradable permits — change prices so private incentives line up with social ones and let firms choose how to respond.',
        },
      ],
    },
    {
      name: '12 · Monopoly',
      mastery: 30,
      cards: [
        {
          q: 'Why does MR lie below demand for a monopolist?',
          a: 'To sell one more unit it must cut price on every unit, so MR = the new unit’s price minus revenue lost on all previous ones. For a straight-line demand curve, MR has the same intercept and twice the slope.',
        },
        {
          q: 'The two-step move for monopoly price?',
          a: 'Find Q where MR = MC, then go straight up to the demand curve to read the price. Setting price at the MR = MC intersection is the classic mistake.',
        },
        {
          q: 'What are the two kinds of barrier to entry?',
          a: 'Legal — patents, licences, government franchises. Natural — huge economies of scale, control of a key resource, network effects.',
        },
        {
          q: 'Perfect price discrimination — the striking result?',
          a: 'The firm produces the efficient quantity, so DWL = 0 — but CS = 0 and the firm captures the entire surplus. Efficient and not equitable: the cleanest proof that efficiency ≠ fairness.',
        },
      ],
    },
    {
      name: '13 · Game theory',
      mastery: 45,
      cards: [
        { q: 'The three ingredients of any game?', a: 'Players, strategies, payoffs.' },
        {
          q: 'Nash equilibrium vs. dominant strategy?',
          a: 'Nash: both players are playing a best response, so neither would unilaterally switch. Dominant: your best response no matter what the other does.',
        },
        {
          q: 'How do you solve a payoff matrix?',
          a: 'For each of P2’s columns mark P1’s best payoff; for each of P1’s rows mark P2’s best. Any cell marked twice is a Nash equilibrium.',
        },
        {
          q: 'Prisoner’s dilemma — what is the point?',
          a: '(Fink, Fink) is the unique Nash equilibrium at 1,1 even though (Quiet, Quiet) pays 2,2. The gap between individual rationality and the group outcome is the whole dilemma.',
        },
        {
          q: 'How do you solve a game tree?',
          a: 'Backward induction — start at the end, work out the last player’s move at each node, cross off branches they would never take, and work backwards. That is how you see that B’s threat to fight is not credible.',
        },
      ],
    },
    {
      name: '14/16 · Competition & information',
      mastery: 36,
      cards: [
        {
          q: 'Why are cartels unstable?',
          a: 'Collusion is a prisoner’s dilemma — each firm’s private incentive is to cheat and undercut.',
        },
        {
          q: 'What is HHI and why use it over a firm count?',
          a: 'The sum of each firm’s squared percentage market share — four firms at 25% gives 2,500, a pure monopoly 10,000. It captures share; twenty firms where one holds 95% is not competitive.',
        },
        {
          q: 'Adverse selection vs. moral hazard?',
          a: 'Adverse selection hides a type, before the deal — only sick people buy the insurance. Moral hazard hides an action, after it — insured drivers drive recklessly.',
        },
        {
          q: 'Explain the death spiral.',
          a: 'Insurers raise premiums to cover a sick pool, the healthiest drop out, the pool gets sicker, premiums rise again — adverse selection eating itself until the market can collapse.',
        },
        {
          q: 'Does every principal–agent relationship have moral hazard?',
          a: 'No. Only when the principal cannot observe what the agent actually does — exactly the kind of distinction he writes a multiple-choice question around.',
        },
      ],
    },
  ],
  frames: [
    {
      t: 'Shift vs. movement',
      d: 'Own price changed → move along the curve. Anything else → shift it.',
    },
    {
      t: 'Monopoly price',
      d: 'Quantity comes from MR = MC. Price comes off the demand curve above it.',
    },
    {
      t: 'Marginals from tables',
      d: 'Divide by ΔQ. Do not just subtract one row from the next.',
    },
    {
      t: 'Elasticity isn’t slope',
      d: 'A straight demand curve has one slope and many elasticities.',
    },
    {
      t: 'Ceiling vs. floor',
      d: 'Ceiling is below equilibrium → excess demand. Floor is above → excess supply. Draw the horizontal line before answering.',
    },
    {
      t: 'Efficient ≠ fair',
      d: 'Perfect price discrimination: zero deadweight loss, zero consumer surplus.',
    },
    {
      t: 'Zero economic profit is fine',
      d: 'In long-run competition it means you are earning exactly what you could elsewhere.',
    },
    { t: 'Positive vs. normative', d: '“Falsifiable in principle,” not “true.”' },
  ],
  selfTest: [
    {
      q: 'A question says the price of coffee rose. Do you shift the demand curve?',
      a: 'No. A change in the good’s own price is a movement along the curve. Only a change in something else — income, related prices, tastes, expectations, number of buyers — shifts it.',
    },
    {
      q: 'Price $4 → $6, quantity 100 → 80. Work the midpoint elasticity and say what happens to revenue.',
      a: '%ΔQ = −20/90 = −22.2%; %ΔP = 2/5 = 40%; ε = −0.56, inelastic. Revenue moves with price when demand is inelastic, so revenue rises.',
    },
    {
      q: 'A table shows output jumping from 10 to 14 units. How do you compute MC?',
      a: 'ΔTC ÷ 4, not ΔTC. Always divide by the change in Q — this is the trap he warns about directly.',
    },
    {
      q: 'You found the quantity where MR = MC for a monopolist. Where does the price come from?',
      a: 'Straight up to the demand curve at that quantity. Setting price at the MR = MC intersection is the classic mistake.',
    },
    {
      q: 'Why is zero economic profit not a failure?',
      a: 'In long-run competition it means you are earning exactly what you could earn elsewhere — all opportunity costs are already subtracted. Economic profit ≤ accounting profit, always.',
    },
    {
      q: 'Perfect price discrimination: efficient or fair?',
      a: 'Efficient and not fair. The firm produces the efficient quantity so DWL = 0, but CS = 0 and the firm captures the entire surplus. The cleanest proof that efficiency ≠ fairness.',
    },
    {
      q: 'An effective price ceiling — draw it and say what happens.',
      a: 'It sits below equilibrium. Buyers want a lot, sellers offer little: excess demand, a shortage, with trade only up to Qs. A ceiling above equilibrium is not binding and does nothing.',
    },
    {
      q: 'Adverse selection or moral hazard: insured drivers drive more recklessly?',
      a: 'Moral hazard — a hidden action, after the deal. Adverse selection is a hidden type, before the deal: only sick people buy the insurance.',
    },
    {
      q: 'Does every principal–agent relationship have moral hazard?',
      a: 'No. Only when the principal cannot observe what the agent actually does — exactly the distinction he writes a multiple-choice question around.',
    },
    {
      q: 'Four firms each hold 25% of a market. What is the HHI, and why not just count firms?',
      a: '4 × 25² = 2,500. A pure monopoly is 10,000. HHI captures share, and twenty firms where one holds 95% is not a competitive market.',
    },
    {
      q: 'Solve a game tree — what is the method, and what does it reveal?',
      a: 'Backward induction. Start at the end, work out the last player’s move at each node, cross off branches they would never take, work backwards. It is how you see that B’s threat to fight is not credible — carrying it out would hurt B.',
    },
    {
      q: 'A positive statement can be false. Is it still positive?',
      a: 'Yes. What makes a statement positive is that it could be checked against evidence — falsifiable in principle, not true.',
    },
  ],
  terms: [
    {
      t: 'Elasticity (midpoint)',
      d: 'ε = [(Q₂−Q₁)/((Q₁+Q₂)/2)] ÷ [(P₂−P₁)/((P₁+P₂)/2)]',
    },
    { t: 'Costs', d: 'TC = TFC + TVC · MC = ΔTC/ΔQ · ATC = TC/Q · AVC = TVC/Q · AFC = TFC/Q' },
    { t: 'Revenue & profit', d: 'TR = P×Q · π = TR − TC = Q × (P − ATC)' },
    {
      t: 'Perfect competition',
      d: 'P = MR = AR; produce where P = MC; long-run price = min ATC',
    },
    {
      t: 'Surplus',
      d: 'CS under D above P · PS above MC under P · TS = CS + PS · triangle = ½ × base × height',
    },
    { t: 'Social optimum', d: 'MSB = MSC, against a market outcome at MPB = MPC' },
    { t: 'HHI', d: 'Σ (each firm’s % market share)²' },
  ],
};
