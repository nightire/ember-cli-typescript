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
} from 'typescript';

// We never want to actually statically import TS; we should pull it from the project
type TSImpl = typeof import('typescript');

const trace = logger('ember-cli-typescript:tsc:trace');

export default class TypeChecker extends EventEmitter {
  program?: Watch<SemanticDiagnosticsBuilderProgram>;

  private _project: Project;
  private _ts: TSImpl;

  private _configFilePath?: string;
  private _build?: { settled: boolean; promise: Promise<void> };
  private _compilerOptions: CompilerOptions;
  private _diagnostics: Diagnostic[];
  private _fileCallbacks: Map<string, FileWatcherCallback>;
  private _dirCallbacks: Map<string, DirectoryWatcherCallback>;
  private _formatDiagnosticHost: FormatDiagnosticsHost;

  constructor(project: Project) {
    super();

    this._project = project;
    this._ts = project.require('typescript') as TSImpl;

    this._compilerOptions = this._buildConfig();
    this._diagnostics = [];
    this._fileCallbacks = new Map();
    this._dirCallbacks = new Map();
    this._formatDiagnosticHost = {
      getCanonicalFileName: file => file,
      getCurrentDirectory: this._ts.sys.getCurrentDirectory,
      getNewLine: () => this._ts.sys.newLine,
    };
  }

  shouldFailOnError() {
    return !!this._compilerOptions.noEmitOnError;
  }

  private start() {
    let host = this._ts.createWatchCompilerHost(
      this._findConfigFile(),
      this._compilerOptions,
      this._buildWatchHooks(),
      this._ts.createSemanticDiagnosticsBuilderProgram,
      diagnostic => this._reportDiagnostic(diagnostic),
      () => {}
    );

    let afterCreate = host.afterProgramCreate!;
    let buildComplete = () => this._reportBuildComplete();

    host.afterProgramCreate = function() {
      afterCreate.apply(this, arguments);
      process.nextTick(() => buildComplete());
    };

    if (trace.enabled) {
      host.trace = str => trace(str.trim());
    }

    this.program = this._ts.createWatchProgram(host);
  }

  fileAdded(file: string) {
    if (!file.endsWith('.ts')) {
      return;
    }

    let didTrigger = false;
    for (let [dir, callback] of this._dirCallbacks.entries()) {
      if (file.startsWith(dir)) {
        callback(file);
        didTrigger = true;
      }
    }

    if (didTrigger) {
      this._awaitBuild();
    }
  }

  fileChanged(file: string) {
    if (!file.endsWith('.ts')) {
      return;
    }

    if (this._fileCallbacks.has(file)) {
      this._fileCallbacks.get(file)!(file, this._ts.FileWatcherEventKind.Changed);
      this._awaitBuild();
    }
  }

  fileDeleted(file: string) {
    if (!file.endsWith('.ts')) {
      return;
    }

    if (this._fileCallbacks.has(file)) {
      this._fileCallbacks.get(file)!(file, this._ts.FileWatcherEventKind.Deleted);
      this._awaitBuild();
    }
  }

  build() {
    if (!this.program) {
      this.start();
      this._awaitBuild();
    }

    return this._build!.promise;
  }

  _awaitBuild() {
    if (!this._build || this._build.settled) {
      let build = (this._build = {
        settled: false as boolean,
        promise: new Promise((resolve, reject) => {
          this.once('didBuild', diagnostics => {
            if (diagnostics.length) {
              let message = this._ts.formatDiagnosticsWithColorAndContext(
                diagnostics,
                this._formatDiagnosticHost
              );
              reject(new Error(message));
            } else {
              resolve();
            }
            build.settled = true;
          });
        }),
      });

      build.promise.catch(() => {});
    }
  }

  private _reportDiagnostic(diagnostic: Diagnostic) {
    this._diagnostics.push(diagnostic);
  }

  private _reportBuildComplete() {
    this.emit('didBuild', this._diagnostics);
    this._diagnostics = [];
  }

  private _buildConfig(): CompilerOptions {
    let baseDir = path.dirname(this._findConfigFile());
    let projectConfig = this._readProjectConfig();
    let overrides = {
      noEmit: true,
      allowJs: false,
      diagnostics: trace.enabled,
      extendedDiagnostics: trace.enabled,
    };

    let commandLine = this._ts.parseJsonConfigFileContent(
      projectConfig,
      this._ts.sys,
      baseDir,
      overrides
    );
    return commandLine.options;
  }

  private _findConfigFile() {
    if (!this._configFilePath) {
      this._configFilePath = this._ts.findConfigFile(this._project.root, this._ts.sys.fileExists);
      if (!this._configFilePath) {
        throw new Error('Unable to locate tsconfig.json');
      }
    }

    return this._configFilePath;
  }

  private _readProjectConfig() {
    let result = this._ts.readConfigFile(this._findConfigFile(), this._ts.sys.readFile);
    if (result.error) {
      throw new Error(`Unable to read tsconfig.json: ${result.error.messageText}`);
    } else {
      return result.config;
    }
  }

  private _buildWatchHooks() {
    return Object.assign({}, this._ts.sys, {
      watchFile: (file: string, callback: FileWatcherCallback) => {
        this._fileCallbacks.set(file, callback);
        return { close: () => this._fileCallbacks.delete(file) };
      },
      watchDirectory: (dir: string, callback: DirectoryWatcherCallback) => {
        this._dirCallbacks.set(dir, callback);
        return { close: () => this._dirCallbacks.delete(dir) };
      },
    });
  }
}
