import Plugin from 'broccoli-plugin';
import Addon from 'ember-cli/lib/models/addon';
import UI from 'console-ui';
import { EventEmitter } from 'events';
import { addonDefinition } from './lib/utilities/ember-cli-definitions';
import { getFSEventEmitter } from './lib/project-fs-events';
import ProjectTypeChecker from './lib/project-typechecker';

type BabelPlugin = string | [string] | [string, Record<string, any>] | [string, Record<string, any>, string];

export = addonDefinition({
  name: 'ember-cli-typescript',
  events: null as any as EventEmitter,

  blueprintsPath() {
    return `${__dirname}/blueprints`;
  },

  includedCommands() {
    if (this.project.isEmberCLIAddon()) {
      return {
        'ts:precompile': require('./lib/commands/precompile').default,
        'ts:clean': require('./lib/commands/clean').default,
      };
    }
  },

  shouldIncludeChildAddon(addon: Addon) {
    // For testing, we have dummy in-repo addons set up, but e-c-ts doesn't depend on them;
    // its dummy app does. Otherwise we'd have a circular dependency.
    return !['in-repo-a', 'in-repo-b', 'in-repo-c'].includes(addon.name);
  },

  init() {
    this._super.init.apply(this, arguments);
    this.events = getFSEventEmitter(this.project);
    this.checkDevelopmentMode();
  },

  setupPreprocessorRegistry(type: 'parent' | 'self') {
    if (type !== 'parent') { return; }

    // Ideally we would do this in `included`, but `setupPreprocessorRegistry` is executed
    // first, and `ember-cli-babel` checks its configured extensions there.
    let options = cloneOrInit(this.app || this.parent, 'options', {});
    let emberCLIBabelOptions = cloneOrInit(options, 'ember-cli-babel', {});
    let babelOptions = cloneOrInit(options, 'babel', {});

    let plugins: BabelPlugin[] = cloneOrInit(babelOptions, 'plugins', []);

    // TODO coordinate with the ember-decorators folks on how to avoid duplication here;
    // their current `hasPlugin` check doesn't account for resolved paths, and we're not
    // currently doing any deduping at all 😅
    plugins.unshift(
      [require.resolve('@babel/plugin-transform-typescript')],
      [require.resolve('@babel/plugin-proposal-decorators'), { legacy: true }],
      [require.resolve('@babel/plugin-proposal-class-properties'), { loose: true }],
      [require.resolve('@babel/plugin-proposal-object-rest-spread')]
    );

    let extensions = cloneOrInit(emberCLIBabelOptions, 'extensions', ['js']);
    if (!extensions.includes('ts')) {
      extensions.push('ts');
    }
  },

  treeForAddon() {
    if (this.parent === this.project) {
      let typechecker = new ProjectTypeChecker(this.project);
      return new TSTypeChecker(this.project.ui, typechecker, this.events);
    }
  },

  checkDevelopmentMode() {
    if (this.isDevelopingAddon() && __filename.endsWith('.js')) {
      this.ui.writeWarnLine(
        'ember-cli-typescript is under development but loading prebuilt .js files; ' +
        'you may need to run `yarn addon:clean` in order to see changes to addon code.'
      );
    }
  }
});

function cloneOrInit<V>(obj: any, key: string, defaultTo: V): V {
  let existingValue = obj[key];
  if (existingValue) {
    return obj[key] = Array.isArray(existingValue)
      ? existingValue.slice()
      : Object.assign({}, existingValue);
  } else {
    return obj[key] = defaultTo;
  }
}

class TSTypeChecker extends Plugin {
  constructor(private ui: UI, private typechecker: ProjectTypeChecker, fsevents: EventEmitter) {
    super([]);

    fsevents
      .on('add', file => this.typechecker.fileAdded(file))
      .on('change', file => this.typechecker.fileChanged(file))
      .on('delete', file => this.typechecker.fileDeleted(file));
  }

  build() {
    return this.typechecker.awaitPendingBuild().catch((error) => {
      // It would be nice to make `broccoli-middleware` support colorized
      // codeframes, but for now we need to strip ANSI colors out.
      let message = require('strip-ansi')(error.message);

      if (this.typechecker.shouldFailOnError()) {
        throw Object.assign(new Error('Build failed due to a TypeScript error'), {
          codeFrame: message
        });
      } else {
        this.ui.write(message, 'ERROR');
      }
    });
  }
}
