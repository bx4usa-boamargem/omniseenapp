import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Expected DNS values for routing
const EXPECTED_A_IP = "185.158.133.1";
const EXPECTED_CNAME = "cname.lovableproject.com";
const ALTERNATIVE_CNAME = "cname.omniseen.app";

// Helper function to query DNS
async function queryDns(name: string, type: string): Promise<{ Answer?: Array<{ data: string }> }> {
  const dnsUrl = `https://cloudflare-dns.com/dns-query?name=${name}&type=${type}`;
  const response = await fetch(dnsUrl, {
    headers: { Accept: "application/dns-json" },
  });
  if (!response.ok) {
    return {};
  }
  return response.json();
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { blogId } = await req.json();

    if (!blogId) {
      return new Response(
        JSON.stringify({ error: "blogId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Verifying domain for blog: ${blogId}`);

    // Fetch blog data
    const { data: blog, error: blogError } = await supabase
      .from("blogs")
      .select("custom_domain, domain_verification_token")
      .eq("id", blogId)
      .single();

    if (blogError || !blog) {
      console.error("Blog not found:", blogError);
      return new Response(
        JSON.stringify({ error: "Blog not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!blog.custom_domain) {
      return new Response(
        JSON.stringify({ verified: false, message: "No custom domain configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const domain = blog.custom_domain;
    console.log(`Checking DNS for domain: ${domain}`);

    // 1. Check TXT record for ownership verification
    const txtRecordName = `_omniseen-verify.${domain}`;
    const txtData = await queryDns(txtRecordName, "TXT");
    
    let txtVerified = false;
    const txtFound: string[] = [];
    if (txtData.Answer) {
      for (const answer of txtData.Answer) {
        const txtValue = answer.data?.replace(/"/g, "");
        txtFound.push(txtValue);
        if (txtValue === blog.domain_verification_token) {
          txtVerified = true;
        }
      }
    }
    console.log(`TXT check: verified=${txtVerified}, found=${txtFound.join(", ")}`);

    // 2. Check A record for routing
    const aData = await queryDns(domain, "A");
    let aVerified = false;
    const aFound: string[] = [];
    if (aData.Answer) {
      for (const answer of aData.Answer) {
        aFound.push(answer.data);
        if (answer.data === EXPECTED_A_IP) {
          aVerified = true;
        }
      }
    }
    console.log(`A record check: verified=${aVerified}, found=${aFound.join(", ")}`);

    // 3. Check CNAME record for routing (alternative to A)
    const cnameData = await queryDns(domain, "CNAME");
    let cnameVerified = false;
    const cnameFound: string[] = [];
    if (cnameData.Answer) {
      for (const answer of cnameData.Answer) {
        const cname = answer.data?.replace(/\.$/, ""); // Remove trailing dot
        cnameFound.push(cname);
        if (cname === EXPECTED_CNAME || cname === ALTERNATIVE_CNAME) {
          cnameVerified = true;
        }
      }
    }
    console.log(`CNAME check: verified=${cnameVerified}, found=${cnameFound.join(", ")}`);

    // Routing is OK if either A or CNAME is correct
    const routingVerified = aVerified || cnameVerified;
    
    // Full verification requires TXT (ownership) + routing (A or CNAME)
    const fullyVerified = txtVerified && routingVerified;

    // Build detailed response
    const dnsStatus = {
      txt: { verified: txtVerified, found: txtFound, expected: blog.domain_verification_token },
      a: { verified: aVerified, found: aFound, expected: EXPECTED_A_IP },
      cname: { verified: cnameVerified, found: cnameFound, expected: EXPECTED_CNAME },
      routingVerified,
    };

    if (fullyVerified) {
      // Update blog as verified
      const { error: updateError } = await supabase
        .from("blogs")
        .update({ domain_verified: true })
        .eq("id", blogId);

      if (updateError) {
        console.error("Error updating blog:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to update verification status" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Domain ${domain} verified successfully`);

      return new Response(
        JSON.stringify({
          verified: true,
          message: "Domínio verificado com sucesso! Seu blog está pronto.",
          dnsStatus,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build specific error message
    const issues: string[] = [];
    if (!txtVerified) {
      issues.push("Registro TXT de verificação não encontrado ou incorreto");
    }
    if (!routingVerified) {
      if (aFound.length > 0 && !aVerified) {
        issues.push(`Registro A aponta para ${aFound.join(", ")} em vez de ${EXPECTED_A_IP}`);
      } else if (cnameFound.length === 0 && aFound.length === 0) {
        issues.push(`Configure o registro A para ${EXPECTED_A_IP} ou CNAME para ${EXPECTED_CNAME}`);
      }
    }

    console.log(`Domain ${domain} verification incomplete: ${issues.join("; ")}`);

    return new Response(
      JSON.stringify({
        verified: false,
        message: issues.length > 0 
          ? issues.join(". ") + ". Aguarde a propagação do DNS (até 48h)."
          : "Configuração DNS incompleta. Verifique os registros e aguarde a propagação.",
        dnsStatus,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in verify-domain:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
