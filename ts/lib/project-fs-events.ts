import { EventEmitter } from 'events';
import Project from 'ember-cli/lib/models/project';
import Watcher from 'ember-cli/lib/models/watcher';
import SaneWatcher from 'ember-cli-broccoli-sane-watcher';

/**
 * Returns an `EventEmitter` that will emit `add`, `change` and `delete` events
 * with absolute file paths whenever a file change is detected in the given
 * ember-cli `Project`. In non-watched builds, no events will ever be emitted.
 */
export function getFSEventEmitter(project: Project): EventEmitter {
  type WatcherClass = typeof Watcher & MaybeHasECTSEvents;
  const watcherClass = project.require('ember-cli/lib/models/watcher') as WatcherClass;

  if (!watcherClass.__ects_events__) {
    patch(watcherClass);
  }

  return watcherClass.__ects_events__!;
}

interface MaybeHasECTSEvents {
  __ects_events__?: EventEmitter;
}

// Patch Ember CLI's `Watcher` class so that we can get a backdoor into the FS events it emits
function patch(watcherClass: typeof Watcher) {
  const BaseClass = Object.getPrototypeOf(watcherClass.prototype).constructor;
  const ensurePosix = require('ensure-posix-path') as (path: string) => string;
  const events = new EventEmitter();
  const fileEventCallback = (type: string) => (file: string, root: string) =>
    events.emit(type, ensurePosix(`${root}/${file}`));

  class ECTSPatchedWatcher extends BaseClass {
    private _watcher!: SaneWatcher;

    get watcher() {
      return this._watcher;
    }

    set watcher(watcher) {
      this._watcher = watcher;

      // Individual directory watchers are lazily added as nodes are included in the Broccoli build
      // The simplest way for us to catch that without getting into the builder internals is to
      // capture sets on the `watched` hash and forward along events.
      watcher.watched = new Proxy(watcher.watched, {
        set(watched, path: string, watcher: EventEmitter) {
          watched[path] = watcher
            .on('add', fileEventCallback('add'))
            .on('change', fileEventCallback('change'))
            .on('delete', fileEventCallback('delete'));
          return true;
        },
      });
    }

    static get __ects_events__() {
      return events;
    }
  }

  // Inject our patches into the default watcher class's prototype chain
  Object.setPrototypeOf(watcherClass.prototype, Object.create(ECTSPatchedWatcher.prototype));
  Object.setPrototypeOf(watcherClass, ECTSPatchedWatcher);
}
