export class Directory {
  uri: string;
  exists = true;
  constructor(...parts: unknown[]) {
    this.uri = parts.map((p) => (typeof p === 'string' ? p : (p as { uri: string }).uri)).join('/');
  }
  create() {}
}
export class File extends Directory {}
export const Paths = { document: new Directory('file:///Documents') };
