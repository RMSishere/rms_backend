// Polyfill File for Node 18 (Heroku fix)
if (global.File === undefined) {
  class FilePolyfill extends Blob {
    constructor(chunks, name, options = {}) {
      super(chunks, options);
      this.name = name;
      this.lastModified = options.lastModified || Date.now();
    }
  }

  global.File = FilePolyfill;
}
