# Content API — segurança e uso do service role

## Por que a função usa `SUPABASE_SERVICE_ROLE_KEY`

[`content-api`](../supabase/functions/content-api/index.ts) precisa **ler dados públicos de qualquer blog** (resolução por `host`, `blog_slug` ou `blog_id`) sem sessão do utilizador. O cliente público do blog (site estático ou CDN) **não envia JWT de utilizador**.

O padrão escolhido é:

- Edge Function com **service role** no servidor.
- **Whitelist explícita** de colunas devolvidas por rota (`BLOG_PUBLIC_FIELDS`, `ARTICLE_PUBLIC_FIELDS`, etc.).
- **Nunca** expor a service role key no browser ou em repositórios.

## Riscos e mitigações implementadas

| Risco | Mitigação |
|-------|-----------|
| Abuso / scraping em massa | **Rate limit** por IP (janela de 1 minuto) via `content_api_increment_rate`; limite configurável com `CONTENT_API_MAX_REQ_PER_MINUTE` (default 180). |
| CORS aberto demais | **`ALLOWED_CORS_ORIGINS`**: lista separada por vírgulas. Se definido, só origens listadas recebem `Access-Control-Allow-Origin` correto no browser. |
| Carga na base | Cabeçalhos **`Cache-Control`** em respostas JSON públicas para permitir cache na CDN/browser (`CONTENT_API_CACHE_*` env vars). |

## Variáveis de ambiente (Supabase Edge Secrets)

| Variável | Descrição |
|----------|-----------|
| `ALLOWED_CORS_ORIGINS` | Opcional. Ex.: `https://bravo-homes-group.meublog.net,https://app.automarticles.com` |
| `CONTENT_API_MAX_REQ_PER_MINUTE` | Opcional. Default `180`. |
| `CONTENT_API_CACHE_DEFAULT_MAX_AGE` | Opcional. Default `120` (segundos). |
| `CONTENT_API_CACHE_STALE_WHILE_REVALIDATE` | Opcional. Default `300`. |

## Cron e outros endpoints

Funções internas que aceitam `Authorization: Bearer <SERVICE_ROLE_KEY>` **não** devem ser chamadas a partir do browser. Preferir:

- Header dedicado `x-cron-secret` para jobs agendados.
- Invocação apenas server-side ou via Supabase cron.

Revisar periodicamente funções que tratam `authHeader?.includes(SUPABASE_SERVICE_ROLE_KEY)` como válido.
