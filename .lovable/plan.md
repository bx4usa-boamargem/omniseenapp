
# Plano: Correção dos 36 Avisos de Segurança do Linter

## Resumo dos Problemas Identificados

| Categoria | Quantidade | Risco |
|-----------|------------|-------|
| Security Definer View | 1 | ERROR |
| Function Search Path Mutable | 4 | WARN |
| Extension in Public | 2 | WARN |
| RLS Policy Always True | 28 | WARN |
| Leaked Password Protection Disabled | 1 | WARN |

---

## 1. Security Definer View (ERROR - Crítico)

### Problema
A view `cms_integrations_decrypted` não tem `security_invoker=on`, o que significa que ela executa com as permissões do criador (postgres) ao invés do usuário que faz a query.

### Solução
```sql
-- Recriar a view com security_invoker=on
DROP VIEW IF EXISTS public.cms_integrations_decrypted;

CREATE VIEW public.cms_integrations_decrypted
WITH (security_invoker=on) AS
SELECT 
  id, blog_id, platform, site_url, auth_type, wordpress_site_id,
  COALESCE(decrypt_credential(api_key_encrypted, blog_id), api_key) AS api_key,
  COALESCE(decrypt_credential(api_secret_encrypted, blog_id), api_secret) AS api_secret,
  decrypt_credential(access_token_encrypted, blog_id) AS access_token,
  decrypt_credential(refresh_token_encrypted, blog_id) AS refresh_token,
  token_expires_at, username, is_active, auto_publish,
  last_sync_at, last_sync_status, created_at, updated_at
FROM cms_integrations;
```

---

## 2. Functions com Search Path Mutable (4 WARNs)

### Funções Afetadas
| Função | Security Definer | Risco |
|--------|------------------|-------|
| `check_article_rate_limit` | SIM | Alto |
| `generate_platform_subdomain` | NÃO | Baixo |
| `update_niche_profiles_updated_at` | NÃO | Baixo |
| `update_tenant_domains_updated_at` | NÃO | Baixo |

### Solução
```sql
-- 1. check_article_rate_limit (SECURITY DEFINER - CRÍTICO)
CREATE OR REPLACE FUNCTION public.check_article_rate_limit(p_blog_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public  -- ADICIONADO
AS $function$
DECLARE
  v_count INTEGER;
  v_window_start TIMESTAMP;
BEGIN
  -- (corpo da função permanece igual)
END;
$function$;

-- 2. generate_platform_subdomain
CREATE OR REPLACE FUNCTION public.generate_platform_subdomain()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public  -- ADICIONADO
AS $function$
BEGIN
  IF NEW.platform_subdomain IS NULL AND NEW.slug IS NOT NULL THEN
    NEW.platform_subdomain := NEW.slug || '.omniseen.app';
  END IF;
  RETURN NEW;
END;
$function$;

-- 3. update_niche_profiles_updated_at
CREATE OR REPLACE FUNCTION public.update_niche_profiles_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public  -- ADICIONADO
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- 4. update_tenant_domains_updated_at
CREATE OR REPLACE FUNCTION public.update_tenant_domains_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public  -- ADICIONADO
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;
```

---

## 3. Extensions in Public Schema (2 WARNs)

### Extensões Afetadas
- `pg_net` - usada para chamadas HTTP
- `unaccent` - usada para normalização de texto

### Análise de Risco

**pg_net**: Mover esta extensão pode quebrar funcionalidades existentes. Recomendo **manter como está** pois:
- É gerenciada pelo Supabase
- Não representa risco significativo

**unaccent**: Já existe no schema `extensions`, mas há wrapper functions no `public`. Estas funções wrapper são usadas pela função `normalize_title_for_fingerprint`.

### Solução Recomendada
Marcar estes avisos como **intencionais** (false positives) pois:
1. `pg_net` é obrigatória no public para Edge Functions funcionarem
2. `unaccent` tem wrappers deliberados para simplificar uso

