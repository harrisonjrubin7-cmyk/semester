import type { Guide } from '../../../lib/types';

/**
 * Ported from the "BUS 1600 Field Manual" artifact — the core toolkit, all
 * twelve sessions, the midterm case playbook, the formula sheet and the
 * twelve-question self-quiz.
 */
export const BUS_GUIDE: Guide = {
  code: 'BUS 1600',
  name: 'Marketing Management',
  blurb: 'Four frameworks carry the course. Then the case playbook.',
  source: 'BUS 1600 Field Manual — the whole semester on one page',
  mastery: 58,
  audio: true,
  units: [
    {
      name: '0 · How the grade works',
      mastery: 72,
      cards: [
        {
          q: 'What actually decides your grade?',
          a: 'One 3-page case write-up (30%) and one final exam (25%) — 55% together. Everything else is points you lose only by not showing up.',
        },
        {
          q: 'What is “the free 15%”?',
          a: 'Attendance (10%) plus SONA research sessions (5%) require zero studying. Miss them and an A becomes a B.',
        },
        {
          q: 'What is the SONA trap?',
          a: 'You must attend once in each window — Sep 8–17 and Sep 29–Oct 8. Two sessions in one window earns only 2.5%. Miss window 1 and the full 5% is gone permanently.',
        },
        {
          q: 'How does late work get penalized?',
          a: '1–7 days late = −20%. 8–14 days = −50%. Past 14 days = zero. Nothing is accepted after Oct 13, 11:59 PM CT.',
        },
        {
          q: 'What does the honour code say about AI here?',
          a: 'Do not upload course text or Harvard cases to an LLM, and any AI use must be cited to its original source, not the model. Study from a guide; write the case yourself from the case PDF.',
        },
        {
          q: 'What is the shape of the calendar?',
          a: 'A 2-credit course compressed into seven weeks, Aug 27 → Oct 13, thirteen sessions. The final is 40 multiple choice + 10 short answer.',
        },
      ],
    },
    {
      name: '1 · The 5 C’s',
      mastery: 78,
      cards: [
        {
          q: 'Name the 5 C’s.',
          a: 'Customers, Collaborators, Competitors, Company, Context. The company sits in the middle; the other four are the world around it.',
        },
        {
          q: 'What does each C ask?',
          a: 'Customers: whose needs are we fulfilling? Collaborators: who helps us create value? Competitors: who else chases the same need in the same customers? Company: our resources, skills, offering, goals. Context: economy, tech, regulation, culture.',
        },
        {
          q: 'Which C do students define too narrowly?',
          a: 'Competitors — anyone aiming to fulfil the same need for the same customers. Netflix’s competitor was never only Blockbuster; it was sleep, video games and going out.',
        },
        {
          q: '5 C’s for Opera Philadelphia?',
          a: 'Customers: aging subscribers plus a young occasional audience. Collaborators: the Academy of Music, donors, festival venues. Competitors: every other Friday night in Philadelphia. Company: mid-size, bold artistic reputation, thin margins. Context: post-pandemic attendance, streaming, an older donor base.',
        },
      ],
    },
    {
      name: '2 · The 3-V principle',
      mastery: 66,
      cards: [
        {
          q: 'State the 3-V market value principle.',
          a: 'Customer value > 0 AND collaborator value > 0 AND company value > 0, all at once. Kill any leg and the offer collapses.',
        },
        {
          q: 'What does each leg mean?',
          a: 'Customer value: benefits minus price — if negative nobody buys. Collaborator value: enough margin and reason for partners to carry it — if negative nobody sells it. Company value: profit, share or strategic position — if negative we cannot sustain it.',
        },
        {
          q: 'Customers delighted, partners paid, company losing money — verdict?',
          a: 'Not viable. MoviePass is the case: $10/month unlimited films gave enormous customer value and theatres got full price, but company value was deeply negative. Two out of three is a bankruptcy.',
        },
      ],
    },
    {
      name: '3 · The seven tactics',
      mastery: 70,
      cards: [
        {
          q: 'The seven tactics in their three groups?',
          a: 'Design the offering: product, service, brand, price, incentives. Communicate it: communication. Deliver it: distribution. This is Chernev’s update of the old 4 P’s.',
        },
        {
          q: 'Which two tactics explain Blockbuster’s failure?',
          a: 'Distribution — slow to streaming, hard to collaborate with, new-release shortages — and brand: a brick-and-mortar retailer defined by late fees.',
        },
        {
          q: 'Why is “late fees” filed under brand, not incentives?',
          a: 'A pricing-and-incentives decision became the single association customers held about the company. One badly set tactic redefined a different box entirely.',
        },
        {
          q: 'What is the discipline the tactics impose?',
          a: 'Always walk all seven. Blockbuster did not lose on price or advertising — it lost on the two tactics most students forget to check.',
        },
      ],
    },
    {
      name: '4 · SWOT',
      mastery: 74,
      cards: [
        {
          q: 'Which half of SWOT is internal?',
          a: 'Strengths and weaknesses are internal to the company — patents, brand equity, cost position, talent; thin cash, weak distribution, no digital team. Opportunities and threats are external.',
        },
        {
          q: '“Consumers increasingly prefer sustainable fashion” — where does it go on ECOALF’s SWOT?',
          a: 'Opportunity, external. Better still, the derivative opportunity it creates for ECOALF specifically — a virtual store, a persistent-trend product line — not that the trend exists.',
        },
        {
          q: 'What is the exact mistake Hogue flagged?',
          a: 'Putting external forces in Strengths, or company facts in Opportunities. For ECOALF, S/W are internal to ECOALF only.',
        },
      ],
    },
    {
      name: '5 · Value & customer centricity',
      mastery: 52,
      cards: [
        {
          q: 'Value chain vs. value delivery network?',
          a: 'Value chain (Porter): everything inside your firm that adds value, design to delivery — Apple from chip design to the Genius Bar. Value delivery network: the wider ecosystem of suppliers, distributors and customers, like Toyota’s tier-1 network.',
        },
        {
          q: 'What is value migration?',
          a: 'Economic value shifting away from stale business models toward more agile ones — cable bundles to streaming.',
        },
        {
          q: '$180 revenue a year, 60% gross margin, 3.5 years — CLV?',
          a: '$108 profit a year × 3.5 = $378. That is the ceiling on acquisition spend; at $120 CAC each subscriber nets about $258.',
        },
        {
          q: 'What is value-based pricing, and Oberholzer-Gee’s definition of value?',
          a: 'Price set from customers’ perceived value rather than your costs — an EpiPen costs a few dollars to make. Customer value = what the customer appreciates the product at, minus what they must pay.',
        },
        {
          q: 'Define customer centricity.',
          a: '“Seeing the world in general, and a company’s services in particular, from the customer’s point of view.”',
        },
        {
          q: 'Name the 4 A’s.',
          a: 'Acceptability, affordability, accessibility, awareness — Sheth & Sisodia’s four management failures behind most business failures. Google Glass failed acceptability.',
        },
        {
          q: 'The counterpoint Hogue wants you to hold.',
          a: 'Marshall Field: “the customer is always right.” Bezos: start with the customer and work backwards. But Kelleher of Southwest: the customer is sometimes wrong, and defending an abusive customer over your own employee is a betrayal. Customer centricity starts with employees.',
        },
        {
          q: 'The five steps of an A/B test?',
          a: 'Formulate the hypothesis, isolate one variable, define success metrics up front, execute a 50/50 split launch to similar audiences, analyse and iterate. Primary KPIs: CTR and CVR.',
        },
        {
          q: 'Why does an A/B test work?',
          a: 'Because only one thing changed, the difference in results is the effect of that thing. Change two variables and you learn nothing.',
        },
      ],
    },
    {
      name: '6 · Marketing research',
      mastery: 44,
      cards: [
        {
          q: 'What does research actually do for a company?',
          a: 'It rarely finds the next big thing. Done right it focuses the debate on strategy — shortening timelines and raising confidence. Done badly it is a disaster, and “speed to market is no excuse for negligence.”',
        },
        {
          q: 'The seven steps of the research process?',
          a: 'Define the central question, build objectives, write the brief, collect data, analysis and insight, presentation and reporting, recommendations and next steps.',
        },
        {
          q: 'Qualitative, quantitative or observational — how do you choose?',
          a: 'Qual when the issue is not well understood or the answer needs no number. Quant when you need a measurable answer. Observational when you need a compelling reason to believe from real behaviour.',
        },
        {
          q: 'Remember the split.',
          a: 'Qualitative tells you why and cannot be projected to a population. Quantitative tells you how many and can. Observation tells you what people actually did rather than what they said.',
        },
        {
          q: 'Primary vs. secondary data?',
          a: 'Primary is freshly gathered for your project — expensive, slow, exactly on-question (Kantar, IPSOS, Morning Consult). Secondary already exists for another purpose — cheap, fast, not on-question (Nielsen, IRI, Mintel).',
        },
        {
          q: 'The three decisions in a sampling plan?',
          a: 'Sampling unit (whom), sample size (how many), sampling procedure (how chosen). Screening criteria define the addressable market; quotas keep it representative.',
        },
        {
          q: 'n = 500 and you want to halve your error — cost?',
          a: 'About n = 2,000. Error falls with √n. Going 100 → 500 more than halves your error; going 1,000 → 2,000 buys under a point for double the money.',
        },
        {
          q: 'Why is conjoint better than “what would you pay?”',
          a: 'It forces trade-offs between whole competing offers, the way a real purchase works. It produces part-worth utilities and predicts preference share for products that do not exist yet.',
        },
        {
          q: 'How is a conjoint study built?',
          a: 'Pick 4–6 attributes with levels. A fractional factorial or orthogonal design shows each respondent only a subset — 5 to 15 choice tasks — so they do not fatigue but the statistics still hold.',
        },
        {
          q: 'What does a good central question look like?',
          a: 'It names a decision (“what monthly price”), a metric (“maximizes revenue”), and a testable add-on (“does NYT content drive incremental sales”). Copy that shape.',
        },
      ],
    },
    {
      name: '7 · Segmentation, targeting, positioning',
      mastery: 56,
      cards: [
        {
          q: 'STP in order?',
          a: 'Segment the market into groups that would respond differently. Target the ones worth serving on size, growth, fit and competitive intensity. Position the single idea you want to own in their head.',
        },
        {
          q: 'Four ways to cut a market?',
          a: 'Demographic, geographic, psychographic, behavioural. Behavioural — usage rate, occasion, loyalty, benefit sought — is usually the most predictive.',
        },
        {
          q: 'What makes a segment worth targeting?',
          a: 'Measurable, substantial, accessible, actionable. A segment you cannot reach is a fact, not a strategy.',
        },
        {
          q: 'The positioning statement template?',
          a: 'For [target] who [need or occasion], [brand] is the [frame of reference] that [point of difference] because [reason to believe].',
        },
        {
          q: 'What does open space on a perceptual map mean?',
          a: 'Either an opportunity or a place nobody wants to be. Your job is to say which, and why.',
        },
        {
          q: 'How should you name a target segment in the case?',
          a: 'By behaviour and motivation — “lapsed single-ticket buyers who came for a festival production” — not by age bracket, then show the mix changing for them. That is what “insights beyond the obvious” means in the 40% rubric line.',
        },
      ],
    },
    {
      name: '8 · Consumer behaviour',
      mastery: 60,
      cards: [
        {
          q: 'The five stages of the buying process, with levers?',
          a: 'Problem recognition (communication that names the need), information search (SEO, reviews, retail), evaluation (positioning, brand, price), purchase (incentives, distribution, checkout friction), post-purchase (service, loyalty, CLV).',
        },
        {
          q: 'The core idea?',
          a: 'Buying is a process, not a moment. Tactics attach to different stages, so knowing the stage tells you which lever to pull.',
        },
        {
          q: 'The four influences on a buyer?',
          a: 'Cultural (slowest-moving and strongest), social (why influencer marketing works), personal, psychological.',
        },
        {
          q: 'How does Simply Good Jars map onto the stages?',
          a: 'Stage 1 is the problem — a healthy lunch you do not have to make. Stage 5 is the jar return, where the post-purchase behaviour is the sustainability story.',
        },
      ],
    },
    {
      name: '9 · Behavioural economics',
      mastery: 48,
      cards: [
        {
          q: 'Ariely’s core claim?',
          a: 'People are not rational utility-maximisers, they are predictably irrational — so how you frame an offer changes demand as much as the offer itself. The standard model is a special case, not the whole thing.',
        },
        {
          q: 'Anchoring, loss aversion, decoy — one line each.',
          a: 'Anchoring: the first number sets the reference — a $1,200 list price makes $700 feel like a deal. Loss aversion: losing $100 hurts about twice as much as gaining $100 pleases. Decoy: an obviously worse third option changes which of the other two people pick.',
        },
        {
          q: 'Nobody chose the $125 print-only decoy — why keep it?',
          a: 'With the decoy, print+web took 84% and web-only 16%. Remove it and print+web falls to 32% while web-only jumps to 68% — cutting revenue. An option nobody buys can be the most profitable thing on the menu.',
        },
        {
          q: 'The likely short-answer question here?',
          a: '“Give an example of a behavioural bias and how a marketer would use it ethically.” Note the word ethically — “ethical influence” is a stated student goal, so the boundary matters.',
        },
      ],
    },
    {
      name: '10 · Digital marketing & metrics',
      mastery: 40,
      cards: [
        {
          q: 'CTR, CVR, CPA, ROMI — the formulas?',
          a: 'CTR = clicks ÷ impressions. CVR = conversions ÷ clicks. CPA = spend ÷ conversions. ROMI = (incremental revenue × contribution margin − spend) ÷ spend.',
        },
        {
          q: 'Work the funnel: 100k impressions, 2,000 clicks, 60 signups, $3,000 spend.',
          a: '2.0% CTR, 3.0% CVR, $50 CPA. 60 × $180 = $10,800 × 60% margin = $6,480. ROMI = ($6,480 − $3,000) ÷ $3,000 = 116% — and that is year one only, against a 3.5-year CLV.',
        },
        {
          q: 'Why does digital get its own session?',
          a: 'It is the only channel where every stage of the funnel is measured — so it is where marketing has to prove ROI.',
        },
        {
          q: 'What is wrong with last-click attribution?',
          a: 'It over-credits search and under-credits awareness. Easy and wrong.',
        },
        {
          q: 'Owned vs. earned vs. paid media?',
          a: 'Owned — your site and list — compounds. Earned is press, reviews, word of mouth. Paid stops the day you stop paying.',
        },
        {
          q: 'What is close-loop analysis?',
          a: 'Evaluate results → improve product or creative → run a new campaign, logging everything in a performance database so targeting improves each cycle.',
        },
      ],
    },
    {
      name: '11 · Product & branding',
      mastery: 54,
      cards: [
        {
          q: 'A product is three things at once — which?',
          a: 'Core benefit (the need it solves), actual product (features, quality, design), augmented product (warranty, service, delivery, community). Competitors copy the actual, rarely the augmented.',
        },
        {
          q: 'Product life cycle stages and their priorities?',
          a: 'Introduction: heavy advertising, build awareness. Growth: distribution and line extensions. Maturity: defend share, price and promotion defence. Decline: harvest or kill. Naming the wrong tactic for the stage is the classic wrong answer.',
        },
        {
          q: 'Define brand equity.',
          a: 'The extra value the name adds beyond the physical product — why someone pays more, searches by name, or forgives a mistake.',
        },
        {
          q: 'Keller’s resonance pyramid, bottom to top?',
          a: 'Salience (who are you?), performance and imagery (what are you?), judgments and feelings, resonance (loyalty, community, advocacy). You cannot skip a level.',
        },
        {
          q: 'What builds and what destroys brand equity?',
          a: 'Builds: consistent positioning, distinctive assets, quality matching the promise, experiences worth telling people about. Destroys: constant discounting (teaches people to wait), inconsistent messaging, blurring line extensions, service that contradicts the ad.',
        },
        {
          q: 'What is IMC?',
          a: 'Integrated marketing communications: every channel says a version of the same thing, and the message is decided by the positioning statement, not by the channel.',
        },
        {
          q: 'Match funnel stage to channel and metric.',
          a: 'Awareness: TV, streaming, out-of-home, influencer, PR → reach. Consideration: social, content, search, reviews → engagement, CTR. Conversion: paid search, retargeting, email, POP → CVR, CPA. Loyalty: CRM, loyalty programme, community → retention, CLV, referral.',
        },
      ],
    },
    {
      name: '12 · Pricing & distribution',
      mastery: 46,
      cards: [
        {
          q: 'Cost, competitors, customers — what does each set?',
          a: 'Cost sets the floor. Competitors set the ceiling. Only the customer tells you the right price — value-based pricing, measured with conjoint, is the one he teaches.',
        },
        {
          q: 'What does each pricing method ignore?',
          a: 'Cost-plus ignores what customers would happily pay and leaves money on the table. Competition-based ignores your own differentiation and invites a price war. Value-based is hardest and highest-margin.',
        },
        {
          q: 'Elastic or inelastic — which way do you move price?',
          a: '|E| > 1 elastic: a price cut raises revenue. |E| < 1 inelastic: a price rise raises revenue. Raise price 10%, volume falls 4% → E = −0.4 → inelastic → revenue rises.',
        },
        {
          q: 'Push vs. pull?',
          a: 'Push markets to the channel — trade deals, slotting fees, sales incentives. Pull markets to the customer so they walk in asking for it and the retailer has to stock it.',
        },
        {
          q: 'Channel levels, and the trade-off?',
          a: '0-level direct: full margin, data and control, but you fund it. 1-level retailer: more reach, shared margin. 2-level wholesaler + retailer: widest reach, thinnest margin, least shelf control.',
        },
        {
          q: 'Why must distribution intensity match positioning?',
          a: 'Luxury sold everywhere stops being luxury. Intensive (Coke), selective (Levi’s), exclusive (luxury cars) — the link between distribution and brand equity.',
        },
        {
          q: 'Why is distribution the “Accessibility” A?',
          a: 'Distribution is availability. A product the target cannot conveniently get does not exist to them — and it is the tactic that killed Blockbuster.',
        },
      ],
    },
  ],
  frames: [
    {
      t: '1 · Executive summary',
      d: 'The Hook (most pressing challenge or opportunity), The Ask (what decision is needed now), The Bottom Line (your recommendation with fact-based support). Write this section last.',
    },
    {
      t: '2 · Situational diagnosis — the “why”',
      d: 'Do not summarise the case — the executives know their own history. Critically analyse the market with the 5 C’s and SWOT.',
    },
    {
      t: '3 · Strategic alternatives',
      d: 'The case outlines three. Evaluate them and say plainly which you recommend.',
    },
    {
      t: '4 · Recommendation & implementation — the “how”',
      d: 'Three to four recommendations. Name target segments from the segmentation workbook. Apply the seven tactics where relevant — you need not use all.',
    },
    {
      t: '5 · Risk mitigation',
      d: 'The top two risks of your recommendation and how the company pivots if they occur. He is an economist: a deliverable without risk is incomplete.',
    },
    {
      t: 'How it is scored',
      d: 'Analytical rigor 40%, strategic alignment 30%, correct use of concepts 20%, professionalism 10%. Rigor means deep use of the frameworks with insight beyond the obvious.',
    },
    {
      t: 'His three stated tips',
      d: 'Think like an owner — what is your guidance to the Executive Director? Apply the “so what?” test: every exhibit must lead to a decision or get cut. Persuasion, not description.',
    },
    {
      t: 'Hard constraints',
      d: 'Stay inside the case timeframe — no hindsight. No outside research, no consulting former students. Do not upload the case to an LLM. Max 3 pages of text; exhibits are supplemental.',
    },
  ],
  selfTest: [
    {
      q: 'Name the 5 C’s and say which one students most often define too narrowly.',
      a: 'Customers, Collaborators, Competitors, Company, Context. Competitors is the one — it means anyone fulfilling the same need for the same customer, not just firms in your industry.',
    },
    {
      q: 'An offer delights customers and pays partners well but loses the company money. What does the 3-V principle say?',
      a: 'It is not viable. All three legs — customer, collaborator, company — must be positive at the same time. Two out of three is MoviePass.',
    },
    {
      q: 'List the seven marketing tactics in their three groups.',
      a: 'Design: product, service, brand, price, incentives. Communicate: communication. Deliver: distribution.',
    },
    {
      q: 'Which two tactics explain Blockbuster’s failure?',
      a: 'Distribution (slow to embrace streaming, difficult to collaborate with, new-release shortages) and brand (a brick-and-mortar retailer, defined in customers’ minds by late fees).',
    },
    {
      q: 'On a SWOT for ECOALF, where does “consumers increasingly prefer sustainable fashion” go — and why do students get it wrong?',
      a: 'Opportunity — it is external. Strengths and weaknesses are internal to ECOALF only. And push it further: the graded answer is the derivative opportunity, e.g. what that trend lets ECOALF build, like a virtual store.',
    },
    {
      q: 'Difference between value chain and value delivery network?',
      a: 'Value chain (Porter) = activities inside your company from design to delivery. Value delivery network = the broader ecosystem of you, suppliers, distributors and customers improving the whole system.',
    },
    {
      q: 'A customer generates $180 revenue a year at 60% margin and stays 3.5 years. What is CLV, and what does it tell you?',
      a: '$180 × 0.60 = $108/year × 3.5 = $378. It is the ceiling on what you can sustainably spend to acquire that customer.',
    },
    {
      q: 'Name the 4 A’s and give a product that failed one.',
      a: 'Acceptability, Affordability, Accessibility, Awareness. Google Glass had awareness and accessibility but failed acceptability — people did not want to be seen wearing it.',
    },
    {
      q: 'Give the five steps of an A/B test.',
      a: 'Formulate hypothesis → isolate one variable → define success metrics → execute a 50/50 split launch → analyse and iterate. Primary KPIs: CTR and CVR.',
    },
    {
      q: 'Why is conjoint considered better than asking “what would you pay?”',
      a: 'It forces real trade-offs between whole competing offers, mirroring an actual purchase. It also predicts preference share for products that do not exist yet.',
    },
    {
      q: 'You have 500 respondents and want to halve your margin of error. What does that cost?',
      a: 'Roughly 2,000 respondents — four times the sample — because error falls with the square root of n. That diminishing return is the core sampling trade-off.',
    },
    {
      q: 'Ariely’s decoy: nobody chose print-only at $125. Why keep it on the page?',
      a: 'Because its presence made print+web at the same price look obviously superior, moving choice from 32% to 84%. An option nobody buys can still drive the most revenue.',
    },
  ],
  terms: [
    { t: '5 C’s', d: 'Customers, Collaborators, Competitors, Company, Context — the situation map.' },
    {
      t: '3-V principle',
      d: 'An offer must create value for customer, collaborator and company simultaneously.',
    },
    {
      t: '7 tactics',
      d: 'Product, Service, Brand, Price, Incentives, Communication, Distribution.',
    },
    {
      t: 'Value chain vs. delivery network',
      d: 'Chain = activities inside your firm. Network = the whole partner ecosystem.',
    },
    { t: 'Value migration', d: 'Economic value shifting from stale models to more agile ones.' },
    {
      t: 'Value proposition',
      d: 'The total benefits promised in exchange for the customer’s money and patronage.',
    },
    {
      t: 'Customer centricity',
      d: 'Seeing the world, and your services, from the customer’s point of view.',
    },
    {
      t: '4 A’s',
      d: 'Acceptability, Affordability, Accessibility, Awareness — the four failure modes.',
    },
    {
      t: 'Primary vs. secondary data',
      d: 'Freshly gathered for this project vs. already collected for another purpose.',
    },
    {
      t: 'Qual / quant / observational',
      d: 'Why it happens / how many / what people actually did.',
    },
    { t: 'Sampling plan', d: 'Sampling unit, sample size, sampling procedure.' },
    {
      t: 'Conjoint / DCE',
      d: 'Trade-off experiment yielding part-worth utilities and preference-share simulation.',
    },
    {
      t: 'Part-worth utility',
      d: 'How much one attribute level contributes to total preference.',
    },
    {
      t: 'Fractional factorial',
      d: 'Showing each respondent a statistically valid subset of all combinations.',
    },
    {
      t: 'A/B test',
      d: 'One variable changed, traffic split 50/50, success metric defined in advance.',
    },
    {
      t: 'STP',
      d: 'Segment the market, target the segments worth serving, position against competitors.',
    },
    { t: 'Perceptual map', d: 'A 2-axis picture of where brands sit in customers’ minds.' },
    { t: 'Brand equity', d: 'Value a brand name adds beyond the physical product.' },
    {
      t: 'Product life cycle',
      d: 'Introduction, growth, maturity, decline — each needs different tactics.',
    },
    { t: 'Value-based pricing', d: 'Price set from perceived customer value rather than cost.' },
    { t: 'Price elasticity', d: 'How much quantity responds to a price change.' },
    { t: 'Push vs. pull', d: 'Market to the channel vs. market to the end customer.' },
    {
      t: 'Channel levels',
      d: '0-level direct, 1-level via retailer, 2-level via wholesaler and retailer.',
    },
    {
      t: 'ROMI',
      d: 'Return on marketing investment — profit generated per dollar of marketing spend.',
    },
    { t: 'Capture rate', d: 'Store foot traffic ÷ total passers-by.' },
    { t: 'Customer value', d: 'Perceived benefit − price paid.' },
    { t: 'Margin of error', d: '≈ 1 ÷ √n, so n = 1,000 gives roughly ±3%.' },
  ],
};

