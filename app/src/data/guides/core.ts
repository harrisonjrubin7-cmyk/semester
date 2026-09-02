import type { Guide } from '../../lib/types';

/**
 * Ported from the "Sport, Culture & Society Field Guide" artifact — weeks 1–4 in
 * full, the five big ideas, the terms and the ten-question self-quiz.
 */
export const CORE_GUIDE: Guide = {
  code: 'CORE 2500',
  name: 'Sports, Culture, and Society',
  blurb: 'Weeks 1–4 in full, plus the map of where the semester goes.',
  source: 'Sport, Culture & Society Field Guide · Torres Colón, Fall 2026',
  mastery: 49,
  audio: true,
  units: [
    {
      name: '1 · How the grade actually works',
      mastery: 70,
      cards: [
        {
          q: 'What is the single biggest risk to your grade?',
          a: 'Attendance. After two unexcused absences you lose 10% of the final grade for every additional class — bigger than any quiz.',
        },
        {
          q: 'What do quizzes actually test?',
          a: 'The main argument of the readings due that day, plus the lecture slides from the class before.',
        },
        {
          q: 'What are the three ways people lose this grade?',
          a: 'Attendance. Deadlines — everything is due before class begins, a missed quiz is a 0 with no make-up, late reflections drop a letter grade per day. And not checking email.',
        },
        {
          q: 'What is the recoverable part?',
          a: 'Lost quiz points can be made up with extra credit later, and reflections are self-graded. Blatantly gaming the self-assessment is treated as cheating.',
        },
        {
          q: 'What is not on the syllabus but still required?',
          a: 'Media and current-events assignments — announced by email and Brightspace only.',
        },
        {
          q: 'What is the grade actually built from?',
          a: '8 quizzes at 10 pts, 13 reflections at 10 pts, one final reflection at 20 pts (“Ultrarealism and Human Flourishment”), plus attendance. No exams.',
        },
      ],
    },
    {
      name: '2 · The five big ideas',
      mastery: 58,
      cards: [
        {
          q: 'Define embodiment.',
          a: 'The body is not just biology — it is biology shaped by culture, history and practice, and experienced from the inside. A jump shot, a limp, a fear of the pool.',
        },
        {
          q: 'What does a biocultural approach refuse to ask?',
          a: 'Nature vs. nurture. The right question is always how genes and environment work together here, and how much each contributes.',
        },
        {
          q: 'Play → ritual → sport, in one line?',
          a: 'Sport is not an invention of civilization — it grows out of play, which is older than humans, and carries ritual meaning. Mayan ball courts were temples.',
        },
        {
          q: 'Why is race a social fact rather than a biological unit?',
          a: 'Genetic variation is real; races as discrete biological groups are not. Africa holds most human genetic diversity, which is exactly why “Black athletic gene” stories collapse.',
        },
        {
          q: 'The fifth big idea?',
          a: 'Sport reflects and reproduces power. Gender, race, class and nation are made visible in sport — and made harder to challenge by it. Sport can “enrich or stifle,” “oppress or liberate.”',
        },
        {
          q: 'What are the two course capacities?',
          a: '(B) Systematic and structural thinking — seeing sport inside larger systems. (C) Cultural and interpretative investigation — reading difference as meaning, not fact.',
        },
        {
          q: 'How does the semester move?',
          a: 'Outward: bodies and evolution → social difference and power → how anthropologists actually study sport → character and virtue. Knowing which move you are in tells you what a question is really asking.',
        },
      ],
    },
    {
      name: '3 · Fox & Konner — why we play',
      mastery: 52,
      cards: [
        {
          q: 'Fox’s argument in one line?',
          a: 'Play looks pointless, costs real energy and can get you killed — which means evolution kept it for a reason: it builds brains, bodies and the ability to agree on rules.',
        },
        {
          q: 'Stuart Brown’s seven characteristics of play?',
          a: 'Voluntary, inherently attractive, free of time, diminished self-consciousness, improvisational, continuation desire, apparently purposeless.',
        },
        {
          q: 'How do the classic theorists define play?',
          a: 'Carl Diem: “purposeless activity, for its own sake.” Huizinga: “not serious.” Roger Caillois: “an occasion of pure waste” — then spent 200 pages on it. Konner calls it “a central paradox of evolutionary biology.”',
        },
        {
          q: 'The cost side of the paradox — two facts.',
          a: 'Young mammals burn up to 15% of their calories playing, and in Peru in 1988, 22 of 26 sea pups killed by sea lions were playing in tidal pools and never saw the attack.',
        },
        {
          q: 'The payoff side — two facts.',
          a: 'Rats allowed to play developed higher BDNF in the amygdala and prefrontal cortex; across 15 mammal species bigger relative brain size tracked with more play (Pellis).',
        },
        {
          q: 'The dolphin study — three things to remember.',
          a: 'Over five years, 16 captive dolphins initiated play with balls more than with any other object, bubbles or each other. Free play with Fox became a rule-governed interspecies game in ten minutes. Piaget’s “moderately discrepant events”: players keep making it slightly harder.',
        },
        {
          q: 'What is the EQ comparison?',
          a: 'Encephalization quotient: humans 7.0, dolphins ~4.5, great apes 1.5–3. More brain, more play.',
        },
        {
          q: 'Konner’s categories, by players and object?',
          a: 'Solitary locomotor-rotational, object play, social play — plus serious, master, rough-and-tumble and adult play by character. The slides frame play as “behavioral fat.”',
        },
        {
          q: 'The throwing hypothesis?',
          a: 'Calvin: accurate one-armed throwing may have driven lateralization to the left brain — the hemisphere handling the rapid muscle sequencing language needs. Throwing gave an immediate return, unlike fire or tools. Speculative; state it, don’t defend it.',
        },
        {
          q: 'Two numbers on the play deficit?',
          a: 'Children spend 50% less time playing outdoors than in the 1970s, and 10–16 year-olds average 12.6 minutes a day of vigorous activity.',
        },
        {
          q: 'Why does it matter that hunter-gatherers had leisure?',
          a: 'Richard Lee among the !Kung: women could gather three days’ food in one day; Sahlins said hunters “keep bankers’ hours.” So play is not an invention of civilization.',
        },
        {
          q: 'Name some historical ball games.',
          a: 'Aboriginal marn grook; Copper Inuit akraurak (the aurora is arsarnerit, “the football players”); Afghan buzkashi; Greek episkyros and ephedrismos; Roman harpastum. Galen wrote the first scientific case for ball play and praised it as a leveler: “even the poorest man can play ball.”',
        },
      ],
    },
    {
      name: '4 · Ocobock & Lacy — Woman the Hunter',
      mastery: 44,
      cards: [
        {
          q: 'Their argument in one line?',
          a: '“Man the Hunter” survives because science only studied the traits where males have the advantage; measured on endurance, female physiology looks at least as well built for hunting.',
        },
        {
          q: 'What is the story being argued against?',
          a: 'The 1966 symposium and 1968 volume Man the Hunter (Lee & DeVore) made hunting the engine of human evolution and gave it to men. Laughlin: “Man’s life as a hunter supplied all the other ingredients for achieving civilization.”',
        },
        {
          q: 'Zihlman’s line to memorize?',
          a: 'Pictures of the past are “backward projections of modern cultural sex stereotypes” onto people who lived a million years ago.',
        },
        {
          q: 'Why was “Woman the Gatherer” only half a fix?',
          a: 'Slocum (1975) and Dahlberg (1981) answered back, but still handed hunting to men. Hrdy’s The Woman That Never Evolved went further.',
        },
        {
          q: 'The data gap — the three numbers.',
          a: '34% of participants in sport and exercise science research are female, 14% in nutritional-supplement research, and 3% of athletic-performance publications are female-only against 63% male-only.',
        },
        {
          q: 'What must you say about variation?',
          a: 'There is more variation within sexes than between them, every metric overlaps, and sex — like gender — is not a strict binary.',
        },
        {
          q: 'Name three physiological reasons females may suit endurance.',
          a: '70% greater fatty-acid oxidation from estrogen; adiponectin up to 65% higher; intramuscular fat 58 vs. 23 g/kg; more Type I fibers; 20–35% better load-carrying economy; less exercise-induced muscle damage.',
        },
        {
          q: 'The killer distance evidence?',
          a: 'Women and men perform similarly at 42 km and women outperform men beyond 90 km; one model predicts female advantage from 65 km up. Persistence hunting is 17–33 km of endurance, not speed — and Bramble & Lieberman’s founding paper never mentions sex.',
        },
        {
          q: 'The pacing and ethnographic evidence?',
          a: 'Across 190,000+ runners at the Bolder Boulder 10K, women were 1.96× more likely to hold pace at halfway. The Agta of the Philippines hunted with dogs and bows into late pregnancy; also Inuit, Tiwi, Ojibwa.',
        },
        {
          q: 'The elegant twist at the end?',
          a: 'Pregnancy and lactation cost 500–600 kcal a day. Motherhood is a multi-year endurance event — so it may be what selected for female endurance rather than a handicap that ruled women out of hunting. Sophie Power ran the 168 km UTMB while breastfeeding a three-month-old.',
        },
      ],
    },
    {
      name: '5 · Epstein 1–3 — hardware & software',
      mastery: 47,
      cards: [
        {
          q: 'Epstein’s argument in one line?',
          a: 'Elite skill is not fast reflexes and it is not 10,000 hours — it is learned pattern-recognition (“software”) running on physical equipment that varies a lot between people (“hardware”).',
        },
        {
          q: 'Why couldn’t Pujols hit Jennie Finch?',
          a: 'He had no chunks for her delivery. A 68 mph underhand pitch from 43 feet arrives like a 95 mph fastball; reaction time is ~200 ms for everyone, the pitch takes 400 ms and the contact window is 5 ms, so he had to commit before the ball was halfway. His own reaction time was 66th percentile against college students.',
        },
        {
          q: 'What did the random-chessboard experiment prove?',
          a: 'Masters’ advantage is learned pattern recognition, not innate memory. De Groot’s masters rebuilt real boards from a 3-second glance; on arrangements that could never occur in a game their recall dropped to average (Chase & Simon, 1973).',
        },
        {
          q: 'What did Starkes and Abernethy add?',
          a: 'Occlusion tests showed the same in volleyball and field hockey — and hiding a badminton player’s forearm turns an elite player into a near-novice. Expertise is reading the body, not seeing the ball.',
        },
        {
          q: 'Strongest evidence against the 10,000-hours rule?',
          a: 'Campitelli & Gobet: chess master level took 3,000 to 23,000 hours, and some players logged 25,000+ without ever making master. Elite basketball, field hockey and wrestling athletes average closer to 4,000/4,000/6,000 sport-specific hours.',
        },
        {
          q: 'The quiz trap on Ericsson.',
          a: 'K. Anders Ericsson never used the phrase “10,000-hours rule.” He credits it to a chapter title in Gladwell’s Outliers, which he says “misconstrued” the violin study — a cross-sectional, retrospective study of 10 pre-screened students.',
        },
        {
          q: 'Holm vs. Thomas — what is the point?',
          a: 'Holm jumped for twenty years with an Achilles so stiff it took 1.8 tons to stretch it 1 cm. Thomas cleared 7’3.25” on his seventh jump ever with a 10¼-inch Achilles and beat Holm after eight months — and has not improved since. Hardware and software, both real.',
        },
        {
          q: 'What is talent transfer?',
          a: 'Moving a good general athlete into a better-suited sport — the Australian Institute of Sport turned surf-lifesaving and water-skiing athletes into Olympic skeleton racers in 14 months. Danish research found late specialization worked better in centimeter/gram/second sports.',
        },
      ],
    },
    {
      name: '6 · Epstein 9–11 — the (un)science of race',
      mastery: 35,
      cards: [
        {
          q: 'The argument in one line?',
          a: 'Genetic variation is real and mostly inside Africa — which is exactly why “Black people are built to sprint” is bad genetics, even though specific traits with specific histories do cluster in specific populations.',
        },
        {
          q: 'What did Kenneth Kidd find?',
          a: 'Every stretch of the genome he looked at had more variation in African populations. On one stretch, a single population of African Pygmies had more variation than the entire rest of the world combined. His line: “from a genetic point of view, all Europeans look alike.”',
        },
        {
          q: 'Why might the fastest and the slowest human both be African?',
          a: 'African populations hold the greatest genetic diversity, so for any genetically influenced trait the extremes at both ends should be overrepresented. Sport only ever measures one tail.',
        },
        {
          q: 'The nuance you must hold onto.',
          a: 'Humans are 99–99.5% identical at the DNA level, but at least 15 million letters differ. Self-identified race matched blind DNA identification in 3,631 of 3,636 Americans — yet with every world population included the picture is a continuous spectrum, not discrete groups.',
        },
        {
          q: 'How does within- vs. between-group variation depend on the trait?',
          a: '~90% of skull-shape variation is within groups; ~90% of skin-color variation is between them. And African Americans range from 1% to 99% West African ancestry (Tishkoff).',
        },
        {
          q: 'What does ACTN3 actually tell you?',
          a: 'Mostly who will not run an Olympic 100 m final. About 25% of East Asians and 18% of white Australians are XX, under 1% of Zulu; of 32 Australian Olympic sprinters, zero were XX. Foster: “the best genetic test right now is a stopwatch.”',
        },
        {
          q: 'How was ACTN3 discovered?',
          a: 'Kathryn North was drafting a letter to Nature Genetics announcing a new muscular dystrophy gene — then tested the healthy family members and found the same variant. Her own caution: it “contributes a little,” there may be hundreds of genes, and diet, environment and opportunity all matter.',
        },
        {
          q: 'Pitsiladis vs. Morrison & Cooper?',
          a: 'Pitsiladis: environment and a talent-spotting system — Champs since 1910, 100 schools, a 35,000-seat stadium, boosters like Charles Fuller recruiting Sherone Simpson; Bolt and Blake both wanted to play cricket. Morrison & Cooper: malaria-driven history via sickle-cell and low hemoglobin.',
        },
        {
          q: 'What is the weak spot in each?',
          a: 'Pitsiladis does not explain why finalists are so consistently of West African descent. Morrison & Cooper’s final step — hemoglobin → fiber type — has never been tested in humans; only one mouse study and one rat study.',
        },
        {
          q: 'What undercuts the “Maroon warrior” theory?',
          a: 'Maroons are not genetically distinguishable from other Jamaicans, and one of Pitsiladis’s grad students had more sprint gene variants than “the likes of a Usain Bolt.” His advice to British runners: “Go into sprinting. Don’t worry because you’re white.”',
        },
        {
          q: 'What is genuinely established (Ch. 11)?',
          a: 'Allen’s and Bergmann’s rules on limb length and build at low latitudes; max speed scales with the square root of leg length; sickle-cell trait protects against malaria (Allison, 1954) and all but disappears above 800 m, while being overrepresented in jumps and throws.',
        },
        {
          q: 'Cooper’s most important point?',
          a: 'The belief that physical superiority implies intellectual inferiority “only developed when physical superiority became associated with African Americans,” around 1936. A result of bigotry, not a cause of it — and the answer is more careful inquiry, not less.',
        },
      ],
    },
  ],
  frames: [
    {
      t: 'Write the one-sentence thesis',
      d: 'For every reading due. If you cannot, you are not ready for the quiz. The “argument in one line” boxes are the model.',
    },
    {
      t: 'Name the evidence',
      d: 'Quizzes are objective questions — they reward the study, the place, the number, the person.',
    },
    {
      t: 'Re-read the previous class’s slides',
      d: 'One concept per slide — the syllabus says quizzes draw on them explicitly.',
    },
    {
      t: 'Say the counter-argument out loud',
      d: 'Nearly every reading argues against a popular story: Man the Hunter, the 10,000-hours rule, race as biology.',
    },
    {
      t: 'Reflections: the four-move template',
      d: 'Name the concept precisely with its author — not “sports build character” but “Konner’s category of social play.” Attach one piece of evidence from the text. Bring one thing from your own life or this week’s sports news. Then say what it costs you.',
    },
  ],
  selfTest: [
    {
      q: 'Why couldn’t Albert Pujols hit Jennie Finch?',
      a: 'He had no mental database of her body movements, pitch tendencies or softball spin — no chunks to read. Since a hitter must commit before the ball is halfway, he was left reacting, and raw reaction time (66th percentile) isn’t enough.',
    },
    {
      q: 'What did the random-chessboard experiment prove?',
      a: 'That masters’ memory advantage is learned pattern recognition, not superior innate memory. On arrangements that could never occur in a real game, their recall dropped to average.',
    },
    {
      q: 'State the strongest evidence against a strict 10,000-hours rule.',
      a: 'Campitelli & Gobet: master level took anywhere from 3,000 to 23,000 hours; some logged 25,000+ and never made master. Elite athletes in basketball, field hockey and wrestling average closer to 4,000/4,000/6,000 sport-specific hours.',
    },
    {
      q: 'Name three physiological reasons females may be suited to endurance.',
      a: 'Any three of: 70% greater fatty-acid oxidation; adiponectin up to 65% higher; more intramuscular fat (58 vs. 23 g/kg); more Type I fibers; 20–35% better load-carrying economy; less exercise-induced muscle damage; more consistent pacing.',
    },
    {
      q: 'What is wrong with Man the Hunter, according to Slocum?',
      a: '“A theory that leaves out half the human species is unbalanced” — and because the fossil data are so scant, bias fills the gaps with just-so stories.',
    },
    {
      q: 'Why does Kidd say the fastest and the slowest human might both be African?',
      a: 'Because African populations hold the greatest genetic diversity, so for any genetically influenced trait the extremes at both ends should be overrepresented there. Sport only ever measures one end.',
    },
    {
      q: 'What does ACTN3 actually tell you?',
      a: 'Mostly who won’t run an Olympic 100 m final — the XX genotype is essentially absent among elite sprinters. It rules out roughly 1 in 7 people worldwide and almost no one of African descent. Foster: use a stopwatch.',
    },
    {
      q: 'Give the environmental explanation for Jamaican sprinting.',
      a: 'Every child sprints at school sports day; adult enthusiasts recruit fast kids into track high schools; Champs gives them a 35,000-seat proving ground and scholarships; pro clubs like MVP keep them on the island. Talent stays in the sprint pipeline instead of leaking into football as it does in the US.',
    },
    {
      q: 'What makes the Cooper & Morrison malaria hypothesis only a hypothesis?',
      a: 'The malaria → sickle-cell and malaria → low-hemoglobin links are established. The final step — that low hemoglobin drove a shift toward fast-twitch fibers — has been shown only in one mouse and one rat study, and never tested in humans.',
    },
    {
      q: 'How does Fox answer his son’s question, “why do we play ball?”',
      a: 'Because play is brain food and balls are the richest kind — kinetically interesting, socially binding objects that build motor skill, cognitive flexibility and the shared rules that make cooperation possible. It’s older than civilization, not a product of it.',
    },
  ],
  terms: [
    { t: 'Embodiment', d: 'Biology, culture and lived experience intertwined in a body.' },
    {
      t: 'Biocultural approach',
      d: 'Studying how biology and culture jointly produce a trait or practice.',
    },
    {
      t: 'Chunking',
      d: 'Grouping information into meaningful patterns; the basis of expertise (Chase & Simon).',
    },
    {
      t: 'Occlusion test',
      d: 'Cutting off visual information early to measure anticipation (Starkes, Abernethy).',
    },
    {
      t: 'Deliberate practice',
      d: 'Effortful, cognitively engaged, error-correcting practice — usually solitary.',
    },
    {
      t: 'Matthew effect',
      d: 'The already-better improve faster on the same training (Thorndike).',
    },
    {
      t: 'Talent transfer',
      d: 'Moving a good general athlete into a better-suited sport (Australia’s skeleton project).',
    },
    {
      t: 'Persistence hunting',
      d: 'Running prey to exhaustion over 17–33 km — endurance, not speed.',
    },
    {
      t: 'Sexual division of labor',
      d: 'The assignment of tasks by sex — assumed deep and biological; Ocobock & Lacy dispute that.',
    },
    { t: 'Type I / IIa / IIx fibers', d: 'Slow-aerobic / fast-oxidative / fast-glycolytic muscle.' },
    { t: 'Genotype vs. phenotype', d: 'The genetic code vs. its physical expression.' },
    { t: 'Genetic drift', d: 'Change in variant frequency by chance, not selection.' },
    {
      t: 'Recent African origin',
      d: 'All non-Africans descend from one small group that left Africa ~90,000 years ago.',
    },
    { t: 'Homo ludens', d: 'Huizinga’s “Man the Player,” proposed alongside Homo sapiens.' },
  ],
};

