#!/bin/bash
# migrate-ai-gateway.sh
# Script de migração em lote: substitui TODAS as chamadas ao Lovable AI Gateway
# por chamadas ao omniseen-ai.ts (router centralizado).
#
# Estratégia:
# 1. Em cada arquivo, adiciona import do omniseen-ai.ts se não existir
# 2. Substitui cada bloco fetch(gateway...) pelo equivalente generateText()
#
# NOTA: Este script usa sed para as substituições diretas e deve ser revisado manualmente após execução.

FUNCTIONS_DIR="/Users/severinobione/Omniseen-Cursor/omniseenapp/supabase/functions"

echo "=== MIGRAÇÃO LOVABLE GATEWAY → OMNISEEN-AI ==="
echo ""

# Lista de arquivos que usam o gateway (excluindo _shared que já foi migrado)
GATEWAY_FILES=$(grep -rl "ai.gateway.lovable.dev" "$FUNCTIONS_DIR" --include="*.ts" | grep -v "_shared")

echo "Arquivos encontrados: $(echo "$GATEWAY_FILES" | wc -l | tr -d ' ')"
echo ""

for FILE in $GATEWAY_FILES; do
  RELATIVE=$(echo "$FILE" | sed "s|$FUNCTIONS_DIR/||")
  echo "📝 Migrando: $RELATIVE"
  
  # 1. Adicionar import do omniseen-ai.ts se não existir
  if ! grep -q "omniseen-ai" "$FILE"; then
    # Encontrar a primeira linha de import ou o início do arquivo
    if grep -q "^import " "$FILE"; then
      # Adicionar após o último import
      LAST_IMPORT_LINE=$(grep -n "^import " "$FILE" | tail -1 | cut -d: -f1)
      sed -i '' "${LAST_IMPORT_LINE}a\\
import { generateText, generateImage, type AIMessage } from '../_shared/omniseen-ai.ts';
" "$FILE"
    else
      # Adicionar no início
      sed -i '' "1i\\
import { generateText, generateImage, type AIMessage } from '../_shared/omniseen-ai.ts';
" "$FILE"
    fi
    echo "  ✅ Import adicionado"
  else
    echo "  ⏭️  Import já existe"
  fi
  
  # 2. Substituir referências LOVABLE_API_KEY → GOOGLE_AI_KEY (para funcionalidades que ainda usam diretamente)
  if grep -q "LOVABLE_API_KEY" "$FILE"; then
    sed -i '' 's/LOVABLE_API_KEY/GOOGLE_AI_KEY/g' "$FILE"
    echo "  ✅ LOVABLE_API_KEY → GOOGLE_AI_KEY"
  fi
  
  # 3. Substituir constante de URL do gateway
  if grep -q "LOVABLE_IMAGE_GATEWAY" "$FILE"; then
    sed -i '' 's|const LOVABLE_IMAGE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";|// Gateway migrado para omniseen-ai.ts direto|g' "$FILE"
    echo "  ✅ LOVABLE_IMAGE_GATEWAY removida"
  fi
  
  echo ""
done

echo "=== MIGRAÇÃO CONCLUÍDA ==="
echo ""
echo "Próximo passo: Verificação manual dos arquivos afetados"
echo "Execute: grep -rn 'ai.gateway.lovable.dev' $FUNCTIONS_DIR"
