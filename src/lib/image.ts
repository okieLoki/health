import sharp from "sharp";

/**
 * Meal photos are read once by the model and then only ever glanced at in a
 * list, so full-resolution originals are pure waste. 1024px WebP keeps a plate
 * perfectly legible at roughly 1-2% of a modern phone photo's size, the
 * difference between ~2,500 and ~100,000 meals inside R2's free 10 GB.
 *
 * The compressed bytes are what we send to Gemini too, which cuts image
 * tokens and upload latency on the same pass.
 */
const MAX_EDGE = 1024;
const QUALITY = 72;

export type CompressedImage = {
  bytes: Uint8Array;
  contentType: string;
  bytesBefore: number;
  bytesAfter: number;
  width?: number;
  height?: number;
};

export async function compressMealPhoto(
  input: Uint8Array,
  originalType: string,
): Promise<CompressedImage> {
  try {
    const pipeline = sharp(input, { failOn: "none" })
      .rotate() // honour the EXIF orientation before stripping metadata
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: QUALITY, effort: 4 });

    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
    return {
      bytes: new Uint8Array(data),
      contentType: "image/webp",
      bytesBefore: input.byteLength,
      bytesAfter: data.byteLength,
      width: info.width,
      height: info.height,
    };
  } catch {
    // HEIC without libheif, a corrupt file, anything, keep the original
    // rather than losing the user's log over a compression failure.
    return {
      bytes: input,
      contentType: originalType,
      bytesBefore: input.byteLength,
      bytesAfter: input.byteLength,
    };
  }
}
