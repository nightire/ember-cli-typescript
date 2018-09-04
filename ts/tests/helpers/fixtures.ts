import fs from 'fs';

const FIXTURES = `${__dirname}/../../../ts/tests/fixtures`;

export function fixturePath(path: string): string {
  return `${FIXTURES}/${path}`;
}

export function fixture(path: string): string {
  return fs.readFileSync(fixturePath(path), 'utf-8');
}
