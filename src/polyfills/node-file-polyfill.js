// This must be JS to run before Nest starts.
// Polyfill File API for Node 18 (Heroku crash fix)

if (global.File === undefined) {
  class FilePolyfill extends Blob {
    constructor(chunks, filename, options = {}) {
      super(chunks, options);
      this.name = filename;
      this.lastModified = options.lastModified || Date.now();
    }
  }

  global.File = FilePolyfill;
}
