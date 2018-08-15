declare module 'ember-cli-broccoli-sane-watcher' {
  import { EventEmitter } from "events";

  export = SaneWatcher;
  class SaneWatcher {
    watched: Record<string, EventEmitter>;
  }
}
