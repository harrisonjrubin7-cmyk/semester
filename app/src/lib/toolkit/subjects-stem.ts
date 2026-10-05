import { analyse, draw, equations, labReport, matrix, planned, restricted, sheet, solve, type Subject } from './tools';

/**
 * Mathematics, the sciences, computing and engineering.
 *
 * The science boundary applies to every lab tool here, and the DNA lab and
 * the security sandbox are `restricted`: listed, never openable until a
 * reviewed implementation exists. See docs/ai-toolkit/SCIENCE-AND-DNA-LEARNING-SAFETY.md.
 */
export const STEM: readonly Subject[] = [
  { id: 'math', name: 'Mathematics', family: 'STEM', prefixes: ['MATH'], tools: [equations, solve, planned('proof-templates', 'Proof templates', 'Structure a proof and its logic'), planned('calculus-visualizer', 'Calculus visualizer', 'Limits, derivatives and integrals drawn')] },
  { id: 'stats', name: 'Statistics', family: 'STEM', prefixes: ['STAT', 'BIOS'], tools: [analyse, sheet, equations, planned('probability-simulator', 'Probability simulator', 'Sampling and distributions by simulation')] },
  { id: 'bio', name: 'Biology', family: 'STEM', prefixes: ['BSCI', 'BIOL', 'MBIO'], tools: [labReport, analyse, draw, restricted('dna-lab', 'DNA Learning Lab', 'Transcription, translation, mutation and gel-band exercises on instructor-provided sequences', 'science')] },
  { id: 'chem', name: 'Chemistry', family: 'STEM', prefixes: ['CHEM'], tools: [labReport, equations, planned('reaction-balancer', 'Reaction balancer', 'Balance equations and check stoichiometry', 'science')] },
  { id: 'physics', name: 'Physics', family: 'STEM', prefixes: ['PHYS', 'ASTR'], tools: [labReport, equations, analyse, planned('circuit-sim', 'Mechanics and circuit simulators', 'Forces, circuits and waves by simulation', 'science')] },
  { id: 'cs', name: 'Computer science', family: 'STEM', prefixes: ['CS', 'CSE', 'COMP'], tools: [draw, planned('code-studio', 'Code Studio', 'Write and test your own code — needs a reviewed sandbox before it can run anything'), restricted('security-sandbox', 'Defensive security sandbox', 'Isolated defensive exercises', 'cyber')] },
  { id: 'data-science', name: 'Data science', family: 'STEM', prefixes: ['DS', 'DSCI'], tools: [analyse, sheet, matrix] },
  { id: 'engineering', name: 'Engineering', family: 'STEM', prefixes: ['ENGR', 'ME', 'EECE', 'CE', 'BME', 'CHBE', 'ES'], tools: [equations, labReport, planned('assumption-checklist', 'Units and assumptions checklist', 'Units, assumptions and safety factors written down', 'engineering')] },
];
