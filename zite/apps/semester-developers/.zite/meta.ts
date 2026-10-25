import { getSdkCall } from '../../../node_modules/zitejs/dist/esm/internal/sdkCall.js';

const META_SDK_INTEGRATION_ID = '__meta__';

export type ZiteWorkspace = {
  workspaceHomeUrl: string;
  editorUrl: string;
  appPublicIdentifier: string;
  projectPublicIdentifier: string;
};

export class ZiteMeta {
  /** Workspace home + this app's editor URL for *this* clone. */
  static getWorkspace(): Promise<ZiteWorkspace> {
    return getSdkCall()(
      META_SDK_INTEGRATION_ID,
      'ZiteMeta',
      'getWorkspace',
      {},
    ) as Promise<ZiteWorkspace>;
  }
}

export const Meta = ZiteMeta;
