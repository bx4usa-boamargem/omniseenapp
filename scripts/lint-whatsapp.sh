#!/bin/bash
# ============================================================
# WhatsApp Link Guardrail - Anti-Regression Script
# ============================================================
# Este script detecta construções manuais de URLs WhatsApp
# que bypassam o sistema de builders centralizado.
#
# REGRA ABSOLUTA: 
# - NUNCA usar api.whatsapp.com
# - SEMPRE usar wa.me através dos builders globais
#
# Run: bash scripts/lint-whatsapp.sh
# ============================================================

set -e

echo "🔍 WhatsApp Link Lint - Verificando uso de builders..."
echo ""

ERRORS=0
WARNINGS=0

# ============================================================
# CHECK 1: api.whatsapp.com (PROIBIDO EM TODO LUGAR)
# ============================================================
echo "Checking for api.whatsapp.com..."
API_WA_MATCHES=$(grep -rn "api.whatsapp.com" --include="*.ts" --include="*.tsx" src/ supabase/ 2>/dev/null || true)
if [ -n "$API_WA_MATCHES" ]; then
  echo "❌ PROIBIDO: api.whatsapp.com encontrado:"
  echo "$API_WA_MATCHES"
  echo ""
  ERRORS=$((ERRORS + 1))
fi

# ============================================================
# CHECK 2: whatsapp.com/send (PROIBIDO EM TODO LUGAR)
# ============================================================
echo "Checking for whatsapp.com/send..."
WA_SEND_MATCHES=$(grep -rn "whatsapp.com/send" --include="*.ts" --include="*.tsx" src/ supabase/ 2>/dev/null || true)
if [ -n "$WA_SEND_MATCHES" ]; then
  echo "❌ PROIBIDO: whatsapp.com/send encontrado:"
  echo "$WA_SEND_MATCHES"
  echo ""
  ERRORS=$((ERRORS + 1))
fi

# ============================================================
# CHECK 3: wa.me hardcoded fora dos arquivos permitidos
# ============================================================
echo "Checking for hardcoded wa.me links..."
ALLOWED_FILES="whatsappBuilder|FloatingShareBar|contactLinks"
WA_ME_MATCHES=$(grep -rn "https://wa.me/" --include="*.ts" --include="*.tsx" src/ supabase/ 2>/dev/null | grep -vE "$ALLOWED_FILES" || true)
if [ -n "$WA_ME_MATCHES" ]; then
  echo "⚠️ POSSÍVEL PROBLEMA: wa.me hardcoded fora dos builders:"
  echo "$WA_ME_MATCHES"
  echo ""
  echo "   Se for compartilhamento (FloatingShareBar) ou dentro do builder, é OK."
  echo "   Se for CTA ou link de contato, deve usar buildWhatsAppLink/buildWhatsAppLinkSync."
  echo ""
  WARNINGS=$((WARNINGS + 1))
fi

# ============================================================
# CHECK 4: contactLinks.ts deve usar builders globais
# ============================================================
echo "Checking contactLinks.ts uses global builders..."
CONTACT_DIRECT=$(grep -n "return \`https://wa.me/" src/lib/contactLinks.ts 2>/dev/null || true)
if [ -n "$CONTACT_DIRECT" ]; then
  echo "❌ REFATORAR: contactLinks.ts ainda monta links wa.me diretamente:"
  echo "$CONTACT_DIRECT"
  echo ""
  echo "   Use buildSimpleWhatsAppLink() ou buildWhatsAppLinkWithMessage()"
  ERRORS=$((ERRORS + 1))
fi

# ============================================================
# CHECK 5: Verificar se imports de whatsappBuilder existem em contactLinks
# ============================================================
echo "Checking contactLinks.ts imports whatsappBuilder..."
BUILDER_IMPORT=$(grep -n "from '@/lib/whatsappBuilder'" src/lib/contactLinks.ts 2>/dev/null || true)
if [ -z "$BUILDER_IMPORT" ]; then
  echo "⚠️ contactLinks.ts não importa de whatsappBuilder"
  echo "   Deve importar: buildSimpleWhatsAppLink, buildWhatsAppLinkWithMessage"
  WARNINGS=$((WARNINGS + 1))
fi

# ============================================================
# CHECK 6: Edge functions devem usar _shared/whatsappBuilder
# ============================================================
echo "Checking edge functions use shared whatsappBuilder..."
EDGE_FUNCTIONS=$(find supabase/functions -maxdepth 1 -type d ! -name "_shared" ! -name "functions" 2>/dev/null)
for func_dir in $EDGE_FUNCTIONS; do
  func_name=$(basename "$func_dir")
  if [ -f "$func_dir/index.ts" ]; then
    # Check if function uses wa.me but doesn't import from _shared/whatsappBuilder
    USES_WAME=$(grep -l "wa.me" "$func_dir/index.ts" 2>/dev/null || true)
    if [ -n "$USES_WAME" ]; then
      IMPORTS_BUILDER=$(grep "_shared/whatsappBuilder" "$func_dir/index.ts" 2>/dev/null || true)
      if [ -z "$IMPORTS_BUILDER" ]; then
        echo "⚠️ Edge function '$func_name' usa wa.me mas não importa _shared/whatsappBuilder"
        WARNINGS=$((WARNINGS + 1))
      fi
    fi
  fi
done

# ============================================================
# SUMMARY
# ============================================================
echo "=============================================="
if [ $ERRORS -gt 0 ]; then
  echo "❌ WhatsApp lint FALHOU com $ERRORS erros e $WARNINGS avisos"
  echo ""
  echo "SOLUÇÃO: Use as funções centralizadas:"
  echo ""
  echo "  FRONTEND:"
  echo "  - import { buildSimpleWhatsAppLink, buildWhatsAppLinkWithMessage } from '@/lib/whatsappBuilder'"
  echo "  - useGlobalWhatsApp().buildLink() ou openLink()"
  echo ""
  echo "  BACKEND (Edge Functions):"
  echo "  - import { buildWhatsAppLinkSync, buildSimpleWhatsAppLink } from '../_shared/whatsappBuilder.ts'"
  echo ""
  exit 1
fi

if [ $WARNINGS -gt 0 ]; then
  echo "⚠️ WhatsApp lint PASSOU com $WARNINGS avisos"
  echo ""
  echo "Revise os avisos acima para garantir conformidade total."
else
  echo "✅ WhatsApp lint PASSOU - Nenhum problema encontrado"
fi

echo ""
echo "Builders centralizados:"
echo "  - src/lib/whatsappBuilder.ts (frontend)"
echo "  - supabase/functions/_shared/whatsappBuilder.ts (backend)"
