import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AddDomainPayload {
  domain: string;     // e.g. "blog.cliente.com.br"
  tenantId?: string;  // optional, for audit log
}

interface VercelDomainResult {
  success: boolean;
  alreadyExists?: boolean;
  configured?: boolean;
  cname?: string;
  message?: string;
}

/**
 * Adiciona um domínio customizado ao projeto Vercel via API.
 * Deve ser chamada após verificação DNS bem-sucedida.
 * 
 * Variáveis de ambiente necessárias no Supabase:
 *   VERCEL_TOKEN       - Token de API da Vercel (Bearer)
 *   VERCEL_PROJECT_ID  - ID do projeto Vercel (prj_xxx)
 */
async function addDomainToVercel(domain: string): Promise<VercelDomainResult> {
  const token = Deno.env.get("VERCEL_TOKEN");
  const projectId = Deno.env.get("VERCEL_PROJECT_ID");

  if (!token || !projectId) {
    console.error("[add-vercel-domain] Missing VERCEL_TOKEN or VERCEL_PROJECT_ID");
    return {
      success: false,
      message: "Configuração da Vercel ausente. Contate o suporte.",
    };
  }

  try {
    const response = await fetch(
      `https://api.vercel.com/v10/projects/${projectId}/domains`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: domain }),
      }
    );

    const data = await response.json();
    console.log(`[add-vercel-domain] HTTP ${response.status} for domain: ${domain}`, data);

    // 200/201 = sucesso
    if (response.ok) {
      return {
        success: true,
        configured: true,
        cname: "cname.vercel-dns.com",
        message: `Domínio ${domain} registrado na Vercel com sucesso.`,
      };
    }

    // 409 = domínio já existe no projeto (ok — idempotente)
    if (response.status === 409) {
      return {
        success: true,
        alreadyExists: true,
        cname: "cname.vercel-dns.com",
        message: `Domínio ${domain} já estava registrado na Vercel.`,
      };
    }

    // 403 = domínio pertence a outro projeto na Vercel
    if (response.status === 403) {
      return {
        success: false,
        message: `O domínio ${domain} já está em uso em outra conta Vercel. Remova o domínio de outros projetos primeiro.`,
      };
    }

    // Outros erros
    return {
      success: false,
      message: data?.error?.message || `Erro Vercel: HTTP ${response.status}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[add-vercel-domain] Fetch error:", err);
    return { success: false, message: `Erro de conexão com a Vercel: ${msg}` };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Autenticar o usuário via JWT do Supabase
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, message: "Não autorizado." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { domain, tenantId } = (await req.json()) as AddDomainPayload;

    if (!domain || typeof domain !== "string") {
      return new Response(
        JSON.stringify({ success: false, message: "Campo 'domain' obrigatório." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalizar domínio
    const cleanDomain = domain.toLowerCase().trim().replace(/^https?:\/\//, "").replace(/\/$/, "");

    console.log(`[add-vercel-domain] User ${user.id} requesting domain: ${cleanDomain}`);

    const result = await addDomainToVercel(cleanDomain);

    // Log no Supabase via service role para auditoria
    if (tenantId) {
      const serviceClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );
      await serviceClient.from("tenant_domains").upsert({
        domain: cleanDomain,
        tenant_id: tenantId,
        domain_type: "custom",
        status: result.success ? "vercel_registered" : "vercel_error",
        updated_at: new Date().toISOString(),
      }, { onConflict: "domain,tenant_id" }).select().maybeSingle();
    }

    return new Response(
      JSON.stringify(result),
      {
        status: result.success ? 200 : 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("[add-vercel-domain] Unexpected error:", err);
    return new Response(
      JSON.stringify({ success: false, message: "Erro interno." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
