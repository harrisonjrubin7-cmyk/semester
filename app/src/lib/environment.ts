/**
 * Which environment this build is, read from the deployment and nowhere else.
 *
 * The operations console's context bar opens with the environment as a word
 * and a shape (`CONTEXT_BAR` in `lib/ops/console.ts`): never colour alone,
 * and never from a setting the operator can change. So the answer comes from
 * the build's own variables — the ones Vite inlines at build time — and there
 * is no runtime override, no query parameter and no preference that can turn
 * a production console into a demo one or the reverse.
 *
 * Three answers, in the order they are decided:
 *
 * - **Demo** when `VITE_INSTITUTIONAL_PREVIEW` is `'true'`: the demo build is
 *   made separately into `/demo/` with the account service blanked
 *   (`.github/workflows/pages.yml`, `lib/institutional-preview.ts`), and
 *   nothing it shows is a customer.
 * - **Staging** when the deployment says so (`VITE_DEPLOY_ENVIRONMENT` of
 *   `staging`, mapped into the build by `.github/workflows/pages.yml`), and
 *   for every build that is not a production build at all — `vite dev`, the test runner, a local preview.
 *   A build nobody deployed is not production, whatever it is pointed at.
 * - **Production** otherwise.
 */

export type Environment = 'Production' | 'Staging' | 'Demo';

/** The word and the shape, together, so a colour-blind operator reads the same thing a sighted one does. */
export const ENVIRONMENT_SHAPE: Record<Environment, string> = {
  Production: '■ Production',
  Staging: '◆ Staging',
  Demo: '○ Demo',
};

export type BuildEnv = Record<string, string | undefined>;

export function environment(env: BuildEnv = import.meta.env as BuildEnv): Environment {
  if (env.VITE_INSTITUTIONAL_PREVIEW === 'true') return 'Demo';
  if (env.VITE_DEPLOY_ENVIRONMENT === 'staging') return 'Staging';
  if (env.MODE !== 'production') return 'Staging';
  return 'Production';
}
