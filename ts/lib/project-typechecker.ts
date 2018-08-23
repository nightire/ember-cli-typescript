'use strict';

import { EventEmitter } from 'events';
import path from 'path';
import logger from 'debug';
import Project from 'ember-cli/lib/models/project';
import {
  Watch,
  SemanticDiagnosticsBuilderProgram,
  FileWatcherCallback,
  DirectoryWatcherCallback,
  CompilerOptions,
  Diagnostic,
  FormatDiagnosticsHost,
  WatchCompilerHostOfConfigFile,
  FileWatcherEventKind,
} from 'typescript';

// We never want to actually statically import TS; we should pull it from the project
type TSImpl = typeof import('typescript');

const trace = logger('ember-cli-typescript:tsc:trace');

interface PendingBuild {
  settled: boolean;
  promise: Promise<void>;
}

/**
 * Manages typechecking for an ember-cli project, providing hooks for
 * notifying when a file in the project is added, changed or removed
 * and exposing a sequence of promises that will resolve or reject as
 * each re-check completes.
 */
export default class ProjectTypeChecker extends EventEmitter {
  private program?: Watch<SemanticDiagnosticsBuilderProgram>;

  private project: Project;
  private ts: TSImpl;

  private configFilePath: string;
  private pendingBuild: PendingBuild;
  private compilerOptions: CompilerOptions;
  private diagnostics: Diagnostic[];
  private fileCallbacks: Map<string, FileWatcherCallback>;
  private dirCallbacks: Map<string, DirectoryWatcherCallback>;
  private formatDiagnosticsHost: FormatDiagnosticsHost;

  constructor(project: Project) {
    super();

    this.project = project;
    this.ts = project.require('typescript') as TSImpl;

    this.pendingBuild = { settled: true, promise: Promise.resolve() };
    this.configFilePath = this.findConfigFile();
    this.compilerOptions = this.buildConfig();
    this.diagnostics = [];
    this.fileCallbacks = new Map();
    this.dirCallbacks = new Map();
    this.formatDiagnosticsHost = {
      getCanonicalFileName: file => file,
      getCurrentDirectory: this.ts.sys.getCurrentDirectory,
      getNewLine: () => this.ts.sys.newLine,
    };
  }

  /**
   * Whether a type error should fail the Ember CLI build.
   */
  shouldFailOnError(): boolean {
    return !!this.compilerOptions.noEmitOnError;
  }

  /**
   * Start the typechecker if it hasn't already been started, returning
   * a promise that will resolve or reject based on the outcome of the
   * next typecheck.
   */
  awaitPendingBuild(): Promise<void> {
    if (!this.program) {
      this.start();
    }

    return this.pendingBuild.promise;
  }

  /**
   * A hook to inform the typechecker that a file has been added to the project.
   */
  fileAdded(file: string) {
    if (!file.endsWith('.ts')) {
      return;
    }

    let didTrigger = false;
    for (let [dir, callback] of this.dirCallbacks.entries()) {
      if (file.startsWith(dir)) {
        callback(file);
        didTrigger = true;
      }
    }

    if (didTrigger) {
      this.monitorPendingBuild();
    }
  }

  /**
   * A hook to inform the typechecker that a file has been changed in the project.
   */
  fileChanged(file: string) {
    this.triggerFileCallback(file, this.ts.FileWatcherEventKind.Changed);
  }

  /**
   * A hook to inform the typechecker that a file has been removed from the project.
   */
  fileDeleted(file: string) {
    this.triggerFileCallback(file, this.ts.FileWatcherEventKind.Deleted);
  }

  /**
   *
   */
  private triggerFileCallback(file: string, kind: FileWatcherEventKind) {
    let callback = this.fileCallbacks.get(file);
    if (callback) {
      callback(file, kind);
      this.monitorPendingBuild();
    }
  }

  private start() {
    let host = this.createWatchCompilerHost();
    this.program = this.ts.createWatchProgram(host);
    this.monitorPendingBuild();
  }

  private createWatchCompilerHost(): WatchCompilerHostOfConfigFile<SemanticDiagnosticsBuilderProgram> {
    let host = this.ts.createWatchCompilerHost(
      this.configFilePath,
      this.compilerOptions,
      this.buildWatchHooks(),
      this.ts.createSemanticDiagnosticsBuilderProgram,
      diagnostic => this.reportDiagnostic(diagnostic),
      () => {} // No-op `reportWatchStatus` callback
    );

    // Emit an event when typechecking has completed
    let buildComplete = () => this.reportBuildComplete();
    let afterCreate = host.afterProgramCreate!;
    host.afterProgramCreate = function() {
      afterCreate.apply(this, arguments);
      process.nextTick(buildComplete);
    };

    // If debug logging is enabled, provide the logger as a custom `trace` hook
    if (trace.enabled) {
      host.trace = str => trace(str.trim());
    }

    return host;
  }

  private monitorPendingBuild() {
    if (this.pendingBuild.settled) {
      let pendingBuild: PendingBuild = {
        settled: false,
        promise: new Promise((resolve, reject) => {
          this.once('didBuild', diagnostics => {
            if (diagnostics.length) {
              reject(new Error(this.formatDiagnostics(diagnostics)));
            } else {
              resolve();
            }
            pendingBuild.settled = true;
          });
        }),
      };

      this.pendingBuild = pendingBuild;
      this.pendingBuild.promise.catch(() => {});
    }
  }

  private formatDiagnostics(diagnostics: Diagnostic[]) {
    return this.ts.formatDiagnosticsWithColorAndContext(diagnostics, this.formatDiagnosticsHost);
  }

  private reportDiagnostic(diagnostic: Diagnostic) {
    this.diagnostics.push(diagnostic);
  }

  private reportBuildComplete() {
    this.emit('didBuild', this.diagnostics);
    this.diagnostics = [];
  }

  private buildConfig(): CompilerOptions {
    let baseDir = path.dirname(this.configFilePath);
    let projectConfig = this.readProjectConfig();
    let overrides = {
      noEmit: true,
      allowJs: false,
      diagnostics: trace.enabled,
      extendedDiagnostics: trace.enabled,
    };

    let commandLine = this.ts.parseJsonConfigFileContent(
      projectConfig,
      this.ts.sys,
      baseDir,
      overrides
    );
    return commandLine.options;
  }

  private findConfigFile() {
    let configFilePath = this.ts.findConfigFile(this.project.root, this.ts.sys.fileExists);
    if (!configFilePath) {
      throw new Error('Unable to locate tsconfig.json');
    }

    return configFilePath;
  }

  private readProjectConfig() {
    let result = this.ts.readConfigFile(this.configFilePath, this.ts.sys.readFile);
    if (result.error) {
      throw new Error(`Unable to read tsconfig.json: ${result.error.messageText}`);
    } else {
      return result.config;
    }
  }

  private buildWatchHooks() {
    return Object.assign({}, this.ts.sys, {
      watchFile: (file: string, callback: FileWatcherCallback) => {
        this.fileCallbacks.set(file, callback);
        return { close: () => this.fileCallbacks.delete(file) };
      },
      watchDirectory: (dir: string, callback: DirectoryWatcherCallback) => {
        this.dirCallbacks.set(dir, callback);
        return { close: () => this.dirCallbacks.delete(dir) };
      },
    });
  }
}
