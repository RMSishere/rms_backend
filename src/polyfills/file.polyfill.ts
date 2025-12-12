// Polyfill File API for Node 18 (Heroku)
if (typeof (global as any).File === 'undefined') {
  class FilePolyfill extends Blob {
    name: string;
    lastModified: number;

    constructor(chunks: any[], filename: string, options: any = {}) {
      super(chunks, options);
      this.name = filename;
      this.lastModified = options.lastModified || Date.now();
    }
  }

  (global as any).File = FilePolyfill;
}
