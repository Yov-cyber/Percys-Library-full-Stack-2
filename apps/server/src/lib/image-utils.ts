import sharp from "sharp";

export async function makeThumbnail(input: Buffer, width: number): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
}

export async function autoCropWhiteMargins(input: Buffer): Promise<Buffer> {
  return sharp(input).trim({ background: "white", threshold: 18 }).toBuffer();
}

/**
 * Recompress a page through Sharp at the requested quality tier:
 *  - "high"      → original buffer (no recompress; fast path)
 *  - "balanced"  → resize to max 1600px wide, WebP q=80
 *  - "fast"      → resize to max 1100px wide, WebP q=68
 *
 * Used to give users a knob for memory-constrained or slow-connection
 * scenarios when reading mangas / manhwas / huge PDFs. The resulting
 * buffer is always at least as small as the input — when in doubt we
 * just return the source.
 */
export async function recompressForQuality(
  input: Buffer,
  tier: "high" | "balanced" | "fast",
): Promise<Buffer> {
  if (tier === "high") return input;
  const targetWidth = tier === "balanced" ? 1600 : 1100;
  const quality = tier === "balanced" ? 80 : 68;
  try {
    const out = await sharp(input)
      .rotate()
      .resize({ width: targetWidth, withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();
    return out.length < input.length ? out : input;
  } catch {
    return input;
  }
}

export function detectMime(buf: Buffer): string {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf.length >= 12 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return "image/webp";
  if (buf.length >= 6 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "image/gif";
  return "application/octet-stream";
}
