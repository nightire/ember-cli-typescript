declare module 'console-ui' {
  export = UI;
  type WriteLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
  class UI {
    write(message: string, level: WriteLevel): void;
    writeWarnLine(message: string): void;
  }
}
