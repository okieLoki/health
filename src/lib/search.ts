/**
 * Web search via Parallel's hosted MCP endpoint.
 *
 * Gemini's Google Search grounding is capped at roughly twenty requests a day
 * on the free tier, which is nowhere near enough to check branded nutrition
 * facts. Parallel's search MCP is free, needs no key, and answers in about two
 * seconds, so it does the looking up instead.
 *
 * It speaks plain JSON-RPC over HTTP, so no MCP client library is needed.
 */
const MCP_URL = process.env.PARALLEL_MCP_URL || "https://search.parallel.ai/mcp";

export type SearchHit = { title: string; uri: string; excerpt: string };
export type SearchResult = { text: string; sources: { title: string; uri: string }[] };

/** The endpoint answers as plain JSON or as a single SSE frame. */
function parseBody(raw: string): unknown {
  if (!raw.startsWith("event:") && !raw.startsWith("data:")) return JSON.parse(raw);
  const line = raw.split("\n").find((l) => l.startsWith("data:"));
  if (!line) throw new Error("no data frame");
  return JSON.parse(line.slice(5).trim());
}

/** Returns null on any failure, so a lookup never fails the log it serves. */
export async function webSearch(
  objective: string,
  queries: string[],
): Promise<SearchResult | null> {
  try {
    const res = await fetch(MCP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        ...(process.env.PARALLEL_API_KEY
          ? { Authorization: `Bearer ${process.env.PARALLEL_API_KEY}` }
          : {}),
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "web_search",
          arguments: { objective, search_queries: queries.slice(0, 3) },
        },
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;

    const data = parseBody(await res.text()) as {
      result?: { content?: { text?: string }[] };
    };
    const blob = data.result?.content?.map((c) => c.text ?? "").join("\n") ?? "";
    if (!blob.trim()) return null;

    let parsed: { results?: { url?: string; title?: string; excerpts?: string[] }[] };
    try {
      parsed = JSON.parse(blob);
    } catch {
      // Some responses come back as prose rather than JSON; still usable.
      return { text: blob.slice(0, 6000), sources: [] };
    }

    const hits: SearchHit[] = (parsed.results ?? [])
      .filter((r) => r.url)
      .slice(0, 5)
      .map((r) => ({
        title: r.title ?? new URL(r.url!).hostname,
        uri: r.url!,
        // Excerpts are long; the model only needs the nutrition panel.
        excerpt: (r.excerpts ?? []).join(" ").replace(/\s+/g, " ").slice(0, 1200),
      }));

    if (!hits.length) return null;

    return {
      text: hits.map((h) => `SOURCE: ${h.title} (${h.uri})\n${h.excerpt}`).join("\n\n"),
      sources: hits.map((h) => ({ title: h.title, uri: h.uri })),
    };
  } catch {
    return null;
  }
}

export const searchConfigured = () => true; // anonymous access needs no key
