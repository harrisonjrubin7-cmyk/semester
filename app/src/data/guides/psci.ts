import type { Guide } from '../../lib/types';

/**
 * Ported from the "PSCI 1104 Field Guide" artifact — fourteen units, the seven
 * debates, the exam kit and the glossary. Mastery figures are the seeded values
 * from the design; everything else is the guide's own text.
 */
export const PSCI_GUIDE: Guide = {
  code: 'PSCI 1104',
  name: 'Understanding Political Controversy',
  blurb: 'Fourteen units, seven debates, one recurring exam question.',
  source: 'PSCI 1104 Field Guide — how to tell a real finding from a good story',
  mastery: 38,
  audio: false,
  units: [
    {
      name: '1 · Theory-driven research',
      mastery: 64,
      cards: [
        {
          q: 'What makes a hypothesis scientific?',
          a: 'It names two variables and a direction, and it could lose. If no possible evidence would prove you wrong, you are not doing science — “politics is complicated” is unfalsifiable.',
        },
        {
          q: 'Theory vs. hypothesis?',
          a: 'Theory is the general explanation of why X causes Y and must apply beyond your case. The hypothesis is one specific testable prediction that follows from it.',
        },
        {
          q: 'Empirical vs. normative claim?',
          a: 'Empirical = what is, settled by evidence. Normative = what ought to be, settled by values. “Turnout is 60%” vs. “turnout should be higher.”',
        },
        {
          q: 'Where does the pressure sit in the research loop?',
          a: 'Step 3 — can this prediction lose? — and step 4 — did you measure the thing you claim to measure? Almost every criticism in every assigned reading aims at one of those two boxes.',
        },
        {
          q: 'Fisman, Gelman & Stephenson — the four rules?',
          a: 'Trace a number to its original source, not whoever cited it. Watch for statistics laundering. A Harvard professor’s guess is not a “Harvard estimate.” Beware broken telephone — ranges collapse to points and caveats fall off.',
        },
        {
          q: 'The 80%-body-heat statistic — what went wrong?',
          a: 'It came from a 1950s military study where subjects wore Arctic suits covering everything but the head. The real figure is about 10%.',
        },
        {
          q: 'What is statistics laundering?',
          a: 'A shaky figure gets repeated by a respectable body, then everyone cites the respectable body. “Corruption costs $2.6 trillion” traces to a one-sentence bullet in an advocacy brief with no source — then the UN and OECD heads repeated it.',
        },
        {
          q: 'Why is taking the midpoint of a range dishonest?',
          a: '“Bribery costs $1 trillion a year” is the midpoint of a $600 billion–$1.7 trillion range. Collapsing it deletes the uncertainty, which was the most honest part of the estimate.',
        },
      ],
    },
    {
      name: '2 · Concepts and measurement',
      mastery: 42,
      cards: [
        {
          q: 'Conceptual vs. operational definition?',
          a: 'Conceptual says what you mean in words. Operational is the exact recipe — specific enough that a stranger would produce the same numbers.',
        },
        {
          q: 'Validity vs. reliability?',
          a: 'Validity: are you measuring the thing you claim? (a bias problem). Reliability: does the procedure repeat? (a consistency problem). Self-reported turnout is reliable and invalid.',
        },
        {
          q: 'Which box on the dartboard is dangerous?',
          a: 'Reliable but not valid — consistently wrong. More data never fixes a validity problem.',
        },
        {
          q: 'Which averages may you compute at each level?',
          a: 'Nominal: mode and percentages only. Ordinal: mode and median. Interval/ratio: mode, median, mean, SD. “The average religion” is nonsense, and ordinal gaps are not known quantities.',
        },
        {
          q: 'What is the unit of analysis?',
          a: 'What each row of your data is: a person, a county, a country, a bill, a résumé. Get it wrong and you are one step from the ecological fallacy.',
        },
        {
          q: 'Why is “no college degree” a bad operationalization of working class?',
          a: 'In 2004, 40% of white non-college voters had family incomes over $60,000 and over half called themselves middle class. Swap in income and Bartels’ answer flips sign.',
        },
        {
          q: 'How much had the income divide changed by 2020?',
          a: 'Ruffini: Clinton won the lowest earners by 31 points in 1996 while Dole won the highest by 16 — a 47-point spread — against roughly 8 points in 2020. It has nearly vanished.',
        },
      ],
    },
    {
      name: '3 · Describing a variable',
      mastery: 55,
      cards: [
        {
          q: 'Mean, median or mode — how do you choose?',
          a: 'Skew decides. Income is right-skewed, so the mean flatters and the median describes. The mean always sits toward the tail.',
        },
        {
          q: 'What is standard deviation, in words?',
          a: 'The typical distance of a case from the mean. Small SD = cases bunched together. Range is the cruder cousin, hostage to one weird case.',
        },
        {
          q: 'Define the ecological fallacy.',
          a: 'Inferring something about individuals from group-level data. Poor counties voted for Bush does not mean poor people did — the unit of analysis was the county.',
        },
        {
          q: 'Which two readings commit the ecological fallacy?',
          a: 'Frank’s red-state map, and Messerli’s chocolate study — which correlates national chocolate consumption with national Nobel counts and never observes a single laureate eating anything.',
        },
      ],
    },
    {
      name: '4 · Hypotheses and variables',
      mastery: 47,
      cards: [
        {
          q: 'What is the null hypothesis, and what can you do with it?',
          a: 'That there is no relationship between X and Y. It is what you actually test — you reject it or fail to reject it. You never accept it.',
        },
        {
          q: 'Antecedent vs. intervening variable?',
          a: 'Antecedent comes before X and causes both X and Y — spurious, claim dies. Intervening sits between X and Y and transmits the effect — claim survives, now explained.',
        },
        {
          q: 'The template for a good hypothesis?',
          a: '“As X increases, Y increases or decreases, across units of analysis.” Two variables, a direction, a unit, and a way to lose.',
        },
        {
          q: 'Give the template filled in.',
          a: 'As the perceived chance that neighbours will learn whether you voted increases, the probability of voting increases, across households.',
        },
        {
          q: 'Four ways students lose these points?',
          a: 'No variation in Y (“why do people vote?” studying only voters). A definition rather than a claim. A single case with nothing to compare. No stated direction.',
        },
        {
          q: 'What is a rival hypothesis?',
          a: 'A different explanation for the same pattern, usually built on a confounding variable.',
        },
      ],
    },
    {
      name: '5 · Causality — the four hurdles',
      mastery: 29,
      cards: [
        {
          q: 'Name the four hurdles, in order.',
          a: '1. Is there a credible causal mechanism? 2. Can we rule out that Y causes X? 3. Is there covariation? 4. Have we controlled for confounders Z? One confident no kills the claim.',
        },
        {
          q: 'Which hurdle do public arguments usually clear — and stop at?',
          a: 'Hurdle 3, covariation. Chocolate and Nobel prizes clears it and fails the other three.',
        },
        {
          q: 'Why does random assignment clear two hurdles at once?',
          a: 'The researcher sets X, so Y cannot have caused it (Hurdle 2), and randomization balances every confounder including unmeasured ones (Hurdle 4).',
        },
        {
          q: 'What does “X caused Y” mean, counterfactually?',
          a: 'Y would have been different had X been different, everything else held fixed.',
        },
        {
          q: 'State the fundamental problem of causal inference.',
          a: 'For any case you only ever observe one potential outcome — Y(1) or Y(0). The counterfactual is never seen, so every method is a scheme for constructing a believable stand-in.',
        },
        {
          q: 'What is the average treatment effect?',
          a: 'The average of Y(1) − Y(0) across cases. Effects differ person to person, so an ATE can be positive even where it is negative for some.',
        },
        {
          q: 'Can there be causation without correlation?',
          a: 'Yes — if the effect runs in opposite directions for different groups, or if people compensate for it, the net correlation can be zero.',
        },
        {
          q: 'Four things people get wrong about causes?',
          a: 'There is no such thing as “the” cause. A single counterexample does not refute a causal claim — causation here is about averages. Causes precede effects. And a mechanism is not strictly required for an effect to be real.',
        },
        {
          q: 'The three cases Kellstedt & Whitten run through the hurdles?',
          a: 'Life satisfaction and democratic stability (Hurdle 2 — which direction?). Race and political participation. Head Start (Hurdle 4 — families select in, so groups differ beforehand).',
        },
      ],
    },
    {
      name: '6 · Research design and validity',
      mastery: 36,
      cards: [
        {
          q: 'Random sampling vs. random assignment?',
          a: 'Sampling picks who is studied and buys external validity. Assignment decides who is treated and buys internal validity. Most studies have exactly one.',
        },
        {
          q: 'Name the threats to internal validity.',
          a: 'History, maturation, testing, instrumentation, regression to the mean, selection bias, attrition, demand/Hawthorne effects, diffusion. Selection bias is the biggest in observational work.',
        },
        {
          q: 'What does a posttest-only control group design avoid?',
          a: 'The testing effect — taking the pretest itself changes the posttest. The Solomon four-group design isolates that effect instead of dodging it.',
        },
        {
          q: 'Rank the design menu on internal validity.',
          a: 'Case study weakest, then cross-sectional survey, panel, quasi-experiment, field experiment, lab experiment strongest — with external validity running roughly the other way.',
        },
        {
          q: 'The two ways to get control?',
          a: 'By design — randomization or matching. Or by statistical adjustment — holding Z constant in the analysis. They are not equivalent, and Unit 8 is about why.',
        },
        {
          q: 'What is regression to the mean?',
          a: 'Extreme cases drift back toward average on their own. Target the worst schools and they improve regardless of what you did.',
        },
      ],
    },
    {
      name: '7 · Experiments',
      mastery: 44,
      cards: [
        {
          q: 'Gerber, Green & Larimer — the four treatments and their effects?',
          a: 'Civic Duty +1.8, Hawthorne +2.5, Self +4.9, Neighbors +8.1 against a 29.7% control, across 180,002 households. Turnout is driven by being seen, not by information.',
        },
        {
          q: 'Why four treatments instead of one?',
          a: 'To identify the mechanism. One mailer shows only that mail works; each escalating step adds one ingredient and the jump tells you what that ingredient is worth.',
        },
        {
          q: 'What did that experiment cost per vote?',
          a: '$1.93 per vote for Neighbors and $3.24 for Self, against roughly $20 door-to-door — and single mailings before this typically moved turnout under one point. It changed how American campaigns are run.',
        },
        {
          q: 'What is a balance table and why check it?',
          a: 'A comparison of the groups on background characteristics before treatment — the check that randomization worked. If a study skips it, ask why.',
        },
        {
          q: 'Bertrand & Mullainathan — the headline numbers?',
          a: '9.65% callback for white-sounding names vs. 6.45% for Black-sounding — a 3.2-point gap, 50% higher, worth about eight extra years of experience. ~5,000 résumés to 1,300+ ads, Boston and Chicago, 2001–02.',
        },
        {
          q: 'What is the interaction in Bertrand & Mullainathan?',
          a: 'Improving the résumé raised white callbacks by 2.29 points but Black callbacks by only 0.51, and not significantly. The gap widens as qualifications improve.',
        },
        {
          q: 'Why does randomly assigning the name solve the problem?',
          a: 'Employers see more about applicants than researchers do, so any observed gap could be something unmeasured. Assigning the name to an otherwise identical résumé removes that possibility entirely.',
        },
        {
          q: 'Answer “why is this an experiment?” in three moves.',
          a: 'The researcher manipulated X rather than observing it; assignment was random so groups were equivalent beforehand; outcomes were compared across groups and the difference is the effect. Then say which hurdles it clears.',
        },
        {
          q: 'The ethical objection to the social-pressure mailer?',
          a: 'It worked by shaming people using public records without consent, and generated hundreds of angry calls. A good answer names the effect and the cost.',
        },
      ],
    },
    {
      name: '8 · Controlling without an experiment',
      mastery: 33,
      cards: [
        {
          q: 'You control for Z and the relationship vanishes in every slice. Verdict?',
          a: 'Spurious — Z was causing both X and Y. If it holds in every slice, X survives. If it holds in one slice only, that is an interaction and X is conditional.',
        },
        {
          q: 'Bartels’ Kansas numbers, controlled for region?',
          a: '−5.9 points overall, −19.7 in the South, −1.0 outside it. Fifty-two years, one point. Frank’s thesis does not survive.',
        },
        {
          q: 'The permanent limit of statistical control?',
          a: 'You can only control for variables you measured and thought of. Randomization balances the ones you did not. That asymmetry is the standard critique of survey-based causal claims.',
        },
        {
          q: 'Leighley & Nagler — when should you not control?',
          a: '“Are poor people underrepresented among voters?” needs no controls, just shares. “Is a poor person less likely to vote than an otherwise identical richer person?” requires them. Same-looking questions, different methods.',
        },
        {
          q: 'What is a representativeness ratio?',
          a: 'A group’s share of actual voters ÷ its share of the citizen voting-age population. 1.0 is parity. The bottom income fifth sat at 0.79 in both 1972 and 2008.',
        },
        {
          q: 'Why relative measures rather than absolute ones?',
          a: 'Category meanings drift. College graduates went from 12.0% of adults in 1972 to 29.4% in 2008. In absolute categories the least-educated look like they collapsed (0.79 → 0.62); as the bottom third they barely moved (0.79 → 0.78).',
        },
        {
          q: 'Has turnout actually declined?',
          a: 'No — 58.4%–65.5% throughout, with no trend, once citizens are the denominator. The apparent decline is a denominator artifact: noncitizens grew from under 2% to 8.4% of the voting-age population.',
        },
        {
          q: 'What happened by age, and what is the counterfactual on 2008?',
          a: '18–24s are the lowest-turnout group every year at about 0.77. The 76–84 group went from 0.91 to 1.11. Had Black turnout stayed at its 1972 level, Obama’s vote share would have been about 1.2 points lower.',
        },
      ],
    },
    {
      name: '9 · Sampling',
      mastery: 40,
      cards: [
        {
          q: 'The margin-of-error rule of thumb?',
          a: '≈ 1 ÷ √n. A thousand people gets about ±3 points; halving that needs four times the sample — 4,000 for ±1.6.',
        },
        {
          q: 'Does population size affect margin of error?',
          a: 'No. 1,500 is as good for Nashville as for the United States, so long as the population is at least about 100× the sample.',
        },
        {
          q: 'What are the two parts of a confidence statement?',
          a: 'A margin of error and a confidence level. Reporting one without the other is incomplete.',
        },
        {
          q: 'Literary Digest 1936 — what killed it?',
          a: 'Coverage error (car registrations, phone books, magazine subscribers — affluent in 1936) plus voluntary response. Ten million ballots, 2.4 million returned, and Gallup beat them with a far smaller, better-designed sample.',
        },
        {
          q: 'Simple random sample — the exact wording?',
          a: 'Every set of n individuals has an equal chance of being the sample. “Every individual has an equal chance” is necessary but not sufficient.',
        },
        {
          q: 'Bias vs. variability?',
          a: 'Bias is consistently off target and is fixed only by better design. Variability is scatter and is fixed by a bigger sample. Same dartboard as validity vs. reliability.',
        },
        {
          q: 'Parameter vs. statistic?',
          a: 'Parameter is the true population number — fixed and unknown. Statistic is your sample’s number — known, and it varies sample to sample. Statistics estimate parameters.',
        },
      ],
    },
    {
      name: '10 · Why polls miss',
      mastery: 26,
      cards: [
        {
          q: 'What does the reported margin of error cover?',
          a: 'Random sampling error only — the smallest error in a poll. Coverage, nonresponse, measurement, wording, weighting and likely-voter modeling are all bigger and none shrink with sample size.',
        },
        {
          q: 'Cohn’s natural experiment — the result?',
          a: 'Four pollsters given identical raw interviews from one Florida poll (867 of them) produced answers spanning five points, Clinton +4 to Trump +1. All of it came from weighting and likely-voter judgment.',
        },
        {
          q: 'What did their implied electorates look like?',
          a: 'White share 65–70%, partisan balance from D+5 to R+1 — from the same interviews. Cohn: the reported margin of error “doesn’t even come close to capturing total survey error.”',
        },
        {
          q: 'Clinton’s 2024 version of the same point?',
          a: 'Sixteen defensible weighting schemes applied to one survey produced margins from Harris +3.8 to Harris +9.4.',
        },
        {
          q: 'Hillygus’s showcase failure?',
          a: 'Gallup 2000 — changes to the likely-voter model swung the reported margin 19 points in days, none of it real movement. She argues the likely-voter screen is often the most consequential choice a pollster makes.',
        },
        {
          q: 'The two canonical polling failures?',
          a: '1948, Dewey defeats Truman, where pollsters simply stopped polling weeks out. And New Hampshire 2008, where every poll had Obama winning and Clinton won.',
        },
        {
          q: 'Why doesn’t averaging polls fix everything?',
          a: 'Averaging cancels random noise, not house effects. If every pollster misses cell-only households the same way, the average is just as wrong.',
        },
        {
          q: 'How much work is weighting doing?',
          a: 'Only about 5 of every 100 contacted registered voters respond at all — so weighting is not a technical detail bolted on at the end, it is doing most of the work.',
        },
      ],
    },
    {
      name: '11 · Probability and the normal curve',
      mastery: 52,
      cards: [
        {
          q: 'The 68–95–99.7 rule?',
          a: 'About 68% of cases within one SD of the mean, 95% within two, 99.7% within three.',
        },
        {
          q: 'What is a z-score?',
          a: 'z = (value − mean) ÷ standard deviation. A z of 2 means two SDs above average — only about 2.5% of cases are higher.',
        },
        {
          q: 'What is a sampling distribution?',
          a: 'Not the distribution of your data — the distribution of a statistic across all the samples you could have drawn. It is normal and centered on the true parameter.',
        },
        {
          q: 'Standard error, in words?',
          a: 'The SD of the sampling distribution — how much your estimate would bounce from sample to sample. Bigger n, smaller standard error.',
        },
        {
          q: 'What does the central limit theorem buy you?',
          a: 'Sample means are normally distributed even when the underlying variable is not, provided n is decently large. That is why the normal curve is everywhere.',
        },
      ],
    },
    {
      name: '12 · Inference and significance',
      mastery: 31,
      cards: [
        {
          q: 'What does 95% confidence actually mean?',
          a: 'The method captures the true value 19 times in 20 across repeated sampling. It is not a 95% chance the truth is in this interval — the truth is fixed. Formula: estimate ± 1.96 × standard error.',
        },
        {
          q: 'Hypothesis testing in four steps?',
          a: 'State the null. Assume it true. Ask how likely a relationship this big is by sampling luck — that is p. If p < .05, reject the null. You never accept it.',
        },
        {
          q: 'Type I vs. Type II error?',
          a: 'Type I is a false positive — you announced something that is not there; p < .05 caps that risk at 5%. Type II is a false negative, usually from too small a sample.',
        },
        {
          q: 'Significant at p < .001 — is it important?',
          a: 'Unknown. With 300,000 cases a tenth of a point clears p < .05 and means nothing. Levitt’s capital-punishment estimate explains about 1.5% of the 1990s homicide decline: possibly real, definitely not the answer.',
        },
        {
          q: 'What does significance say about causality?',
          a: 'Nothing. A significant correlation still has to clear all four hurdles. This is the mistake that costs the most points.',
        },
      ],
    },
    {
      name: '13 · Correlation and regression',
      mastery: 35,
      cards: [
        {
          q: 'What do the sign and size of r tell you?',
          a: 'Sign is direction, size is strength, range −1 to +1. r = 0 means no straight-line relationship — a perfect U-shape has r near zero.',
        },
        {
          q: 'What is r²?',
          a: 'The share of variation in Y that X accounts for. Chocolate and Nobels: r = 0.79, so r² ≈ 0.62 — impressive-sounding and still not causal.',
        },
        {
          q: 'The sentence to write about a slope?',
          a: '“A one-unit increase in X is associated with a change of b units in Y” — holding the other variables constant, and never “causes” unless the design earns it.',
        },
        {
          q: 'How do you read a regression table?',
          a: 'Each row is a variable. The coefficient b gives direction and size; the standard error beside it gives precision; asterisks or a p-column give significance.',
        },
        {
          q: 'Quick significance check on a regression table?',
          a: 'If the coefficient is more than about twice its standard error, it is significant at p < .05.',
        },
      ],
    },
    {
      name: '14 · Small-N and selection bias',
      mastery: 22,
      cards: [
        {
          q: 'King, Keohane & Verba’s one rule?',
          a: 'Select cases on the independent variable. Never on the dependent variable. Never on both.',
        },
        {
          q: 'What does selecting on Y do to your estimate?',
          a: 'Biases it toward zero — keeping only high-Y cases cut an estimated slope from 0.68 to 0.32. Because the direction is known, a significant effect in a truncated sample means the true effect is at least that large.',
        },
        {
          q: 'Why is selecting on both X and Y worse?',
          a: 'The bias can run in any direction and you cannot know which. With selection on Y alone you at least know the sign.',
        },
        {
          q: 'You study twenty civil wars. What is the error?',
          a: 'No variation in Y — you never see the countries with the same conditions that stayed peaceful, so nothing distinguishes causes from constants. Same for only-successful-startups and only-school-shooters studies.',
        },
        {
          q: 'Why is selecting on X fine?',
          a: 'Deliberately picking cases with very different X actually increases your leverage. The only cost is that your findings apply to that range of X.',
        },
        {
          q: 'Which selection rules create the bias by accident?',
          a: 'Any rule correlated with Y — using only cases covered in newspapers, only “important” cases, only cases with available data, only organizations that survived long enough to study.',
        },
        {
          q: 'What can Venkatesh’s crack-gang books do, and not do?',
          a: 'Show a mechanism and kill a stereotype — foot soldiers earned below minimum wage while the leader took a large share. Not establish a general causal claim: one non-random case, no comparison group, no variation on the outcome.',
        },
        {
          q: 'Why is random selection risky with small N?',
          a: 'With six cases a random draw can easily be unrepresentative — which is why KKV recommend intentional selection on X for qualitative work.',
        },
      ],
    },
  ],
  frames: [
    {
      t: '1 · “Here is a claim from the news. Evaluate it.”',
      d: 'Run the four hurdles in order, yes/no/maybe with a reason. Name the specific confounder, not “other factors.” Finish with what evidence would settle it — usually an experiment that randomly assigned X — and why that is impossible here.',
    },
    {
      t: '2 · “Design a study to answer this.”',
      d: 'Hypothesis with a direction. Unit of analysis. Operational definitions defended against a validity objection. How X is assigned. Your control group as a credible counterfactual. Then the biggest remaining threat to internal validity.',
    },
    {
      t: '3 · “Why is this measure bad?”',
      d: 'Separate validity from reliability. Nobel prizes for cognitive function, “no college degree” for working class, self-reported turnout for turnout. Then say which direction the error runs — systematic error is far worse than noise.',
    },
    {
      t: '4 · “How much should you trust this poll?”',
      d: 'Sampling error is the smallest error present. Ask about the frame, the response rate, the weighting and the likely-voter screen. Cite Cohn’s five-point spread or Clinton’s sixteen weightings. Averaging does not fix house effects.',
    },
    {
      t: '5 · “Interpret this coefficient.”',
      d: 'Direction, size in real units, significance (coefficient > 2× its standard error). Then what it does not tell you. Add “holding the other variables constant.” Never write “causes” unless the design earns it.',
    },
  ],
  cases: [
    {
      title: 'What’s the matter with Kansas?',
      when: 'Lecture 5 · Sep 10',
      claim:
        'Thomas Frank: working-class whites vote against their economic interests because the GOP mobilizes them on culture. Evidence: the poorest county in America went for Bush by over 75%.',
      test: 'Bartels: 14 elections of ANES survey data, 1952–2004, with region and income controlled. Ruffini: the same question two decades later.',
      verdict:
        'Frank’s thesis does not survive. −5.9 points overall, −19.7 in the South, −1.0 outside it. By income, poor whites moved toward the Democrats (+4.5). Economic issues outweighed abortion by more than 2 to 1; in 2004 abortion ranked 13th of 15 issues for non-college whites.',
      lesson:
        'Operationalization decides the answer; ecological fallacy; controlling for a lurking variable (region).',
    },
    {
      title: 'Who receives public assistance?',
      when: 'Lecture 7 · Sep 17',
      claim:
        'Americans oppose welfare because of how they picture the poor — and the picture is racialized.',
      test: 'Gilens: content analysis. Code the racial composition of poor people shown in news-magazine photographs and network TV, then compare it to the actual composition of the poor in Census and CPS data.',
      verdict:
        'The media portrait is systematically unrepresentative of the real poverty population, and public misperception tracks the portrait rather than the data.',
      lesson:
        'Content analysis as a measurement strategy; comparing a measured perception against a measured reality.',
    },
    {
      title: 'Is stop-and-frisk racial profiling?',
      when: 'Lecture 9 · Sep 24',
      claim:
        'Bloomberg: stop rates should be benchmarked against the descriptions of criminal suspects, not against the population — so the racial disparity is not profiling.',
      test: 'Bertrand & Mullainathan: stop arguing about the right denominator. Randomly assign race — via the name — to otherwise identical résumés and mail 5,000 of them out.',
      verdict:
        '9.65% callback for white-sounding names vs. 6.45% for Black-sounding names. A 50% gap, worth about eight years of experience, and it widens as résumés improve.',
      lesson:
        'The whole fight in the op-ed is about choosing a comparison group. An experiment makes the comparison group by construction.',
    },
    {
      title: 'Does money buy votes?',
      when: 'Lecture 11 · Oct 1',
      claim: 'Contributions correlate with roll-call votes, therefore donors buy legislators.',
      test: 'Wright: donors give to legislators who already agree, so causation may run backwards. Hertel-Fernandez et al.: survey 101 senior Congressional staffers and test their beliefs about constituent opinion against MRP estimates from the CCES.',
      verdict:
        'Staffers misjudge their constituents badly and in a conservative direction — 91% underestimated support for gun background checks, 78% for CO₂ limits. A list experiment found 45% had changed their view after talking to a donor group. The channel is not buying votes; it is shaping what legislators believe voters want.',
      lesson:
        'Reverse causation (Hurdle 2); the list experiment as a way to ask an embarrassing question; the difference between an effect and its mechanism.',
    },
    {
      title: 'Who votes, and is it getting worse?',
      when: 'Lecture 14 · Oct 13',
      claim:
        'Turnout is falling and, as inequality grows, the electorate is getting richer relative to the country.',
      test: 'Leighley & Nagler: Current Population Survey data, 1972–2008, using representativeness ratios and relative measures — income quintiles and education thirds — rather than absolute categories.',
      verdict:
        'Both claims fail. Turnout ran 58.4%–65.5% with no trend; the “decline” is an artifact of counting noncitizens in the denominator. And income bias was identical in 1972 and 2008 — bottom-fifth ratio 0.79 both years.',
      lesson:
        'Denominators change conclusions; relative vs. absolute measures over time; when to control and when not to.',
    },
    {
      title: 'Are independents rising?',
      when: 'Lecture 20 · Nov 3',
      claim:
        'Kahn and Brooks: a record 40% of Americans call themselves independent — the largest and most decisive bloc in politics.',
      test: 'Keith et al.: push independents on which party they lean toward. Fowler et al.: model 280,000+ CCES respondents’ actual positions across 20+ policy questions instead of trusting a self-applied label.',
      verdict:
        'Most “independents” are closet partisans who lean and then vote that way; Abramowitz puts truly uncommitted voters under 10% of actual voters. Fowler et al. find ~73% well described by one left–right dimension, 21% genuinely idiosyncratic, and 6.5% answering inattentively — and the inattentive give more extreme answers than actual extremists.',
      lesson:
        'A self-reported label is not the concept; measurement error can masquerade as a real category.',
    },
    {
      title: 'Why did crime fall in the 1990s?',
      when: 'Lecture 25 · Nov 19',
      claim:
        'Gladwell: crime is an epidemic with a tipping point; broken-windows policing tipped New York.',
      test: 'Levitt: take the best-identified elasticity for each proposed cause and multiply by how much that factor actually changed. Sampson & Winter: follow a Chicago birth cohort for 18 years, triangulating OLS, matching and instrumental variables on childhood lead.',
      verdict:
        'Homicide fell 43% nationally — everywhere, not just New York. San Diego fell 72.8%, Austin 69.5%, San Jose 69.2% against New York’s 73.6%, and NYC hired police at three times the national rate. Levitt’s four factors explain about 36 of the 43 points; the ten largest newspapers mentioned innovative policing 52 times and legalized abortion — his second-largest factor — zero times.',
      lesson:
        'Effect-size accounting; a mechanism story is not a test; triangulating methods with different assumptions. Levitt’s closing puzzle: run the same accounting on 1973–1991 and crime should have fallen then. It did not.',
    },
  ],
  selfTest: [
    {
      q: 'Name the four hurdles, in order.',
      a: '1. Is there a credible causal mechanism connecting X to Y? 2. Can we rule out that Y causes X? 3. Is there covariation between X and Y? 4. Have we controlled for all confounding variables Z? One confident “no” defeats the claim.',
    },
    {
      q: 'What’s the difference between random sampling and random assignment?',
      a: 'Random sampling picks who is in your study — it buys external validity. Random assignment decides who gets the treatment — it buys internal validity. A national survey has the first and not the second; a lab experiment on 60 undergraduates has the second and not the first.',
    },
    {
      q: 'Why can’t you ever directly measure a causal effect?',
      a: 'The fundamental problem of causal inference: a causal effect is the difference between what happened and what would have happened, but for any case you only ever observe one of those. Every method is a scheme for constructing a believable stand-in for the counterfactual.',
    },
    {
      q: 'A study finds counties with more churches have more crime. What’s wrong?',
      a: 'Two things. Spuriousness: population size causes both — bigger counties have more of everything. And the ecological fallacy: even if the county correlation were real, it says nothing about whether churchgoers commit crimes.',
    },
    {
      q: 'A poll of 1,000 has a ±3 point margin of error. What is that number covering?',
      a: 'Random sampling error only. Nothing about coverage error, nonresponse (only ~5 in 100 contacted answer), response bias, question wording, weighting choices, or the likely-voter model — all usually larger, none shrinking with sample size.',
    },
    {
      q: 'Why is “no college degree” a bad operational definition of “working class”?',
      a: 'It does not capture the concept — 40% of white non-college voters in 2004 had family incomes over $60,000, and more than half called themselves middle class. It is a validity failure, and swapping in income flips Bartels’ answer.',
    },
    {
      q: 'You want to know what causes civil wars, so you study twenty civil wars. What’s the error?',
      a: 'Selecting on the dependent variable, with no variation in Y. Every case has the same outcome, so nothing distinguishes causes from constants. KKV: select on X, never on Y.',
    },
    {
      q: 'A result is significant at p < .001. Is it important?',
      a: 'Unknown. Significance answers “is this probably not zero?” — with a large enough n a trivial difference clears any threshold. Levitt’s capital-punishment estimate explains about 1.5% of the 1990s homicide decline.',
    },
    {
      q: 'What does a 95% confidence interval mean?',
      a: 'That the method captures the true value 95% of the time in repeated sampling. Not that there is a 95% chance the truth is inside this particular interval — the truth is fixed. Formula: estimate ± (1.96 × standard error).',
    },
    {
      q: 'Explain an antecedent variable versus an intervening variable.',
      a: 'An antecedent variable comes before X and causes both X and Y — spurious, claim dies. An intervening variable sits between X and Y and transmits the effect — claim survives, now explained. Same-looking diagram, opposite verdict.',
    },
    {
      q: 'In the Gerber, Green & Larimer experiment, why four treatments instead of one?',
      a: 'To identify the mechanism. Civic duty +1.8, being studied +2.5, your own record +4.9, your neighbours’ records +8.1 — the driver is not information or reminding, it is social surveillance. Each step adds one ingredient and the jump prices it.',
    },
    {
      q: 'You have a strong correlation, r = 0.79, p < .0001. Name three ways it could still be non-causal.',
      a: 'Reverse causation — Y causes X. Spuriousness — some Z causes both. Ecological fallacy — the correlation exists at the group level but not the individual level. Messerli’s chocolate-and-Nobel-prizes paper has all three at once.',
    },
  ],
  terms: [
    {
      t: 'Antecedent variable',
      d: 'Comes before X, causes both X and Y; source of spuriousness.',
    },
    { t: 'Attrition', d: 'Non-random dropout that makes groups non-comparable.' },
    { t: 'Bias', d: 'Systematic error in one direction; not fixed by more data.' },
    {
      t: 'Central limit theorem',
      d: 'Sample means are normally distributed even when the variable isn’t.',
    },
    {
      t: 'Confounding variable (Z)',
      d: 'Related to both X and Y; if uncontrolled, produces a misleading association.',
    },
    {
      t: 'Counterfactual',
      d: 'What would have happened to the same case under the other condition.',
    },
    { t: 'Covariation', d: 'X and Y move together. Hurdle 3, and the easy one.' },
    { t: 'Coverage error', d: 'The sampling frame leaves out part of the population.' },
    { t: 'Ecological fallacy', d: 'Inferring individual behaviour from group-level data.' },
    { t: 'External validity', d: 'Whether a finding generalizes beyond the study.' },
    { t: 'Falsifiability', d: 'The claim could in principle be shown wrong.' },
    {
      t: 'Fundamental problem of causal inference',
      d: 'Only one potential outcome is ever observed per case.',
    },
    {
      t: 'Internal validity',
      d: 'Whether the relationship inside the study is really causal.',
    },
    {
      t: 'Intervening variable',
      d: 'Sits between X and Y and transmits the effect; explains rather than refutes.',
    },
    { t: 'Margin of error', d: 'The random sampling error only; ≈ 1/√n for 95% confidence.' },
    {
      t: 'Null hypothesis',
      d: 'The claim of no relationship; what a significance test actually evaluates.',
    },
    { t: 'Operational definition', d: 'The exact procedure used to measure a concept.' },
    { t: 'p-value', d: 'Probability of a result this extreme if the null were true.' },
    {
      t: 'Parameter vs. statistic',
      d: 'The population’s true value vs. your sample’s estimate of it.',
    },
    { t: 'Random assignment', d: 'Chance decides who is treated; buys internal validity.' },
    { t: 'Random sampling', d: 'Chance decides who is studied; buys external validity.' },
    {
      t: 'Regression coefficient (b)',
      d: 'Predicted change in Y per one-unit increase in X, holding other variables constant.',
    },
    {
      t: 'Regression to the mean',
      d: 'Extreme cases drift back toward average on their own.',
    },
    { t: 'Reliability', d: 'The same procedure gives the same result each time.' },
    {
      t: 'Representativeness ratio',
      d: 'Group’s share of voters ÷ share of eligible population; 1.0 is parity.',
    },
    {
      t: 'Sampling distribution',
      d: 'The distribution of a statistic across all possible samples.',
    },
    {
      t: 'Selection bias',
      d: 'The groups differed before any treatment; the top threat in observational work.',
    },
    { t: 'Spurious relationship', d: 'X and Y covary only because Z causes both.' },
    {
      t: 'Standard error',
      d: 'The standard deviation of a sampling distribution; how much an estimate bounces.',
    },
    {
      t: 'Statistical significance',
      d: 'The result is unlikely under the null; says nothing about size or cause.',
    },
    { t: 'Type I / Type II error', d: 'False positive / false negative.' },
    { t: 'Validity', d: 'You are measuring the thing you claim to measure.' },
    {
      t: 'Voluntary response sample',
      d: 'Respondents select themselves in; systematically biased.',
    },
    {
      t: 'Weighting',
      d: 'Adjusting a sample to match an assumed population; a judgment call, not a fix.',
    },
  ],
};
