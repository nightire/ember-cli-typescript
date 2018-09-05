declare module 'ember-cli/lib/models/addon' {
  import UI from 'console-ui';
  import CoreObject from 'core-object';
  import Project from 'ember-cli/lib/models/project';
  import EmberApp from 'ember-cli/lib/broccoli/ember-app';

  export = Addon;
  class Addon extends CoreObject {
    constructor(parent: Addon | Project, project: Project);

    ui: UI;
    name: string;
    root: string;
    project: Project;
    app?: EmberApp;
    options?: {};
    parent: Addon | Project;
    isDevelopingAddon(): boolean;
  }
}

declare module 'ember-cli/lib/models/project' {
  import UI from 'console-ui';
  import CoreObject from 'core-object';

  export = Project;
  class Project extends CoreObject {
    name(): string;
    root: string;
    ui: UI;
    pkg: Record<string, any>;
    require(module: string): unknown;
    isEmberCLIAddon(): boolean;
    isModuleUnification?(): boolean;
    dependencies(): Record<string, string>;
  }
}

declare module 'ember-cli/lib/broccoli/ember-app' {
  export = EmberApp;
  class EmberApp {
    options?: {}
  }
}

declare module 'ember-cli/lib/models/watcher' {
  import SaneWatcher from 'ember-cli-broccoli-sane-watcher';

  export = EmberCLIWatcher;
  class EmberCLIWatcher {
    watcher: SaneWatcher;
  }
}

declare module 'ember-cli/lib/models/blueprint' {
  import CoreObject from 'core-object';
  import UI from 'console-ui';
  import Project from 'ember-cli/lib/models/project';

  interface PackageConfig {
    name: string;
    target: string;
  }

  export = Blueprint;
  class Blueprint extends CoreObject {
    project: Project;
    ui: UI;
    taskFor(name: string): unknown;
    addPackagesToProject(packages: PackageConfig[]): Promise<void>;
  }
}

declare module 'ember-cli/lib/models/command' {
  import CoreObject from 'core-object';
  import Project from 'ember-cli/lib/models/project';
  import UI from 'console-ui';

  export = Command;
  class Command extends CoreObject {
    project: Project;
    ui: UI;
  }
}