---

## 4. RLS Policies com USING(true) ou WITH CHECK(true) (28 WARNs)

### Análise por Categoria

#### 4.1. Políticas INTENCIONAIS (Dados Públicos/Analytics) - Manter
Estas políticas permitem INSERT público para analytics e são por design:

| Tabela | Política | Justificativa |
|--------|----------|---------------|
| `article_analytics` | Anyone can insert analytics | Analytics público |
| `article_conversion_metrics` | Anyone can insert conversion metrics | Métricas de conversão |
| `blog_traffic` | Anyone can insert/update traffic | Tracking de tráfego |
| `brand_agent_conversations` | Anyone can start a conversation | Chatbot público |
| `brand_agent_leads` | Anyone can insert leads | Captura de leads |
| `ebook_leads` | Anyone can submit lead | Captura de leads |
| `funnel_events` | Anyone can insert funnel events | Tracking de funil |
| `landing_page_events` | Anyone can insert landing events | Analytics de LP |
| `link_click_events` | Anyone can insert link events | Tracking de cliques |
| `real_leads` | Allow insert for tracking | Tracking de leads |
| `section_analytics` | Anyone can insert section analytics | Analytics de seções |
| `team_activity_log` | Anyone can insert activity | Log de atividades |

#### 4.2. Políticas que PRECISAM ser corrigidas (Service Role com `public`)
Estas políticas dizem "Service role" mas usam `roles={public}`, permitindo acesso anônimo:

| Tabela | Problema |
|--------|----------|
| `article_broken_links` | `roles={public}` deveria ser `roles={service_role}` |
| `article_content_scores` | `roles={public}` deveria ser `roles={service_role}` |
| `blog_feature_flags` | `roles={public}` deveria ser `roles={service_role}` |
| `generation_rate_limits` | `roles={public}` deveria ser `roles={service_role}` |
| `score_change_log` | `roles={public}` deveria ser `roles={service_role}` |
| `seo_weekly_reports` | `roles={public}` deveria ser `roles={service_role}` |
| `serp_analysis_cache` | `roles={public}` deveria ser `roles={service_role}` |
| `automation_notifications` | `roles={public}` deveria ser `roles={service_role}` |
| `cms_credential_access_log` | `roles={public}` deveria ser `roles={service_role}` |
| `consumption_logs` | `roles={public}` deveria ser `roles={service_role}` |
| `email_logs` | `roles={public}` deveria ser `roles={service_role}` |
| `niche_guard_logs` | `roles={public}` deveria ser `roles={service_role}` |
| `user_achievements` | `roles={public}` deveria ser `roles={service_role}` |

### Correções SQL para Políticas Service Role

