#!/bin/bash
# ============================================
# DEPLOY SCRIPT — OmniSeen AI Migration v6.0
# Execute este script quando a internet estiver disponível
# ============================================

set -e

echo "╔══════════════════════════════════════╗"
echo "║  DEPLOY: OmniSeen AI Migration v6   ║"
echo "╚══════════════════════════════════════╝"
echo ""

cd /Users/severinobione/Omniseen-Cursor/omniseenapp

# ============================================
# ETAPA 1: Push para GitHub
# ============================================
echo "━━━ ETAPA 1: GitHub Push ━━━"
git push origin main
echo "✅ GitHub atualizado"
echo ""

# ============================================
# ETAPA 2: Link ao projeto Supabase
# ============================================
echo "━━━ ETAPA 2: Supabase Link ━━━"
# Substitua o token abaixo pelo seu token ATUAL do Supabase
export SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-sbp_COLOQUE_SEU_TOKEN_AQUI}"
supabase link --project-ref oxbrvyinmpbkllicaxqk
echo "✅ Supabase linked"
echo ""

# ============================================
# ETAPA 3: Configurar Secrets
# ============================================
echo "━━━ ETAPA 3: Configurar Secrets ━━━"
echo "⚠️  Configure as seguintes variáveis no Supabase Dashboard:"
echo "   https://supabase.com/dashboard/project/oxbrvyinmpbkllicaxqk/settings/vault"
echo ""
echo "   GOOGLE_AI_KEY = <sua-chave-google-ai>"
echo "   OPENAI_API_KEY = <sua-chave-openai>"
echo ""
echo "   REMOVER: LOVABLE_API_KEY (não mais necessária)"
echo ""
read -p "Secrets configurados no Dashboard? (y/n): " confirm
if [ "$confirm" != "y" ]; then
  echo "❌ Configure os secrets primeiro!"
  exit 1
fi

# ============================================
# ETAPA 4: Deploy das Edge Functions
# ============================================
echo "━━━ ETAPA 4: Deploy Edge Functions ━━━"

# Deploy do módulo central primeiro
echo "Deploying ai-router..."
supabase functions deploy ai-router --no-verify-jwt

echo "Deploying orchestrate-generation..."
supabase functions deploy orchestrate-generation --no-verify-jwt

echo "Deploying generate-image..."
supabase functions deploy generate-image --no-verify-jwt

# Deploy em lote das demais functions
FUNCTIONS=(
  "build-article-outline"
  "review-article"
  "boost-content-score"
  "auto-fix-article"
  "improve-article-complete"
  "polish-article-final"
  "optimize-article-performance"
  "fix-seo-with-ai"
  "generate-ebook-content"
  "generate-landing-page"
  "generate-persona-suggestions"
  "generate-internal-links"
  "batch-internal-links"
  "generate-opportunities"
  "suggest-keywords"
  "suggest-niche-keywords"
  "suggest-themes"
  "article-chat"
  "support-chat"
  "brand-sales-agent"
  "weekly-market-intel"
  "import-instagram"
  "summarize-document"
  "translate-article"
  "fetch-real-trends"
  "fix-broken-link"
  "create-cluster"
  "keyword-analysis"
  "improve-seo-item"
  "batch-seo-suggestions"
  "generate-funnel-articles"
  "generate-concepts"
  "generate-article-images-async"
  "fix-landing-page-seo"
  "analyze-competitors"
  "analyze-serp"
  "landing-chat"
  "gsc-callback"
)

for fn in "${FUNCTIONS[@]}"; do
  echo "  Deploying $fn..."
  supabase functions deploy "$fn" --no-verify-jwt 2>&1 || echo "  ⚠️  $fn: falhou (pode não existir no Supabase)"
done

echo ""
echo "✅ Deploy completo!"
echo ""

# ============================================
# ETAPA 5: Verificação
# ============================================
echo "━━━ ETAPA 5: Verificação ━━━"
echo "Execute um teste básico:"
echo ""
echo "  curl -X POST https://oxbrvyinmpbkllicaxqk.supabase.co/functions/v1/ai-router \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -H 'Authorization: Bearer <ANON_KEY>' \\"
echo "    -d '{\"task\": \"general\", \"messages\": [{\"role\": \"user\", \"content\": \"Olá, teste de conexão\"}]}'"
echo ""
echo "🎯 Deploy finalizado!"
