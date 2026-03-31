import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { encode as encodeHex } from "https://deno.land/std@0.168.0/encoding/hex.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

type WebhookEvent =
  | "article.published"
  | "article.updated"
  | "article.deleted"
  | "article.generated"
  | "lead.created"
  | "seo.score_changed";

interface WebhookPayload {
  blog_id: string;
  event: WebhookEvent;
  data: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { blog_id, event, data } = await req.json() as WebhookPayload;

    if (!blog_id || !event) {
      return new Response(
        JSON.stringify({ error: "Missing blog_id or event" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: endpoints, error: endpointsError } = await supabase
      .from("webhook_endpoints")
      .select("*")
      .eq("blog_id", blog_id)
      .eq("is_active", true)
      .contains("events", [event]);

    if (endpointsError) {
      console.error("[dispatch-webhook] Error fetching endpoints:", endpointsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch webhook endpoints" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!endpoints || endpoints.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active webhooks for this event", event }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const timestamp = new Date().toISOString();
    const payload = JSON.stringify({
      event,
      timestamp,
      blog_id,
      data,
    });

    const results = await Promise.allSettled(
      endpoints.map(async (endpoint: any) => {
        const signature = await signPayload(payload, endpoint.secret || "");

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "X-Webhook-Event": event,
          "X-Webhook-Timestamp": timestamp,
          "X-Webhook-Signature": signature,
        };

        let lastError = "";
        let success = false;
        const maxRetries = endpoint.max_retries || 3;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            const res = await fetch(endpoint.url, {
              method: "POST",
              headers,
              body: payload,
              signal: AbortSignal.timeout(10000),
            });

            if (res.ok) {
              success = true;
              break;
            }
            lastError = `HTTP ${res.status}: ${await res.text().catch(() => "No body")}`;
          } catch (err) {
            lastError = err instanceof Error ? err.message : "Unknown error";
          }

          if (attempt < maxRetries) {
            await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
          }
        }

        await supabase.from("webhook_delivery_logs").insert({
          webhook_endpoint_id: endpoint.id,
          blog_id,
          event,
          payload,
          status: success ? "delivered" : "failed",
          error_message: success ? null : lastError,
          attempts: maxRetries + 1,
          delivered_at: success ? new Date().toISOString() : null,
        });

        return { endpoint_id: endpoint.id, success, error: success ? null : lastError };
      })
    );

    const summary = results.map((r) =>
      r.status === "fulfilled" ? r.value : { success: false, error: "Promise rejected" }
    );

    return new Response(
      JSON.stringify({ success: true, deliveries: summary }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[dispatch-webhook] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function signPayload(payload: string, secret: string): Promise<string> {
  if (!secret) return "";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return `sha256=${Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}
