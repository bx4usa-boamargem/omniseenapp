
# Plano: Feed Mensal de Oportunidades

## Contexto

O sistema atual de oportunidades de conteúdo (`article_opportunities`) acumula registros históricos indefinidamente, criando backlog morto. O objetivo é transformá-lo em um **feed vivo mensal** onde apenas ideias dos últimos 30 dias são visíveis e relevantes.

---

## Arquitetura Proposta

```text
┌────────────────────────────────────────────────────────────────────┐
│                       ESTRATÉGIA HÍBRIDA                           │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│   1. FILTRAGEM NO FETCH (imediata)                                │
│      Todas as queries filtram por created_at >= now() - 30 dias   │
│      Ideias antigas nunca aparecem na UI                          │
│                                                                    │
│   2. LIMPEZA AUTOMÁTICA (diária via cron)                         │
│      Edge Function agendada deleta registros > 30 dias            │
│      Mantém banco limpo e performático                            │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## Componentes Afetados

### Queries de Fetch (6 arquivos)

| Arquivo | Função | Mudança |
|---------|--------|---------|
| `src/hooks/useRadarOpportunities.ts` | Hook principal do Radar | Adicionar `.gte('created_at', thirtyDaysAgo)` |
| `src/components/content/OpportunitiesTab.tsx` | Tab de oportunidades | Filtrar por data |
| `src/components/client/strategy/ClientOpportunitiesTab.tsx` | Tab cliente | Filtrar por data |
| `src/components/mobile/MobileRadarFeed.tsx` | Feed mobile | Filtrar por data |
| `src/pages/client/ClientConsultantMetrics.tsx` | Métricas consultor | Já filtra por período selecionado |
| `src/components/content/FunnelModal.tsx` | Modal de funil | Filtrar por data |

### Métricas (2 arquivos)

| Arquivo | Mudança |
|---------|---------|
| `src/components/content/OpportunitiesTab.tsx` | Contador e stats filtrando 30 dias |
| `src/components/consultant/TopOpportunitiesTable.tsx` | Filtrar oportunidades antigas |

---

## Implementação

### Fase 1: Filtro de Data nas Queries

Todas as queries que buscam `article_opportunities` receberão um filtro adicional:

```typescript
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

const { data } = await supabase
  .from('article_opportunities')
  .select('*')
  .eq('blog_id', blogId)
  .gte('created_at', thirtyDaysAgo.toISOString())  // NOVO
  .order('relevance_score', { ascending: false });
```

Isso garante que:
- Ideias antigas nunca aparecem na UI
- Contadores refletem apenas o mês atual
- Métricas de conversão consideram apenas período ativo

### Fase 2: Edge Function de Limpeza

Criar função `cleanup-expired-opportunities`:

```typescript
// supabase/functions/cleanup-expired-opportunities/index.ts

const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

// Deletar oportunidades:
// - Criadas há mais de 30 dias
// - Não convertidas (status != 'converted')
const { count, error } = await supabase
  .from('article_opportunities')
  .delete()
  .lt('created_at', thirtyDaysAgo.toISOString())
  .not('status', 'eq', 'converted');
```

**Comportamento**:
- Preserva oportunidades convertidas (histórico de ROI)
- Deleta pending, approved e archived com mais de 30 dias
- Retorna contagem de registros removidos

### Fase 3: Job Agendado

Configurar cron no banco para execução diária às 03:00 (horário de baixo tráfego):

```sql
SELECT cron.schedule(
  'cleanup-expired-opportunities-daily',
  '0 3 * * *',  -- Diariamente às 03:00 UTC
  $$
  SELECT net.http_post(
    url:='https://lkyypeqdstftooegqngf.supabase.co/functions/v1/cleanup-expired-opportunities',
    headers:='{"Authorization": "Bearer ANON_KEY", "Content-Type": "application/json"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);
```

---

## Detalhes Técnicos

### Mudança no useRadarOpportunities.ts

```typescript
const fetchData = useCallback(async () => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const { data: opps } = await supabase
    .from('article_opportunities')
    .select('id, suggested_title, relevance_score, ...')
    .eq('blog_id', blogId)
    .gte('created_at', thirtyDaysAgo.toISOString())  // NOVO
    .not('status', 'eq', 'converted')
    .not('status', 'eq', 'archived')
    .order('relevance_score', { ascending: false })
    .limit(limit);
  
  // Count também com filtro de 30 dias
  const { count } = await supabase
    .from('article_opportunities')
    .select('id', { count: 'exact', head: true })
    .eq('blog_id', blogId)
    .gte('created_at', thirtyDaysAgo.toISOString())  // NOVO
    .not('status', 'eq', 'converted')
    .not('status', 'eq', 'archived');
}, [blogId, limit]);
```

### UI: Indicador Visual

Adicionar badge na interface mostrando o período ativo:

```tsx
<Badge variant="outline" className="gap-1 text-xs">
  <Calendar className="h-3 w-3" />
  Últimos 30 dias
</Badge>
```

### Edge Function: cleanup-expired-opportunities

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Deletar oportunidades expiradas (não convertidas)
    const { data: deleted, error } = await supabase
      .from('article_opportunities')
      .delete()
      .lt('created_at', thirtyDaysAgo.toISOString())
      .neq('status', 'converted')
      .select('id');

    if (error) throw error;

    console.log(`[cleanup] Deleted ${deleted?.length || 0} expired opportunities`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        deleted_count: deleted?.length || 0,
        cutoff_date: thirtyDaysAgo.toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[cleanup] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

---

## Garantias do Sistema

| Regra | Implementação |
|-------|---------------|
| Ideias > 30 dias não aparecem na UI | Filtro em todas as queries |
| Ideias expiradas não contam em métricas | Filtro na contagem |
| Limpeza automática do banco | Cron diário às 03:00 |
| Oportunidades convertidas preservadas | Filtro `status != 'converted'` na deleção |
| Feed sempre parece "vivo" | Apenas dados recentes visíveis |

---

## Arquivos a Modificar

1. **Hook principal**: `src/hooks/useRadarOpportunities.ts`
2. **Tab oportunidades**: `src/components/content/OpportunitiesTab.tsx`
3. **Tab cliente**: `src/components/client/strategy/ClientOpportunitiesTab.tsx`
4. **Feed mobile**: `src/components/mobile/MobileRadarFeed.tsx`
5. **Modal funil**: `src/components/content/FunnelModal.tsx`
6. **Table top opps**: `src/components/consultant/TopOpportunitiesTable.tsx`

## Novos Arquivos

1. **Edge Function**: `supabase/functions/cleanup-expired-opportunities/index.ts`
2. **Config.toml**: Adicionar função na configuração

## Configuração de Banco

1. **Habilitar extensões**: `pg_cron` e `pg_net` (se não estiverem ativas)
2. **Criar job**: Agendar limpeza diária via SQL

---

## Resultado Final

- **Painel sempre atualizado**: Apenas ideias do mês atual
- **Zero backlog morto**: Registros antigos removidos automaticamente
- **Métricas precisas**: Contadores refletem período ativo
- **Performance otimizada**: Banco limpo, queries rápidas
- **Histórico preservado**: Oportunidades convertidas mantidas para ROI
