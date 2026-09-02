import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

/**
 * Cloudflare R2, 10 GB free and no egress charges, S3-compatible.
 * The bucket stays private; photos are served back through /api/photos/[key]
 * behind the same session check as everything else.
 */
const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET;

export const storageConfigured = () =>
  Boolean(accountId && accessKeyId && secretAccessKey && bucket);

let client: S3Client | null = null;
function s3(): S3Client {
  if (!storageConfigured()) throw new Error("R2 is not configured");
  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
  });
  return client;
}

const EXT: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/heic": "heic",
};

/** Returns the object key, or null when storage isn't set up (photo is dropped). */
export async function putMealPhoto(
  userId: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<string | null> {
  if (!storageConfigured()) return null;
  const key = `meals/${userId}/${Date.now()}-${crypto.randomUUID()}.${EXT[contentType] ?? "bin"}`;
  await s3().send(
    new PutObjectCommand({
      Bucket: bucket!,
      Key: key,
      Body: bytes,
      ContentType: contentType,
      CacheControl: "private, max-age=31536000, immutable",
    }),
  );
  return key;
}

export async function getMealPhoto(key: string) {
  const res = await s3().send(new GetObjectCommand({ Bucket: bucket!, Key: key }));
  return {
    body: res.Body as ReadableStream | undefined,
    contentType: res.ContentType ?? "application/octet-stream",
  };
}

/** Keys are user-scoped by construction; verify before serving anything. */
export function keyBelongsTo(key: string, userId: string): boolean {
  return key.startsWith(`meals/${userId}/`);
}
