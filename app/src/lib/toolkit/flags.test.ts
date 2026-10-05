import { describe, expect, it } from 'vitest';
import { toolkitFlags } from './flags';

describe('feature flags', () => {
  it('everything is off with no environment', () => {
    expect(Object.values(toolkitFlags({})).every((s) => s === 'off')).toBe(true);
  });

  it('does not follow the institutional preview the way the experience flags do', () => {
    expect(toolkitFlags({ VITE_INSTITUTIONAL_PREVIEW: 'true' }).aiToolkit).toBe('off');
  });

  it('the kill switch turns every toolkit flag off whatever the others say', () => {
    const f = toolkitFlags({ VITE_AI_TOOLKIT: 'off', VITE_TOOLKIT_RESEARCH: 'production', VITE_TOOLKIT_DATA: 'production' });
    expect(f.researchStudio).toBe('off');
    expect(f.dataStudio).toBe('off');
  });

  it('code execution and external connectors cannot be switched on — nothing is built behind them', () => {
    const f = toolkitFlags({ VITE_AI_TOOLKIT: 'production', VITE_TOOLKIT_CODE: 'production', VITE_TOOLKIT_CONNECTORS: 'production' });
    expect(f.codeExecution).toBe('off');
    expect(f.externalConnectors).toBe('off');
  });

  it('an unknown value reads as off, not as on', () => {
    expect(toolkitFlags({ VITE_AI_TOOLKIT: 'yes' }).aiToolkit).toBe('off');
  });
});
