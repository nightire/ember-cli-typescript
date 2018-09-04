declare module 'core-object' {
  type Constructor<T> = new (...args: any[]) => T;

  export = CoreObject;
  class CoreObject {
    constructor(...params: any[]);

    _super: this;

    static extend<Super extends Constructor<any>, T>(
      this: Super,
      subclassProto: T & ThisType<T & InstanceType<Super>>
    ): Constructor<T & InstanceType<Super>> & Super;
  }
}
