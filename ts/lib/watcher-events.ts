import { EventEmitter } from 'events';
import Project from 'ember-cli/lib/models/project';
import Watcher from 'ember-cli/lib/models/watcher';
import SaneWatcher from 'ember-cli-broccoli-sane-watcher';

interface HasECTSEvents {
  __ects_events__?: EventEmitter;
}

export function getFSEventEmitter(project: Project): EventEmitter {
  const watcherClass = project.require('ember-cli/lib/models/watcher') as typeof Watcher & HasECTSEvents;
  if (!watcherClass.__ects_events__) {
    patch(watcherClass);
  }
  return watcherClass.__ects_events__!;
}

// Patch Ember CLI's `Watcher` class so that we can get a backdoor into the FS events it emits
function patch(watcherClass: typeof Watcher) {
  const ensurePosix = require('ensure-posix-path') as (path: string) => string;
  const events = new EventEmitter();

  class HackedWatcher extends Object.getPrototypeOf(watcherClass.prototype).constructor {
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
            .on('add', (file, root) => events.emit('ts:add', ensurePosix(`${root}/${file}`)))
            .on('change', (file, root) => events.emit('ts:change', ensurePosix(`${root}/${file}`)))
            .on('delete', (file, root) => events.emit('ts:delete', ensurePosix(`${root}/${file}`)));
          return true;
        }
      });
    }

    static get __ects_events__() {
      return events;
    }
  }

  Object.setPrototypeOf(watcherClass.prototype, Object.create(HackedWatcher.prototype));
  Object.setPrototypeOf(watcherClass, HackedWatcher);
}
