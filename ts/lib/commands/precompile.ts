import execa from 'execa';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import walkSync from 'walk-sync';
import { commandDefinition } from '../utilities/ember-cli-definitions';

export const PRECOMPILE_MANIFEST = 'tmp/.ts-precompile-manifest';

export default commandDefinition({
  name: 'ts:precompile',
  works: 'insideProject',
  description:
    'Generates JS and declaration files from TypeScript sources in preparation for publishing.',

  availableOptions: [{ name: 'manifest-path', type: String, default: PRECOMPILE_MANIFEST }],

  run(options: { manifestPath: string }): Promise<void> {
    let manifestPath = options.manifestPath;
    let project = this.project;
    let outDir = `${os.tmpdir()}/e-c-ts-precompile-${process.pid}`;

    // prettier-ignore
    let flags = [
      '--outDir', outDir,
      '--rootDir', project.root,
      '--allowJs', 'false',
      '--noEmit', 'false',
      '--declaration',
      '--emitDeclarationOnly',
      '--sourceMap', 'false',
      '--inlineSourceMap', 'false',
      '--inlineSources', 'false',
    ];

    // Ensure the output directory is created even if no files are generated
    fs.mkdirsSync(outDir);

    return execa('tsc', flags).then(() => {
      let output: string[] = [];
      for (let declSource of walkSync(outDir, { globs: ['**/*.d.ts'] })) {
        if (this._shouldCopy(declSource)) {
          // We can only do anything meaningful with declarations for files in addon/ or src/
          if (this._isAddonFile(declSource)) {
            let declDest = declSource
              .replace(/^addon\//, '')
              .replace(/^addon-test-support/, 'test-support');
            this._copyFile(output, `${outDir}/${declSource}`, declDest);
          } else if (this._isSrcFile(declSource)) {
            this._copyFile(output, `${outDir}/${declSource}`, declSource);
          }
        }
      }

      fs.mkdirsSync(path.dirname(manifestPath));
      fs.writeFileSync(manifestPath, JSON.stringify(output.reverse()));
      fs.remove(outDir);
    });
  },

  _shouldCopy(source: string): boolean {
    return this._isAppFile(source)
      || this._isAddonFile(source)
      || this._isSrcFile(source);
  },

  _isAppFile(source: string): boolean {
    return source.indexOf('app') === 0;
  },

  _isAddonFile(source: string): boolean {
    return source.indexOf('addon') === 0;
  },

  _isSrcFile(source: string): boolean {
    return source.indexOf('src') === 0;
  },

  _copyFile(output: string[], source: string, dest: string) {
    let segments = dest.split(/\/|\\/);

    // Make (and record the making of) any missing directories
    for (let i = 1; i < segments.length; i++) {
      let dir = segments.slice(0, i).join('/');
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
        output.push(`${dir}/`);
      }
    }

    fs.writeFileSync(dest, fs.readFileSync(source));
    output.push(dest);
  },
});
