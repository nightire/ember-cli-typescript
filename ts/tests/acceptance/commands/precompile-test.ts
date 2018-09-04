'use strict';

import { describe, beforeEach, it } from 'mocha';
import { expect, file } from 'ember-cli-blueprint-test-helpers/chai';

import fs from 'fs-extra';
import ember from 'ember-cli-blueprint-test-helpers/lib/helpers/ember';
import { setupTestHooks, emberNew } from 'ember-cli-blueprint-test-helpers/helpers';

describe('Acceptance: ts:precompile command', function() {
  setupTestHooks(this);

  beforeEach(async () => {
    await emberNew({ target: 'addon' });
    await ember(['generate', 'ember-cli-typescript']);
  });

  it('emits .d.ts files from the addon tree', async () => {
    fs.ensureDirSync('addon');
    fs.writeFileSync('addon/test-file.ts', `export const testString: string = 'hello';`);

    await ember(['ts:precompile']);

    let declaration = file('test-file.d.ts');
    expect(declaration).to.exist;
    expect(declaration.content.trim()).to.equal(`export declare const testString: string;`);
  });

  it('emits no .d.ts files from the app tree', async () => {
    fs.ensureDirSync('app');
    fs.writeFileSync('app/test-file.ts', `export const testString: string = 'hello';`);

    await ember(['ts:precompile']);

    let declaration = file('test-file.d.ts');
    expect(declaration).not.to.exist;
  });

  describe('module unification', () => {
    it('emits .d.ts files from the src tree', async () => {
      fs.ensureDirSync('src');
      fs.writeFileSync('src/test-file.ts', `export const testString: string = 'hello';`);

      let tsconfig = fs.readJSONSync('tsconfig.json');
      tsconfig.include.push('src');
      fs.writeJSONSync('tsconfig.json', tsconfig);

      await ember(['ts:precompile']);

      let declaration = file('src/test-file.d.ts');
      expect(declaration).to.exist;
      expect(declaration.content.trim()).to.equal(`export declare const testString: string;`);
    });
  });
});
