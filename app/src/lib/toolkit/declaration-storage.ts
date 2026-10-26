import type { Tier } from './classification';
import type { Use } from './policy-uses';

export interface Declaration {
  assignment: string;
  course: string;
  tool: string;
  version: string;
  dates: string;
  uses: Use[];
  purpose: string;
  inputTier: Tier;
  interaction: string;
  outputUsed: string;
  sourcesChecked: string;
  verified: string;
  edits: string;
  limitations: string;
  attested: boolean;
}

export const blankDeclaration = (assignment = '', course = ''): Declaration => ({
  assignment,
  course,
  tool: '',
  version: '',
  dates: '',
  uses: [],
  purpose: '',
  inputTier: 'T2',
  interaction: '',
  outputUsed: '',
  sourcesChecked: '',
  verified: '',
  edits: '',
  limitations: '',
  attested: false,
});
