import Plugin from 'broccoli-plugin';
import Addon from 'ember-cli/lib/models/addon';
import Project from 'ember-cli/lib/models/project';
import UI from 'console-ui';
import { EventEmitter } from 'events';
import { getFSEventEmitter } from './watcher-events';
import TypeChecker from './typechecker';

export = EmberCLITypescript;
class EmberCLITypescript extends Addon.extend({
  name: 'ember-cli-typescript'
}) {
  private _events = getFSEventEmitter(this.project);

  shouldIncludeChildAddon(addon: Addon) {
    // For testing, we have dummy in-repo addons set up, but e-c-ts doesn't depend on them;
    // its dummy app does. Otherwise we'd have a circular dependency.
    return !['in-repo-a', 'in-repo-b', 'in-repo-c'].includes(addon.name);
  }

  setupPreprocessorRegistry(type: 'parent' | 'self') {
    if (type !== 'parent') { return; }

    // Ideally we would do this in `included`, but `setupPreprocessorRegistry` is executed
    // first, and `ember-cli-babel` checks its configured extensions there.
    let options = cloneOrInit(this.app || this.parent, 'options', {});
    let emberCLIBabelOptions = cloneOrInit(options, 'ember-cli-babel', {});
    let babelOptions = cloneOrInit(options, 'babel', {});

    let plugins = cloneOrInit(babelOptions, 'plugins', []) as Array<[string] | [string, Record<string, any>]>;
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
  }

  treeForAddon() {
    if (this.parent === this.project) {
      let typechecker = new (require('./typechecker').default)(this.project);
      return new TSTypeChecker(this.project.ui, this._events, typechecker);
    }
  }
}

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
  constructor(private _ui: UI, fsevents: EventEmitter, private _typechecker: TypeChecker) {
    super([]);

    fsevents
      .on('ts:add', file => this._typechecker.fileAdded(file))
      .on('ts:change', file => this._typechecker.fileChanged(file))
      .on('ts:delete', file => this._typechecker.fileDeleted(file));
  }

  build() {
    return this._typechecker.build().catch((error) => {
      // It would be nice to make `broccoli-middleware` support colorized
      // codeframes, but for now we need to strip ANSI colors out.
      let message = require('strip-ansi')(error.message);

      if (this._typechecker.shouldFailOnError()) {
        throw Object.assign(new Error('Build failed due to a TypeScript error'), {
          codeFrame: message
        });
      } else {
        this._ui.write(message, 'ERROR');
      }
    });
  }
}
