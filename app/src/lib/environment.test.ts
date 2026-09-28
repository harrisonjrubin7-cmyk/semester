import { describe, expect, it } from 'vitest';
import { ENVIRONMENT_SHAPE, environment, type Environment } from './environment';

/**
 * The environment is read from the build, and nothing an operator holds can
 * change it. Each case below is one deployment's variables, and the demo
 * switch wins over everything because a demo build pointed at staging is
 * still showing nobody's data.
 */

const production = { MODE: 'production' };

describe('environment', () => {
  it('is Production for a production build with no deployment override', () => {
    expect(environment(production)).toBe('Production');
  });

  it('is Demo whenever the institutional preview switch is on, whatever else says', () => {
    expect(environment({ ...production, VITE_INSTITUTIONAL_PREVIEW: 'true' })).toBe('Demo');
    expect(environment({ ...production, VITE_INSTITUTIONAL_PREVIEW: 'true', VITE_DEPLOY_ENVIRONMENT: 'staging' })).toBe('Demo');
    expect(environment({ MODE: 'development', VITE_INSTITUTIONAL_PREVIEW: 'true' })).toBe('Demo');
  });

  it('takes only the literal string true for the demo switch', () => {
    expect(environment({ ...production, VITE_INSTITUTIONAL_PREVIEW: '1' })).toBe('Production');
    expect(environment({ ...production, VITE_INSTITUTIONAL_PREVIEW: 'TRUE' })).toBe('Production');
    expect(environment({ ...production, VITE_INSTITUTIONAL_PREVIEW: '' })).toBe('Production');
  });

  it('is Staging when the deployment says staging, and nothing else it says counts', () => {
    expect(environment({ ...production, VITE_DEPLOY_ENVIRONMENT: 'staging' })).toBe('Staging');
    expect(environment({ ...production, VITE_DEPLOY_ENVIRONMENT: 'production' })).toBe('Production');
    expect(environment({ ...production, VITE_DEPLOY_ENVIRONMENT: 'Staging' })).toBe('Production');
  });

  it('is Staging for every build that is not a production build', () => {
    expect(environment({ MODE: 'development' })).toBe('Staging');
    expect(environment({ MODE: 'test' })).toBe('Staging');
    expect(environment({})).toBe('Staging');
  });

  it('reads the build it is running in when given nothing', () => {
    // Under the test runner MODE is `test`, which is not a production build.
    expect(environment()).toBe('Staging');
  });
});

describe('the shape beside the word', () => {
  it('names every environment as a word and a shape, and the shapes differ', () => {
    const all: Environment[] = ['Production', 'Staging', 'Demo'];
    const shapes = new Set<string>();
    for (const e of all) {
      const said = ENVIRONMENT_SHAPE[e];
      expect(said.endsWith(` ${e}`), `${e} should end with its own word`).toBe(true);
      const shape = said.slice(0, said.length - e.length - 1);
      expect(shape.length, `${e} needs a shape before the word`).toBeGreaterThan(0);
      shapes.add(shape);
    }
    expect(shapes.size).toBe(all.length);
  });
});
