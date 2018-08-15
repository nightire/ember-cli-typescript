declare module 'broccoli-plugin' {
  export default class Plugin {
    constructor(nodes: Array<string | object>, options?: Record<string, any>);
  }
}
