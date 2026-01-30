
# Implementação: Validação de Links Externos V4.3

## Localização Exata

**Arquivo:** `supabase/functions/generate-article-structured/index.ts`
**Inserir:** Entre linhas 827 e 829

## Código a Inserir

```typescript
// Linha 827 existente:
// }

// V4.3: Validar links externos (warning only, não bloqueia persistência)
const externalLinks = sanitizedContent.match(
  /<a\s+href="https?:\/\/(?![^"]*(seudominio\.com|localhost))[^"]+"/gi
);

if (!externalLinks || externalLinks.length < 2) {
  console.warn(
    `[${requestId}] ⚠️ Less than 2 external links detected. Found: ${
      externalLinks ? externalLinks.length : 0
    }`
  );
} else {
  console.log(
    `[${requestId}] ✅ External links validated: ${externalLinks.length}`
  );
}

// Preparar dados para inserção (no duplicate found)
// ... resto do código existente
```

## Comportamento

| Condição | Ação |
|----------|------|
| Links < 2 | `console.warn()` - apenas log |
| Links >= 2 | `console.log()` - confirmação |
| Persistência | **Nunca bloqueada** |
| Status | **Nunca alterado** |

## Sequência Pós-Implementação

1. Deploy da edge function `generate-article-structured`
2. Gerar 1 artigo authority
3. Validar logs:
   - `[QA SCORE]` com threshold 60
   - `[STAGE] completed`
   - `[IMAGES LOOP]` com índices
   - `External links validated` OU warning

## Checklist V4.3 Completo

| Componente | Status |
|------------|--------|
| QA threshold 60/100 | ✅ Implementado |
| Publicação controlada | ✅ Implementado |
| `generation_stage` nunca `null` | ✅ Confirmado |
| Imagens com loop resiliente | ✅ Implementado |
| Sanitizer remove markdown fences | ✅ Implementado |
| CTA com colunas corretas | ✅ Implementado |
| Links externos monitorados | 🔄 A implementar agora |

## Seção Técnica

A regex utilizada:
```regex
/<a\s+href="https?:\/\/(?![^"]*(seudominio\.com|localhost))[^"]+"/gi
```

- Captura tags `<a href="...">` com URLs HTTP/HTTPS
- Exclui domínios internos via negative lookahead
- Case-insensitive (`i`) e global (`g`)
- Retorna array de matches ou `null`
