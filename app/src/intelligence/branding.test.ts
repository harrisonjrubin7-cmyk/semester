import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('Semester Intelligence product identity', () => {
  it('names navigation and conversation entry points for Semester, not one provider', () => {
    const surfaces = [
      '../lib/nav.ts',
      '../lib/softtop.ts',
      '../components/Command.tsx',
      '../components/desk/TopBar.tsx',
      '../headers.ts',
    ].map(read).join('\n');
    expect(surfaces).toContain('Ask Semester');
    expect(surfaces).toContain('Semester Intelligence');
    expect(surfaces).not.toMatch(/label:\s*['"]Ask Claude|title:\s*['"]Ask Claude|aria-label=['"]AI Tutor/);
  });

  it('keeps Claude only as a provider choice or provider-specific explanation', () => {
    const productCopy = [
      '../components/mail/Compose.tsx',
      '../screens/Connect.tsx',
      '../ai/Chat.tsx',
      '../ai/Panel.tsx',
      '../ai/Turns.tsx',
    ].map(read).join('\n');
    expect(productCopy).not.toContain('Ask Claude');
    expect(productCopy).not.toMatch(/>Claude</);

    const settings = read('../screens/settings/Assistant.tsx');
    expect(settings).toContain("{ id: 'anthropic', label: 'Claude' }");
  });
});