/** Reflection prompts already scheduled, from the syllabus. */
export const CORE_REFLECTION_PROMPTS = [
  '#1 Should play be more serious?',
  '#2 Are elite athletes super-humans?',
  '#3 How do sports reflect cultural norms?',
  '#4 Sports and the virtue of transcendence',
  '#5 Responsibility for structural inequality',
  '#7 What is caring?',
  '#9 Care, accepting, embracing',
  '#10 Addressing reality',
  '#11 Inspiration',
  '#12 Perspective, kindness, fairness',
  '#13 Humility in sports talk',
  'Final: Ultrarealism and human flourishment',
];

/** The VIA 24 character strengths, grouped by virtue — the vocabulary reflections want. */
export const VIA_STRENGTHS: { virtue: string; strengths: string[] }[] = [
  { virtue: 'Wisdom', strengths: ['Creativity', 'Curiosity', 'Judgment', 'Love of learning', 'Perspective'] },
  { virtue: 'Courage', strengths: ['Bravery', 'Perseverance', 'Honesty', 'Zest'] },
  { virtue: 'Humanity', strengths: ['Love', 'Kindness', 'Social intelligence'] },
  { virtue: 'Justice', strengths: ['Teamwork', 'Fairness', 'Leadership'] },
  { virtue: 'Temperance', strengths: ['Forgiveness', 'Humility', 'Prudence', 'Self-regulation'] },
  {
    virtue: 'Transcendence',
    strengths: ['Appreciation of beauty', 'Gratitude', 'Hope', 'Humor', 'Spirituality'],
  },
];
