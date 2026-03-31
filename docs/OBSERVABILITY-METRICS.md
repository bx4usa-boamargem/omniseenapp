# Observabilidade — métricas e alertas (generation pipeline)

Objetivo: usar dados já persistidos em **`generation_steps`** e **`generation_jobs`** para SLOs, custo por blog e saúde do motor V2.

## Fontes de dados

| Tabela | Campos úteis |
|--------|----------------|
| `generation_steps` | `job_id`, `step_name`, `status`, `latency_ms`, `cost_usd`, `tokens_in`, `tokens_out`, `error_message`, `completed_at`, `model_used`, `provider` |
| `generation_jobs` | `blog_id`, `user_id`, `job_type`, `status`, `cost_usd`, `total_api_calls`, `current_step`, `error_step`, `error_message`, `created_at`, `completed_at` |

## View agregada (diária)

A migração [`20260331123000_generation_step_metrics_view.sql`](../supabase/migrations/20260331123000_generation_step_metrics_view.sql) cria a view **`generation_step_metrics_daily`**, agrupando por:

- dia (UTC),
- `step_name`,
- `job_type`,
- `blog_id`,

com totais de passos, erros, latência média, custo e tokens.

**Acesso:** `SELECT` concedido a `service_role` (painéis internos, ETL, Metabase conectado com credencial adequada). Não expor a view a `anon`.

### Consultas úteis

Taxa de erro por passo (últimos 7 dias):

```sql
select day, step_name,
       sum(error_count)::float / nullif(sum(step_count), 0) as error_rate
from public.generation_step_metrics_daily
where day >= (current_date - 7)
group by 1, 2
order by 1 desc, error_rate desc nulls last;
```

Custo diário total do motor:

```sql
select day, sum(total_cost_usd) as cost_usd
from public.generation_step_metrics_daily
group by 1
order by 1 desc
limit 30;
```

Top blogs por custo (último dia):

```sql
select blog_id, sum(total_cost_usd) as cost_usd, sum(step_count) as steps
from public.generation_step_metrics_daily
where day = current_date - 1
group by 1
order by cost_usd desc nulls last
limit 20;
```

## Métricas recomendadas para alertas

| Métrica | Descrição | Sugestão de threshold (ajustar por plano) |
|---------|-----------|---------------------------------------------|
| `job_failure_rate` | `status = failed` em `generation_jobs` / jobs concluídos (janela 1h) | > 15% durante 30 min |
| `step_error_rate` | Passos com `error_message` não nulo / passos completados | > 10% em `CONTENT_GEN` ou `IMAGE_GEN` |
| `p95_latency_ms` | Percentil 95 de `latency_ms` por `step_name` | > 120s em `CONTENT_GEN` |
| `daily_cost_usd` | Soma de `cost_usd` em `generation_jobs` ou steps | > orçamento diário configurado |
| `stuck_jobs` | `status = running` e `updated_at` &lt; now() - intervalo | > 0 por mais de 30 min |

## Logs estruturados (Edge Functions)

O orquestrador já emite logs por passo (`[V2] Step...`). Próximo passo operacional:

- Enviar logs do Supabase para o agregador da equipa (Logflare, Datadog, etc.).
- Correlacionar `job_id` em todas as linhas de log.

## OpenTelemetry (opcional)

Para “classe mundial”, considerar traces com `job_id` como span attribute nas invocações `ai-router` / geração de imagem, permitindo flame graphs por job.
