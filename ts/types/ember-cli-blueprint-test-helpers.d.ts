declare module 'ember-cli-blueprint-test-helpers/lib/helpers/ember' {
  export default function(args: string[]): Promise<void>;
}

declare module 'ember-cli-blueprint-test-helpers/helpers' {
  interface TestHooksOptions {
    disabledTasks?: string[]
  }

  interface Package {
    name: string;
    dev?: boolean;
    delete?: boolean;
    version?: string;
  }

  export function setupTestHooks(scope: Mocha.Suite, options?: TestHooksOptions): void;
  export function emberNew(options?: { target?: 'app' | 'addon' | 'in-repo-addon' }): Promise<void>;
  export function emberGenerate(args: string[]): Promise<void>;
  export function emberDestroy(args: string[]): Promise<void>;
  export function emberGenerateDestroy(args: string[]): Promise<void>;
  export function modifyPackages(packages: Package[]): void;
}

declare module 'ember-cli-blueprint-test-helpers/chai' {
  import 'chai-as-promised';
  export { expect } from 'chai';

  interface File {
    content: string;
  }

  export function file(path: string): File;
}