```sql
-- article_broken_links
DROP POLICY IF EXISTS "Service role can manage all broken links" ON article_broken_links;
CREATE POLICY "Service role can manage all broken links" 
ON article_broken_links FOR ALL 
TO service_role
USING (true) WITH CHECK (true);

-- article_content_scores
DROP POLICY IF EXISTS "Service role can manage content scores" ON article_content_scores;
CREATE POLICY "Service role can manage content scores" 
ON article_content_scores FOR ALL 
TO service_role
USING (true) WITH CHECK (true);

-- blog_feature_flags
DROP POLICY IF EXISTS "Service role full access to blog_feature_flags" ON blog_feature_flags;
CREATE POLICY "Service role full access to blog_feature_flags" 
ON blog_feature_flags FOR ALL 
TO service_role
USING (true) WITH CHECK (true);

-- generation_rate_limits
DROP POLICY IF EXISTS "Service role can manage rate limits" ON generation_rate_limits;
CREATE POLICY "Service role can manage rate limits" 
ON generation_rate_limits FOR ALL 
TO service_role
USING (true) WITH CHECK (true);

-- score_change_log (has duplicate policy, remove one)
DROP POLICY IF EXISTS "Service role full access to score_change_log" ON score_change_log;
DROP POLICY IF EXISTS "Service role can insert score changes" ON score_change_log;
CREATE POLICY "Service role can manage score changes" 
ON score_change_log FOR ALL 
TO service_role
USING (true) WITH CHECK (true);

-- seo_weekly_reports
DROP POLICY IF EXISTS "Service role can manage SEO reports" ON seo_weekly_reports;
CREATE POLICY "Service role can manage SEO reports" 
ON seo_weekly_reports FOR ALL 
TO service_role
USING (true) WITH CHECK (true);

-- serp_analysis_cache
DROP POLICY IF EXISTS "Service role can manage SERP analysis" ON serp_analysis_cache;
CREATE POLICY "Service role can manage SERP analysis" 
ON serp_analysis_cache FOR ALL 
TO service_role
USING (true) WITH CHECK (true);

-- automation_notifications
DROP POLICY IF EXISTS "System can insert notifications" ON automation_notifications;
CREATE POLICY "Service role can insert notifications" 
ON automation_notifications FOR INSERT 
TO service_role
WITH CHECK (true);

-- cms_credential_access_log
DROP POLICY IF EXISTS "Service role can insert audit logs" ON cms_credential_access_log;
CREATE POLICY "Service role can insert audit logs" 
ON cms_credential_access_log FOR INSERT 
TO service_role
WITH CHECK (true);

-- consumption_logs
DROP POLICY IF EXISTS "System can insert consumption" ON consumption_logs;
CREATE POLICY "Service role can insert consumption" 
ON consumption_logs FOR INSERT 
TO service_role
WITH CHECK (true);

-- email_logs
DROP POLICY IF EXISTS "Service role can insert email logs" ON email_logs;
CREATE POLICY "Service role can insert email logs" 
ON email_logs FOR INSERT 
TO service_role
WITH CHECK (true);

-- niche_guard_logs
DROP POLICY IF EXISTS "Service role can insert niche guard logs" ON niche_guard_logs;
CREATE POLICY "Service role can insert niche guard logs" 
ON niche_guard_logs FOR INSERT 
TO service_role
WITH CHECK (true);

-- user_achievements
DROP POLICY IF EXISTS "Service role can insert achievements" ON user_achievements;
CREATE POLICY "Service role can insert achievements" 
ON user_achievements FOR INSERT 
TO service_role
WITH CHECK (true);

-- brand_agent_conversations (UPDATE policy)
DROP POLICY IF EXISTS "Service role can update conversations" ON brand_agent_conversations;
CREATE POLICY "Service role can update conversations" 
ON brand_agent_conversations FOR UPDATE 
TO service_role
USING (true) WITH CHECK (true);
```

---

## 5. Leaked Password Protection Disabled (1 WARN)

### Problema
A proteção contra senhas vazadas não está habilitada no Auth.

### Solução
Isso requer configuração via dashboard ou API do Auth:
1. Acessar o backend via "View Backend"
2. Navegar para Authentication > Settings
3. Habilitar "Leaked Password Protection"

Nota: Esta configuração não pode ser feita via SQL migration.

---

## Resumo da Execução

### Fase 1: Correções SQL (Migration)
1. Recriar view `cms_integrations_decrypted` com `security_invoker=on`
2. Atualizar 4 funções com `SET search_path = public`
3. Corrigir 14 políticas RLS (trocar `public` por `service_role`)

### Fase 2: Configuração Manual
1. Habilitar Leaked Password Protection no painel de Auth

### Fase 3: Marcar False Positives
1. Extensões `pg_net` e `unaccent` são intencionais
2. Políticas de analytics públicos são por design

---

## Impacto Esperado

Após as correções:
- **ERROR**: 1 → 0 (Security Definer View corrigida)
- **WARN**: 35 → ~14 (Políticas de analytics intencionais permanecem)

A maioria dos avisos restantes serão políticas de INSERT público para analytics, que são intencionais e podem ser documentados como aceitos.
