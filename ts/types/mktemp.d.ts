declare module 'mktemp' {
  export function createFileSync(pattern: string): string;
  export function createDirSync(pattern: string): string;
}
