import Addon from 'ember-cli/lib/models/addon';
import Blueprint from 'ember-cli/lib/models/blueprint';
import Command from 'ember-cli/lib/models/command';

/*
 * Ember CLI accepts POJOs rather than actual constructors for many of
 * the classes that addons can define. Among other things, this ensures
 * that when an addon is running linked, the actual class that's created
 * is the version from the host app rather than a potentially incompatible
 * one from the addon's own dependencies.
 *
 * The utilities in this module are all identity functions that give us
 * some semblance of type safety for the methods we define on those hashes.
 */

export function addonDefinition<T>(definition: T & ThisType<T & Addon>) {
  return definition;
}

export function blueprintDefinition<T>(definition: T & ThisType<T & Blueprint>) {
  return definition;
}

export function commandDefinition<T>(definition: T & ThisType<T & Command>) {
  return definition;
}
