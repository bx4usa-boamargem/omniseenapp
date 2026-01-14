import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface RequestBody {
  blog_id: string;
  article_id?: string;
  article_title?: string;
  visitor_id: string;
  session_id: string;
  message: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}

interface LeadData {
  name?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  interest_summary?: string;
  lead_score?: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: RequestBody = await req.json();
    const { blog_id, article_id, article_title, visitor_id, session_id, message, utm_source, utm_medium, utm_campaign } = body;

    if (!blog_id || !visitor_id || !session_id || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: blog_id, visitor_id, session_id, message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Get agent configuration
    const { data: agentConfig, error: configError } = await supabase
      .from("brand_agent_config")
      .select("*")
      .eq("blog_id", blog_id)
      .maybeSingle();

    if (configError) {
      console.error("Error fetching agent config:", configError);
      throw new Error("Failed to fetch agent configuration");
    }

    if (!agentConfig || !agentConfig.is_enabled) {
      return new Response(
        JSON.stringify({ error: "Brand agent is not enabled for this blog" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Check daily token limit (reset if needed)
    const today = new Date().toISOString().split('T')[0];
    const resetDate = agentConfig.tokens_reset_at ? new Date(agentConfig.tokens_reset_at).toISOString().split('T')[0] : null;
    
    let tokensUsedToday = agentConfig.tokens_used_today || 0;
    
    if (resetDate !== today) {
      // Reset tokens for new day
      await supabase
        .from("brand_agent_config")
        .update({ tokens_used_today: 0, tokens_reset_at: new Date().toISOString() })
        .eq("id", agentConfig.id);
      tokensUsedToday = 0;
    }

    if (tokensUsedToday >= agentConfig.max_tokens_per_day) {
      return new Response(
        JSON.stringify({ 
          error: "Limite diário de atendimento atingido. Tente novamente amanhã!",
          limit_reached: true 
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Get business profile and client strategy for context
    const [businessProfileResult, clientStrategyResult, blogResult] = await Promise.all([
      supabase.from("business_profile").select("*").eq("blog_id", blog_id).maybeSingle(),
      supabase.from("client_strategy").select("*").eq("blog_id", blog_id).maybeSingle(),
      supabase.from("blogs").select("name, primary_color, cta_text, cta_url").eq("id", blog_id).single()
    ]);

    const businessProfile = businessProfileResult.data;
    const clientStrategy = clientStrategyResult.data;
    const blog = blogResult.data;

    // 4. Get or create conversation
    let { data: conversation, error: convError } = await supabase
      .from("brand_agent_conversations")
      .select("*")
      .eq("blog_id", blog_id)
      .eq("visitor_id", visitor_id)
      .eq("session_id", session_id)
      .maybeSingle();

    if (convError && convError.code !== "PGRST116") {
      console.error("Error fetching conversation:", convError);
    }

    const existingMessages: ChatMessage[] = conversation?.messages || [];

    if (!conversation) {
      // Create new conversation
      const { data: newConv, error: createError } = await supabase
        .from("brand_agent_conversations")
        .insert({
          blog_id,
          article_id: article_id || null,
          visitor_id,
          session_id,
          messages: [],
        })
        .select()
        .single();

      if (createError) {
        console.error("Error creating conversation:", createError);
        throw new Error("Failed to create conversation");
      }
      conversation = newConv;
    }

    // 5. Build system prompt
    const companyName = businessProfile?.company_name || clientStrategy?.empresa_nome || blog?.name || "Empresa";
    const city = businessProfile?.city || clientStrategy?.regiao_atuacao || "";
    const services = businessProfile?.services || clientStrategy?.o_que_oferece || "";
    const niche = businessProfile?.niche || clientStrategy?.tipo_negocio || "";
    const targetAudience = businessProfile?.target_audience || clientStrategy?.tipo_publico || "";
    const differentials = clientStrategy?.diferenciais?.join(", ") || businessProfile?.brand_keywords?.join(", ") || "";
    const toneOfVoice = businessProfile?.tone_of_voice || "profissional e acolhedor";
    const whatsapp = businessProfile?.whatsapp || "";
    const painPoints = clientStrategy?.dor_principal || "";
    const desires = clientStrategy?.desejo_principal || "";
    const benefits = clientStrategy?.principais_beneficios?.join(", ") || "";
    const conversionGoals = agentConfig.conversion_goals?.join(", ") || "lead";
    const agentName = agentConfig.agent_name || "Consultor";

    const systemPrompt = `Você é ${agentName}, consultor comercial da ${companyName}.
${city ? `Localização: ${city}` : ""}
${services ? `Serviços: ${services}` : ""}
${niche ? `Segmento: ${niche}` : ""}

## SUA IDENTIDADE
- Você FAZ PARTE da equipe da ${companyName}
- Sempre fale como "nós", "nossa equipe", "nosso atendimento"
- Seu nome é ${agentName}
- Tom de voz: ${toneOfVoice}

## CONHECIMENTO DO NEGÓCIO
${targetAudience ? `- Público-alvo: ${targetAudience}` : ""}
${differentials ? `- Diferenciais: ${differentials}` : ""}
${benefits ? `- Benefícios: ${benefits}` : ""}
${painPoints ? `- Dor que resolvemos: ${painPoints}` : ""}
${desires ? `- Desejo que atendemos: ${desires}` : ""}

## REGRAS ABSOLUTAS
1. NUNCA diga que é uma IA, assistente virtual ou robô
2. NUNCA mencione Omniseen, plataforma ou tecnologia
3. NUNCA invente informações sobre preços, prazos ou garantias que não foram fornecidas
4. Responda de forma natural, como um vendedor experiente
5. Faça perguntas para entender a necessidade do cliente
6. Seja empático e consultivo, não agressivo
7. Mantenha respostas curtas e objetivas (máximo 3 parágrafos)

## OBJETIVO DE CONVERSÃO
Seu objetivo é: ${conversionGoals}
${whatsapp ? `WhatsApp para contato: ${whatsapp}` : ""}

## CAPTURA DE LEADS
Quando o visitante demonstrar interesse real, peça contato de forma NATURAL:
- "Para te passar um orçamento personalizado, qual seu WhatsApp?"
- "Posso pedir para nossa equipe entrar em contato? Qual o melhor número?"
- "Deixa seu e-mail que te envio mais detalhes"

Quando capturar dados do lead, inclua no FINAL da sua resposta (em uma linha separada):
[LEAD_DATA:{"name":"Nome","phone":"telefone","email":"email","whatsapp":"whatsapp","interest_summary":"resumo do interesse","lead_score":0-100}]

## CONTEXTO DO ARTIGO
${article_title ? `O visitante está lendo: "${article_title}"` : "O visitante está no site."}

Lembre-se: você é um vendedor humano da ${companyName}, não um bot.`;

    // 6. Prepare messages for AI
    const messagesForAI = [
      { role: "system", content: systemPrompt },
      ...existingMessages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: message },
    ];

    // 7. Call Lovable AI Gateway
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: messagesForAI,
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Sistema temporariamente sobrecarregado. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Serviço temporariamente indisponível." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error("AI request failed");
    }

    const aiData = await aiResponse.json();
    let assistantMessage = aiData.choices?.[0]?.message?.content || "Desculpe, não consegui processar sua mensagem. Pode repetir?";
    
    // Calculate tokens used
    const tokensUsed = (aiData.usage?.total_tokens || 0);

    // 8. Check for lead data in response
    let capturedLead: LeadData | null = null;
    const leadMatch = assistantMessage.match(/\[LEAD_DATA:({.*?})\]/);
    
    if (leadMatch) {
      try {
        capturedLead = JSON.parse(leadMatch[1]);
        // Remove lead data marker from visible message
        assistantMessage = assistantMessage.replace(/\[LEAD_DATA:.*?\]/, "").trim();
      } catch (e) {
        console.error("Failed to parse lead data:", e);
      }
    }

    // 9. Update conversation with new messages
    const updatedMessages = [
      ...existingMessages,
      { role: "user" as const, content: message },
      { role: "assistant" as const, content: assistantMessage },
    ];

    await supabase
      .from("brand_agent_conversations")
      .update({
        messages: updatedMessages,
        tokens_used: (conversation.tokens_used || 0) + tokensUsed,
        last_message_at: new Date().toISOString(),
        lead_captured: capturedLead ? true : conversation.lead_captured,
      })
      .eq("id", conversation.id);

    // 10. Update daily token usage
    await supabase
      .from("brand_agent_config")
      .update({ tokens_used_today: tokensUsedToday + tokensUsed })
      .eq("id", agentConfig.id);

    // 11. If lead captured, save it and send webhook
    if (capturedLead && (capturedLead.name || capturedLead.email || capturedLead.phone || capturedLead.whatsapp)) {
      const { data: leadRecord, error: leadError } = await supabase
        .from("brand_agent_leads")
        .insert({
          blog_id,
          conversation_id: conversation.id,
          article_id: article_id || null,
          article_title: article_title || null,
          name: capturedLead.name || null,
          email: capturedLead.email || null,
          phone: capturedLead.phone || null,
          whatsapp: capturedLead.whatsapp || null,
          interest_summary: capturedLead.interest_summary || null,
          lead_score: capturedLead.lead_score || 50,
          utm_source: utm_source || null,
          utm_medium: utm_medium || null,
          utm_campaign: utm_campaign || null,
        })
        .select()
        .single();

      if (leadError) {
        console.error("Error saving lead:", leadError);
      }

      // Send webhook if configured
      if (agentConfig.webhook_url && leadRecord) {
        try {
          const webhookPayload = {
            event: "lead_captured",
            timestamp: new Date().toISOString(),
            lead: {
              id: leadRecord.id,
              name: capturedLead.name,
              email: capturedLead.email,
              phone: capturedLead.phone,
              whatsapp: capturedLead.whatsapp,
              interest_summary: capturedLead.interest_summary,
              lead_score: capturedLead.lead_score,
            },
            source: {
              blog_id,
              blog_name: blog?.name,
              article_id: article_id || null,
              article_title: article_title || null,
            },
            conversation: {
              id: conversation.id,
              messages_count: updatedMessages.length,
            },
            utm: {
              source: utm_source,
              medium: utm_medium,
              campaign: utm_campaign,
            },
          };

          const webhookResponse = await fetch(agentConfig.webhook_url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(agentConfig.webhook_secret ? { "X-Webhook-Secret": agentConfig.webhook_secret } : {}),
            },
            body: JSON.stringify(webhookPayload),
          });

          // Update lead with webhook response
          await supabase
            .from("brand_agent_leads")
            .update({
              webhook_sent_at: new Date().toISOString(),
              webhook_response: {
                status: webhookResponse.status,
                ok: webhookResponse.ok,
              },
            })
            .eq("id", leadRecord.id);
        } catch (webhookError) {
          console.error("Webhook error:", webhookError);
        }
      }

      // Log consumption
      await supabase.from("consumption_logs").insert({
        user_id: blog_id, // Using blog_id as reference since this is anonymous
        blog_id,
        action_type: "brand_agent_lead",
        action_description: `Lead captured: ${capturedLead.name || capturedLead.email || capturedLead.phone}`,
        model_used: "google/gemini-3-flash-preview",
        input_tokens: aiData.usage?.prompt_tokens || 0,
        output_tokens: aiData.usage?.completion_tokens || 0,
        estimated_cost_usd: tokensUsed * 0.00001, // Approximate cost
      });
    }

    // 12. Log consumption for the chat
    await supabase.from("consumption_logs").insert({
      user_id: blog_id,
      blog_id,
      action_type: "brand_agent_chat",
      action_description: `Chat message processed`,
      model_used: "google/gemini-3-flash-preview",
      input_tokens: aiData.usage?.prompt_tokens || 0,
      output_tokens: aiData.usage?.completion_tokens || 0,
      estimated_cost_usd: tokensUsed * 0.00001,
    });

    return new Response(
      JSON.stringify({
        message: assistantMessage,
        conversation_id: conversation.id,
        lead_captured: !!capturedLead,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Brand Sales Agent error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "An unexpected error occurred",
        message: "Desculpe, estou com dificuldades técnicas. Pode tentar novamente?"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
