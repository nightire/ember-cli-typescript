import { describe, beforeEach, afterEach, it } from 'mocha';
import { expect } from 'ember-cli-blueprint-test-helpers/chai';
import SkeletonApp from '../helpers/skeleton-app';
import { parseScript } from 'esprima';
import { BlockStatement } from 'estree';

describe('Acceptance: build', function() {
  this.timeout(30 * 1000);

  let app: SkeletonApp;
  beforeEach(() => {
    app = new SkeletonApp();
  });

  afterEach(() => {
    app.teardown();
  });

  it('builds and rebuilds files', async () => {
    app.writeFile('app/app.ts', `
      export function add(a: number, b: number) {
        return a + b;
      }
    `);

    let server = app.serve();

    await server.waitForBuild();

    expectModuleBody(app, 'skeleton-app/app', `
      _exports.add = add;
      function add(a, b) {
        return a + b;
      }
    `);

    app.writeFile('app/app.ts', `
      export const foo: string = 'hello';
    `);

    await server.waitForBuild();

    expectModuleBody(app, 'skeleton-app/app', `
      _exports.foo = void 0;
      var foo = 'hello';
      _exports.foo = foo;
    `);
  });

  it('fails the build when noEmitOnError is set and an error is emitted', async function() {
    app.writeFile('app/app.ts', `import { foo } from 'nonexistent';`);

    await expect(app.build()).to.be.rejectedWith(`Cannot find module 'nonexistent'`);
  });
});

function extractModuleBody(script: string, moduleName: string): BlockStatement {
  let parsed = parseScript(script);
  let definition = parsed.body
    .filter(stmt => stmt.type === 'ExpressionStatement')
    .map(stmt => (stmt as any).expression)
    .find(expr =>
        expr.type === 'CallExpression' &&
        expr.callee.type === 'Identifier' &&
        expr.callee.name === 'define' &&
        expr.arguments &&
        expr.arguments[0] &&
        expr.arguments[0].type === 'Literal' &&
        expr.arguments[0].value === moduleName);

  let moduleDef = definition.arguments[2].body;

  // Strip `'use strict'`
  moduleDef.body.shift();

  // Strip `__esModule` definition
  moduleDef.body.shift();

  return moduleDef;
}

function expectModuleBody(app: SkeletonApp, name: string, body: string) {
  let src = app.readFile('dist/assets/skeleton-app.js');
  let actual = extractModuleBody(src, name);
  let expected = parseScript(body);
  expect(actual.body).to.deep.equal(expected.body);
}
