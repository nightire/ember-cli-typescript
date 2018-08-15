declare module 'core-object' {
  type Constructor<T> = new (...args: any[]) => T;

  export = CoreObject;
  class CoreObject {
    constructor(...params: any[]);

    static extend<Super extends Constructor<any>, T>(
      this: Super,
      subclassProto: T
    ): Constructor<T & InstanceType<Super>> & Super;
  }
}
