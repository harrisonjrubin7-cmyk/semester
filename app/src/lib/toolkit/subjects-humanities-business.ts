import { caseAnalysis, draw, equations, analyse, labReport, matrix, planned, policyMemo, sheet, t, type Subject } from './tools';

/**
 * Humanities, languages, the social sciences, business, education,
 * communication, policy, law, and the arts and media.
 *
 * Legal and finance tools carry their boundary — educational practice, never
 * advice about a real matter — and the arts tools carry the copyright one.
 * See docs/ai-toolkit/CLINICAL-LEGAL-FINANCIAL-BOUNDARIES.md.
 */
export const HUMANITIES_BUSINESS: readonly Subject[] = [
  { id: 'english', name: 'English and writing', family: 'Humanities & languages', prefixes: ['ENGL', 'WRIT'], tools: [t('essay-workflow', 'Essay workflow', 'Claim, evidence plan, outline, draft, revision', 'guided', { opens: 'assignment' }), matrix] },
  { id: 'history', name: 'History', family: 'Humanities & languages', prefixes: ['HIST'], tools: [matrix, draw, planned('primary-source', 'Primary-source analyzer', 'Author, audience, purpose and context of a source')] },
  { id: 'philosophy', name: 'Philosophy', family: 'Humanities & languages', prefixes: ['PHIL'], tools: [draw, planned('argument-map', 'Argument reconstruction', 'Premises, conclusion and the gaps between')] },
  { id: 'languages', name: 'Languages', family: 'Humanities & languages', prefixes: ['SPAN', 'FREN', 'GER', 'ITA', 'CHIN', 'JAPN', 'ARA', 'RUSS', 'PORT', 'LAT'], tools: [planned('translation-compare', 'Translation comparison', 'Alternatives explained, not one "correct" answer')] },
  { id: 'religion', name: 'Religious studies', family: 'Humanities & languages', prefixes: ['RLST', 'JS'], tools: [matrix, draw] },
  { id: 'psychology', name: 'Psychology', family: 'Social sciences & business', prefixes: ['PSY', 'PSYC'], tools: [analyse, matrix, labReport] },
  { id: 'sociology', name: 'Sociology', family: 'Social sciences & business', prefixes: ['SOC'], tools: [analyse, matrix, planned('qual-coding', 'Qualitative coding lab', 'Codebook, segments and memos with a rationale for each code')] },
  { id: 'poli-sci', name: 'Political science', family: 'Social sciences & business', prefixes: ['PSCI', 'POLS'], tools: [policyMemo, matrix, draw] },
  { id: 'economics', name: 'Economics', family: 'Social sciences & business', prefixes: ['ECON'], tools: [analyse, equations, sheet, policyMemo, planned('supply-demand', 'Supply and demand simulator', 'Shift curves and read the new equilibrium')] },
  { id: 'anthropology', name: 'Anthropology', family: 'Social sciences & business', prefixes: ['ANTH'], tools: [matrix, planned('field-notes', 'Field-note organizer', 'Notes, consent status and coding', 'location')] },
  { id: 'business', name: 'Business and management', family: 'Social sciences & business', prefixes: ['MGT', 'BUS', 'BUSA', 'OWEN', 'MKTG'], tools: [caseAnalysis, sheet, draw] },
  { id: 'finance', name: 'Finance and accounting', family: 'Social sciences & business', prefixes: ['FIN', 'ACCT'], tools: [sheet, t('finance-models', 'Time value and ratio models', 'Worked finance formulas on example figures', 'native', { screen: 'equations', boundary: 'finance' })] },
  { id: 'education', name: 'Education', family: 'Social sciences & business', prefixes: ['EDUC', 'HOD', 'SPED'], tools: [planned('lesson-designer', 'Lesson designer', 'Objectives, activities and a UDL check')] },
  { id: 'communication', name: 'Communication', family: 'Social sciences & business', prefixes: ['CMST', 'COMM'], tools: [t('presentation-workflow', 'Presentation workflow', 'Audience, thesis, slides, notes, rehearsal, timing', 'guided', { opens: 'assignment' })] },
  { id: 'public-policy', name: 'Public policy', family: 'Social sciences & business', prefixes: ['PPS', 'PUBP', 'MPP'], tools: [policyMemo, analyse, matrix] },
  { id: 'law', name: 'Legal studies', family: 'Social sciences & business', prefixes: ['LAW', 'LGST'], tools: [t('case-brief', 'Case brief template', 'Facts, issue, holding, reasoning', 'guided', { opens: 'assignment', boundary: 'legal' })] },
  { id: 'criminal-justice', name: 'Criminal justice', family: 'Social sciences & business', prefixes: ['CRJ', 'CJ'], tools: [caseAnalysis, matrix] },
  { id: 'art', name: 'Art and design', family: 'Arts & media', prefixes: ['ARTS', 'HART', 'ARCH'], tools: [planned('critique-board', 'Critique and iteration board', 'References, critique and each iteration', 'copyright')] },
  { id: 'music', name: 'Music', family: 'Arts & media', prefixes: ['MUSC', 'MUSL', 'MUTH'], tools: [planned('ear-training', 'Ear training and rhythm', 'Intervals, chords and rhythm drills', 'copyright')] },
  { id: 'theatre-film', name: 'Theatre, film and media', family: 'Arts & media', prefixes: ['THTR', 'FILM', 'CMA'], tools: [draw, planned('storyboard', 'Storyboard and shot list', 'Scenes, shots and a call sheet', 'copyright')] },
];
