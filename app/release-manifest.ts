/**
 * Public, non-secret facts compiled into `release.json` beside every build.
 *
 * This module is deliberately browser-neutral because Vite itself imports it.
 * It emits states and booleans only — never a URL, key, credential, identifier
 * or value length.
 */
export type ReleaseEnvironment = 'Production' | 'Staging' | 'Demo';
export type PublicFeatureState = 'off' | 'preview' | 'sandbox' | 'production';
export type ReleaseEnv = Record<string, string | undefined>;

export interface PublicReleaseManifest {
  schemaVersion: 1;
  source: {
    sha: string;
    buildId: string;
  };
  environment: ReleaseEnvironment;
  features: {
    humanHelp: PublicFeatureState;
    privateBeta: PublicFeatureState;
    supportTickets: PublicFeatureState;
    journeyNavigation: PublicFeatureState;
  };
  controls: {
    readOnly: boolean;
    accountService: boolean;
    institutionalPreview: boolean;
  };
  services: {
    universityGateway: boolean;
    assistantProxy: boolean;
    calendarProxy: boolean;
    pushDelivery: boolean;
    oauthProxy: boolean;
    callsRelay: boolean;
  };
}

const STATES: readonly PublicFeatureState[] = ['off', 'preview', 'sandbox', 'production'];
const present = (env: ReleaseEnv, name: string): boolean => Boolean(env[name]?.trim());
const state = (env: ReleaseEnv, name: string, fallback: PublicFeatureState = 'off'): PublicFeatureState => {
  const value = env[name];
  return STATES.includes(value as PublicFeatureState) ? (value as PublicFeatureState) : fallback;
};

function releaseEnvironment(env: ReleaseEnv): ReleaseEnvironment {
  if (env.VITE_INSTITUTIONAL_PREVIEW === 'true') return 'Demo';
  if (env.VITE_DEPLOY_ENVIRONMENT === 'staging' || env.MODE !== 'production') return 'Staging';
  return 'Production';
}

export function publicReleaseManifest(env: ReleaseEnv): PublicReleaseManifest {
  const releaseSha = env.SEMESTER_RELEASE_SHA?.trim() ?? '';
  const buildId = env.VITE_BUILD_ID?.trim() ?? '';
  return {
    schemaVersion: 1,
    source: {
      sha: /^[0-9a-f]{40}$/.test(releaseSha) ? releaseSha : 'unknown',
      buildId: /^[A-Za-z0-9._-]{1,100}$/.test(buildId) ? buildId : 'unknown',
    },
    environment: releaseEnvironment(env),
    features: {
      humanHelp: state(env, 'VITE_HUMAN_HELP'),
      privateBeta: state(env, 'VITE_PRIVATE_BETA'),
      supportTickets: state(env, 'VITE_SUPPORT_TICKETS'),
      journeyNavigation: state(env, 'VITE_JOURNEY_NAVIGATION', 'production'),
    },
    controls: {
      readOnly: env.VITE_READ_ONLY === 'true',
      accountService: present(env, 'VITE_SUPABASE_URL') && present(env, 'VITE_SUPABASE_KEY'),
      institutionalPreview: env.VITE_INSTITUTIONAL_PREVIEW === 'true',
    },
    services: {
      universityGateway: present(env, 'VITE_UNIVERSITY_GATEWAY_URL'),
      assistantProxy: present(env, 'VITE_CLAUDE_PROXY'),
      calendarProxy: present(env, 'VITE_ICS_PROXY'),
      pushDelivery: present(env, 'VITE_VAPID_PUBLIC_KEY'),
      oauthProxy: present(env, 'VITE_OAUTH_PROXY'),
      callsRelay:
        present(env, 'VITE_TURN_URL') &&
        present(env, 'VITE_TURN_USER') &&
        present(env, 'VITE_TURN_PASS'),
    },
  };
}

