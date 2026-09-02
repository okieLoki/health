import { requireUser } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { getMealPhoto, keyBelongsTo, storageConfigured } from "@/lib/storage";

export const runtime = "nodejs";

/** Meal photos stay in a private R2 bucket and are served only to their owner. */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  try {
    const user = await requireUser();
    if (!storageConfigured()) return new Response("Storage not configured", { status: 501 });

    const key = (await params).key.join("/");
    if (!keyBelongsTo(key, user.id)) return new Response("Not found", { status: 404 });

    const { body, contentType } = await getMealPhoto(key);
    if (!body) return new Response("Not found", { status: 404 });

    return new Response(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
