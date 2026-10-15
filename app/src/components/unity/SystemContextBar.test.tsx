import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./SystemContextBar.tsx', import.meta.url), 'utf8');

describe('the system continuity strip', () => {
  it('carries term, canonical location, continuation, workflow, and health', () => {
    expect(source).toContain('currentTerm?.label');
    expect(source).toContain('aria-label="Current semester"');
    expect(source).toContain("type: 'setTerm'");
    expect(source).toContain('canonicalDestinationFor');
    expect(source).toContain('← Back to {continuation.label}');
    expect(source).toContain('workflowForScreen');
    expect(source).toContain('syncStatusKey');
  });
});
