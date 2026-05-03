export interface PageRef {
  index: number;
  name: string;
}

export interface Extractor {
  /** Total page count (cheap call, may open and close handle). */
  count(filePath: string): Promise<number>;
  /** List page names ordered naturally. */
  list(filePath: string): Promise<PageRef[]>;
  /** Load the raw bytes of a page (image). */
  page(filePath: string, index: number): Promise<Buffer>;
}
