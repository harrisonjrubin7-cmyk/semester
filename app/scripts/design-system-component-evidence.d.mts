export interface PublicDesignSystemComponent {
  name: string;
  source: string;
  imported: string;
}

export type ComponentEvidenceRequirement =
  | 'typescript_api'
  | 'accessibility_behavior'
  | 'visual_states'
  | 'story_or_test_fixture'
  | 'light_and_dark_coverage'
  | 'responsive_behavior'
  | 'reduced_motion_behavior'
  | 'usage_documentation';

export interface ComponentEvidenceRecord {
  name: string;
  family: string;
  source: string;
  status: 'evidence_complete' | 'evidence_incomplete';
  requirements: Record<ComponentEvidenceRequirement, string[]>;
  satisfied: Record<ComponentEvidenceRequirement, boolean>;
  missing: ComponentEvidenceRequirement[];
}

export interface ComponentEvidenceResult {
  status: 'complete' | 'incomplete';
  claim_ceiling: string;
  requirements: ComponentEvidenceRequirement[];
  summary: { total: number; complete: number; incomplete: number };
  missing_by_requirement: Record<ComponentEvidenceRequirement, string[]>;
  components: ComponentEvidenceRecord[];
}

export function publicComponents(indexText: string): PublicDesignSystemComponent[];
export function componentEvidence(options?: { root?: string }): ComponentEvidenceResult;
