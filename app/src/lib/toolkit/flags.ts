import type { FeatureState } from '../../intelligence/contracts';
import type { PreviewEnv } from '../institutional-preview';

/**
 * The AI Toolkit's switches, one per capability the brief says must be able to
 * be turned off on its own.
 *
 * Kept apart from `lib/experience-flags.ts` on purpose. Those six flags follow
 * the institutional preview — turn preview on and they all come up. Nothing
 * here does. Every toolkit flag is off until its environment variable names a
 * state, because several of these (code execution, external connectors, data
 * upload) are the ones the brief says must not be enabled without human review.
 *
 * `VITE_AI_TOOLKIT=off` is the kill switch: with it off, every other toolkit
 * flag reads off too, whatever it was set to. A kill switch that has to be
 * thrown seven times is one that gets thrown six.
 *
 * Two flags cannot be turned on from this file at all. `codeExecution` and
 * `externalConnectors` have no implementation behind them in this slice — no
 * sandbox and no approved connector exist — so a flag that claimed they were
 * on would be claiming something untrue. They read `off` whatever the
 * environment says until the reviewed phase that builds them changes that
 * here, with a test that fails first.
 */
export interface ToolkitFlags {
  aiToolkit: FeatureState;
  researchStudio: FeatureState;
  dataStudio: FeatureState;
  dataUpload: FeatureState;
  subjectWorkbenches: FeatureState;
  aiDisclosure: FeatureState;
  codeExecution: FeatureState;
  externalConnectors: FeatureState;
}

const STATES: readonly FeatureState[] = ['off', 'preview', 'sandbox', 'production'];

function read(env: PreviewEnv, key: string): FeatureState {
  const value = env[key];
  return STATES.includes(value as FeatureState) ? (value as FeatureState) : 'off';
}

/** Capabilities that have nothing behind them yet and so cannot be switched on. */
export const UNBUILT = ['codeExecution', 'externalConnectors'] as const;

export function toolkitFlags(env: PreviewEnv): ToolkitFlags {
  const master = read(env, 'VITE_AI_TOOLKIT');
  const under = (key: string): FeatureState => (master === 'off' ? 'off' : read(env, key));
  return {
    aiToolkit: master,
    researchStudio: under('VITE_TOOLKIT_RESEARCH'),
    dataStudio: under('VITE_TOOLKIT_DATA'),
    dataUpload: under('VITE_TOOLKIT_DATA_UPLOAD'),
    subjectWorkbenches: under('VITE_TOOLKIT_WORKBENCHES'),
    aiDisclosure: under('VITE_TOOLKIT_DISCLOSURE'),
    codeExecution: 'off',
    externalConnectors: 'off',
  };
}

export const TOOLKIT_FLAGS = toolkitFlags(import.meta.env);

export const on = (state: FeatureState) => state !== 'off';
