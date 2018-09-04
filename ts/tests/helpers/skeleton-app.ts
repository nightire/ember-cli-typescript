import fs from 'fs-extra';
import path from 'path';
import * as mktemp from 'mktemp';
import execa, { ExecaChildProcess } from 'execa';
import EventEmitter from 'events';
import { fixturePath } from './fixtures';

export default class SkeletonApp {
  private watched?: WatchedBuild;
  private rootDir: string;

  constructor() {
    this.rootDir = mktemp.createDirSync('test-skeleton-app-XXXXXX');
    fs.copySync(fixturePath('skeleton-app'), this.rootDir);
  }

  build() {
    return this.ember(['build']);
  }

  serve() {
    if (this.watched) {
      throw new Error('Already serving');
    }

    return this.watched = new WatchedBuild(this.ember(['serve']));
  }

  updatePackageJSON(callback: (json: any) => any) {
    let pkgPath = `${this.rootDir}/package.json`;
    let pkg = fs.readJSONSync(pkgPath);
    fs.writeJSONSync(pkgPath, callback(pkg) || pkg, { spaces: 2 });
  }

  writeFile(filePath: string, contents: string) {
    let fullPath = `${this.rootDir}/${filePath}`;
    fs.ensureDirSync(path.dirname(fullPath));
    fs.writeFileSync(fullPath, contents, 'utf-8');
  }

  readFile(path: string) {
    return fs.readFileSync(`${this.rootDir}/${path}`, 'utf-8');
  }

  removeFile(path: string) {
    return fs.unlinkSync(`${this.rootDir}/${path}`);
  }

  teardown() {
    if (this.watched) {
      this.watched.kill();
    }

    this.cleanupRootDir({ retries: 1 });
  }

  private ember(args: string[]) {
    let ember = require.resolve('ember-cli/bin/ember');
    return execa('node', [ember].concat(args), { cwd: this.rootDir });
  }

  private cleanupRootDir(options?: { retries?: number }) {
    let retries = options && options.retries || 0;

    try {
      fs.removeSync(this.rootDir);
    } catch (error) {
      if (retries > 0) {
        // Windows doesn't necessarily kill the process immediately, so
        // leave a little time before trying to remove the directory.
        setTimeout(() => this.cleanupRootDir({ retries: retries - 1 }), 250);
      } else {
        // eslint-disable-next-line no-console
        console.warn(`Warning: unable to remove skeleton-app tmpdir ${this.rootDir} (${error.code})`);
      }
    }
  }
}

class WatchedBuild extends EventEmitter {
  constructor(private ember: ExecaChildProcess) {
    super();

    ember.stdout.on('data', (data) => {
      let output = data.toString();
      if (output.includes('Build successful')) {
        this.emit('did-rebuild');
      }
    });

    ember.catch((error) => {
      this.emit('did-error', error);
    });
  }

  waitForBuild() {
    return new Promise((resolve, reject) => {
      this.once('did-rebuild', resolve);
      this.once('did-error', reject);
    });
  }

  kill() {
    this.ember.kill();
  }
}
