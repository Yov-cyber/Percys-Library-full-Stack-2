// Natural alphanumeric sort — "page2.jpg" before "page10.jpg".
export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export function isImageName(name: string): boolean {
  // Support common image formats for comics
  return /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif|tiff?)$/i.test(name);
}
