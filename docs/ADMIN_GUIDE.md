# Guia de Administração OmniSeen

## Índice

1. [Visão Geral da Plataforma](#1-visão-geral-da-plataforma)
2. [Painel Administrativo](#2-painel-administrativo)
3. [Gestão de Clientes](#3-gestão-de-clientes)
4. [Custos de IA](#4-custos-de-ia)
5. [Automação Editorial](#5-automação-editorial)
6. [Troubleshooting](#6-troubleshooting)

---

## 1. Visão Geral da Plataforma

### 1.1 Arquitetura da OmniSIM

A OmniSIM (Sistema de Inteligência de Mercado) é o motor autônomo da Omniseen. Sua filosofia central é que **o cliente governa a máquina, não a opera**.

```
Radar (Decisão) → Geração (Execução) → Quality Gate (Validação) → Auto-fix (Correção) → Auto-publish (Publicação) → IndexNow (Descoberta)
```

### 1.2 Hierarquia de Usuários

| Role | Descrição | Acesso |
|------|-----------|--------|
| `platform_admin` | Administrador da plataforma | Tudo: custos, equipe, subcontas, configurações |
| `admin` | Administrador do sistema | Acesso técnico total |
| `subaccount` | Cliente final | Apenas seus blogs e configurações |
| `team_member` | Membro de equipe | Acesso ao blog específico que foi convidado |

### 1.3 Fluxo de Dados

1. **Radar semanal**: `weekly-market-intel` analisa cada território ativo
2. **Oportunidades**: Resultados salvos em `article_opportunities`
3. **Conversão**: Oportunidades viram artigos em `articles`
4. **Quality Gate**: Validação de SEO, compliance e duplicidade
5. **Publicação**: Artigos aprovados são publicados automaticamente
6. **IndexNow**: Notificação instantânea aos buscadores

---

## 2. Painel Administrativo

Acesse via `/admin` ou clique em "Painel Admin" na sidebar.

### 2.1 Aba Overview (Visão Geral SaaS)

| Métrica | Descrição |
|---------|-----------|
| MRR | Receita Mensal Recorrente baseada em planos ativos |
| Clientes Ativos | Subcontas com subscription ativa |
| Churn Rate | % de cancelamentos nos últimos 30 dias |
| Margem | (Receita - Custos IA) / Receita |

**Meta de MRR**: A barra de progresso mostra a distância até a meta definida em `admin_goals`.

### 2.2 Aba Tenants

Lista todas as subcontas com:
- Nome e email do owner
- Plano contratado
- Status (active, trial, churned)
- Contagem de blogs e artigos
- Custo total de IA

**Filtros disponíveis**: Busca por nome, filtro por plano, filtro por status.

### 2.3 Aba Custos IA

Breakdown detalhado por:
- **Modelo**: GPT-4, Claude, Gemini, etc.
- **Tipo**: Texto, Imagem, SEO, Perplexity
- **Subconta**: Filtro para ver custos de cliente específico

### 2.4 Aba Cache

Estatísticas do sistema de cache (`ai_content_cache`):
- Total de hits (requisições servidas do cache)
- Tokens economizados
- Custo economizado em USD

### 2.5 Aba Alertas de Custo

Configure limites para receber alertas:

| Tipo | Descrição |
|------|-----------|
| Diário | Alerta quando custo do dia passa do limite |
| Semanal | Alerta quando custo da semana passa do limite |
| Mensal | Alerta quando custo do mês passa do limite |
| Por Usuário | Alerta quando um usuário específico ultrapassa |

### 2.6 Aba Saúde (Health Alerts)

Alertas proativos para retenção de clientes:

| Tipo | Descrição | Threshold Padrão |
|------|-----------|------------------|
| Risco de Churn | Dias sem login | 14 dias |
| Margem Baixa | % de margem mínima | 20% |
| Inatividade | Dias sem criar artigo | 30 dias |

---

## 3. Gestão de Clientes

### 3.1 Criando Subcontas

**Via CustomerAccountsTab**:

1. Clique em "Criar Conta"
2. Preencha: Nome, Email, Senha inicial
3. Marque "Conta Interna" se for gerenciada pela equipe
4. Selecione o plano inicial

**Conta Interna vs Self-Registered**:
- `is_internal_account = true`: Gerenciada pela equipe, não conta em métricas de churn
- `is_internal_account = false`: Cliente que se registrou sozinho

### 3.2 Planos e Limites

| Plano | Artigos/mês | Territórios | Radar |
|-------|-------------|-------------|-------|
| Lite | 8 | 1 | ❌ |
| Pro | 20 | 2 | 10/mês |
| Business | 100 | 10 | 30/mês |

### 3.3 Sistema de Territórios

Cada território representa uma área geográfica de atuação:

```
País: Brasil
└── Estado: São Paulo
    └── Cidade: São Paulo
```

O Radar gera oportunidades específicas por território, garantindo relevância local.

---

## 4. Custos de IA

### 4.1 Tabela de Preços

Configurada em `model_pricing`:

| Modelo | Input/1k tokens | Output/1k tokens | Imagem |
|--------|-----------------|------------------|--------|
| GPT-4o | $0.005 | $0.015 | - |
| Claude 3.5 | $0.003 | $0.015 | - |
| Gemini Pro | $0.00025 | $0.0005 | - |
| FLUX | - | - | $0.003 |

### 4.2 Registro de Consumo

Toda operação de IA gera um registro em `consumption_logs`:

```typescript
{
  user_id: "uuid",
  blog_id: "uuid",
  action_type: "article_generation" | "image_generation" | "seo_analysis",
  model_used: "gpt-4o",
  input_tokens: 2000,
  output_tokens: 3000,
  estimated_cost_usd: 0.055
}
```

### 4.3 Economia com Cache

O sistema de cache (`ai_content_cache`) armazena respostas comuns:

- Prompts similares retornam do cache
- Economia média de 20-30% em custos
- TTL configurável por tipo de conteúdo

---

## 5. Automação Editorial

### 5.1 Configurando Autopilot

Em `/client/automation`:

| Configuração | Descrição |
|--------------|-----------|
| Autopilot de Funil | Distribui artigos entre TOFU/MOFU/BOFO |
| Quality Gate | Valida antes de publicar |
| Publicação Auto | Publica sem aprovação manual |
| Delay | Tempo entre aprovação e publicação |

### 5.2 Quality Gate

Critérios de validação:

1. **SEO**: Título 30-70 chars, meta 50-160 chars, 3-7 keywords
2. **Conteúdo**: Mínimo 300 palavras, estrutura H1/H2/H3
3. **Compliance**: Validações extras para nichos sensíveis (Saúde, Jurídico)
4. **Duplicidade**: Fingerprint semântico para evitar conteúdo repetido

### 5.3 Rotação de Estruturas

O sistema rotaciona entre 4 modelos:
- `educational`: Didático, conceitual
- `problem_solution`: Dor → Solução
- `guide`: Passo a passo
- `comparison`: Comparativo para decisão

---

## 6. Troubleshooting

### 6.1 Artigos Não Estão Sendo Gerados

**Verificar**:
1. Automação está ativa? (`blog_automation.is_active`)
2. Há oportunidades no Radar? (`article_opportunities` com status pendente)
3. Limite do plano foi atingido?
4. Verificar logs de erro em SessionDiagnosticsTab

### 6.2 Cliente Não Consegue Logar

**Possíveis causas**:
1. Email não confirmado (verificar `auto_confirm_email`)
2. OAuth mal configurado (domínios autorizados no Google Cloud)
3. Senha incorreta (reset via Supabase)

### 6.3 Custos Não Aparecem

**Solução**:
1. Verificar se edge functions estão passando `user_id`
2. Usar `MissingCostsAlert` para migrar custos órfãos
3. Confirmar que `model_pricing` tem o modelo cadastrado

### 6.4 Erros de RLS

**Diagnóstico**:
1. Verificar role do usuário em `user_roles`
2. Confirmar policy existe para a operação
3. Para tabelas de sistema, usar `service_role`

### 6.5 Domínio Customizado Não Funciona

**Checklist**:
1. Registro A aponta para `185.158.133.1`?
2. Cloudflare está em "DNS Only" (grey cloud)?
3. Domínio configurado como "Active" (não Redirect) no Lovable?
4. Token de verificação TXT está correto?

---

## Contato

Para questões não cobertas neste guia, abra um ticket de suporte técnico.