// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import * as Design from './index';

const EXPECTED = [
  'AIResponse',
  'ActionPreview',
  'ApprovalBanner',
  'Avatar',
  'Button',
  'Choice',
  'Combobox',
  'CommandPalette',
  'ConnectionLine',
  'ConnectionState',
  'ConsentBadge',
  'ContextBar',
  'DataTable',
  'DateField',
  'DecisionTrail',
  'DelegationRow',
  'Dialog',
  'EmptyState',
  'ErrorState',
  'ErrorSummary',
  'Fields',
  'FilterChips',
  'FocusBar',
  'HealthBadge',
  'Icon',
  'IconButton',
  'LoadingState',
  'MetricTile',
  'NextSteps',
  'Notice',
  'ObjectCard',
  'OfflineStrip',
  'OpenIn',
  'PageHeader',
  'PermissionNotice',
  'PermissionPrompt',
  'PermissionRow',
  'PolicyBadge',
  'ProgressState',
  'ProvenanceChart',
  'ProvenanceChips',
  'QuickActions',
  'ReadinessState',
  'SaveState',
  'ScreenGuide',
  'SectionLabel',
  'Segmented',
  'Select',
  'SemesterDesignSurface',
  'SessionRow',
  'Sheet',
  'SideRail',
  'SlaTimer',
  'SourceBadge',
  'SourceLine',
  'StatusChip',
  'StepStatus',
  'SuccessState',
  'SupportHandoff',
  'Switch',
  'SystemContextBar',
  'TabBar',
  'TabPanel',
  'Tabs',
  'TextField',
  'UndoToast',
  'VisibilityPicker',
  'Wordmark',
] as const;

describe('the integrated Semester design archive', () => {
  it('publishes the complete component vocabulary from one stable entry point', () => {
    expect(Object.keys(Design).sort()).toEqual([...EXPECTED].sort());
    for (const name of EXPECTED) expect(Design[name], name).toBeDefined();
  });

  it('contains imported selectors instead of changing existing screen classes', () => {
    for (const file of ['components.css', 'components-2.css']) {
      const css = readFileSync(join(__dirname, '..', '..', 'styles', 'semester-design', file), 'utf8');
      expect(css.trimStart()).toMatch(/^@scope \(\.semester-design-components\)/);
      expect(css.trimEnd()).toMatch(/}$/);
    }
  });

  it('renders connection truth and the compatibility boundary together', () => {
    const html = renderToStaticMarkup(
      <Design.SemesterDesignSurface label="Provider state">
        <Design.ConnectionState
          state="updating"
          label="Enrollment confirmed"
          detail="Schedule updating"
          source="Registrar"
        />
      </Design.SemesterDesignSurface>,
    );

    expect(html).toContain('semester-design-components');
    expect(html).toContain('Enrollment confirmed');
    expect(html).toContain('Schedule updating');
    expect(html).toContain('Registrar');
  });

  it('does not let a requester approve their own consequential change', () => {
    const html = renderToStaticMarkup(
      <Design.ApprovalBanner
        state="pending"
        what="Publish the course"
        requestedBy="Harrison"
        approver="Academic affairs"
        selfRequested
        onApprove={() => undefined}
      />,
    );

    expect(html).toContain('someone else must approve');
    expect(html).not.toContain('>Approve<');
  });
});