/** The session map, straight from the syllabus. Red rows are the ones that cost points. */
export const BUS_SESSIONS: { date: string; topic: string; due: string; costly: boolean }[] = [
  { date: 'Aug 27', topic: 'Course introduction — Ch. 1–2', due: 'Group Assignment 1 handed out: ECOALF case', costly: false },
  { date: 'Sep 1', topic: 'Value & customer centricity — Ch. 4–5', due: 'SONA account due 5 PM', costly: true },
  { date: 'Sep 3', topic: 'Marketing research — Ch. 19', due: 'Group Assignment 1 due 11:59 PM · guest speaker', costly: true },
  { date: 'Sep 8', topic: 'Segmentation, targeting, positioning — Ch. 6, 7.1', due: 'Midterm case discussed: Opera Philadelphia', costly: false },
  { date: 'Sep 10', topic: 'Consumer behavior — Ch. 3', due: 'Read the Simply Good Jars case', costly: false },
  { date: 'Sep 15', topic: 'Behavioral economics — The End of Rational Economics', due: 'MIDTERM CASE WRITE-UP DUE 11:59 PM — 30%', costly: true },
  { date: 'Sep 17', topic: 'Digital marketing — Ch. 18', due: 'Group Assignment 2 in class · last day for SONA window 1', costly: true },
  { date: 'Sep 22', topic: 'Product — Ch. 10', due: 'Individual marketing research assignment released', costly: false },
  { date: 'Sep 24', topic: 'Branding — Ch. 11', due: 'Group Assignment 3 assigned · guest speaker', costly: false },
  { date: 'Sep 29', topic: 'Promotion & advertising — Ch. 15', due: 'Group Assignment 3 due 11:59 PM · SONA window 2 opens', costly: true },
  { date: 'Oct 1', topic: 'Pricing beyond cost — Ch. 12', due: 'Individual case due 11:59 PM · Group 4 handed out', costly: true },
  { date: 'Oct 6', topic: 'Distribution — Ch. 13', due: 'Group Assignment 4 in class', costly: true },
  { date: 'Oct 8', topic: 'Review', due: 'Last day of SONA window 2', costly: true },
  { date: 'Oct 13', topic: 'FINAL EXAM — 40 MC + 10 short answer', due: 'Extra-credit Starbucks plan also due 11:59 PM', costly: true },
];
