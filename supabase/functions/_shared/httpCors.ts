/**
 * CORS helpers for Edge Functions.
 *
 * Set ALLOWED_CORS_ORIGINS in Supabase secrets (comma-separated origins), e.g.:
 *   https://app.automarticles.com,https://app.omniseen.app
 *
 * If unset, falls back to "*" for backward compatibility (dev / legacy clients).
 */
const DEFAULT_ALLOW_HEADERS =
  "authorization, x-client-info, apikey, content-type, x-cron-secret";

export function corsHeadersForRequest(req: Request, extraAllowHeaders?: string): Record<string, string> {
  const allowHeaders = extraAllowHeaders
    ? `${DEFAULT_ALLOW_HEADERS}, ${extraAllowHeaders}`
    : DEFAULT_ALLOW_HEADERS;

  const raw = Deno.env.get("ALLOWED_CORS_ORIGINS");
  const allowed = raw?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  const origin = req.headers.get("Origin");

  let allowOrigin = "*";
  if (allowed.length > 0) {
    if (origin && allowed.includes(origin)) {
      allowOrigin = origin;
    } else if (!origin) {
      // Non-browser callers (cron, server-to-server) — reflect first allowed host
      allowOrigin = allowed[0]!;
    } else {
      allowOrigin = "null";
    }
  }

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": allowHeaders,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}
