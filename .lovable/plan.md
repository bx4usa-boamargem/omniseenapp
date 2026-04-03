
Objetivo: corrigir o fluxo de acesso para que você consiga chegar ao login e entrar no dashboard sem ficar preso em carregamento, redirecionamento ou logout forçado.

O que eu encontrei no código
- O acesso passa por uma cadeia frágil de 4 camadas: `src/main.tsx` → `PlatformEntryRedirect` em `src/App.tsx` → `Login.tsx` → `SubAccountGuard`/`TenantGuard` + `TenantContext`.
- Hoje existem vários timeouts e redirects concorrentes:
  - `main.tsx` tenta mandar `/` para `/login`
  - `PlatformEntryRedirect` decide entre `/login` e `/client/dashboard`
  - `Login.tsx` redireciona automaticamente se detectar usuário
  - `SubAccountGuard` e `TenantGuard` podem dar `signOut()` depois de 5s se auth/tenant demorarem
- Isso cria uma condição de corrida: uma sessão lenta ou tenant demorando pode expulsar o usuário antes do dashboard abrir.
- Há também um detalhe importante: o login com Google está hardcoded para callback de produção (`app.omniseen.app`), então não devo “corrigir” preview mexendo nisso se o problema for só no preview.

Causa mais provável
- O problema não parece ser a rota do dashboard em si, e sim a orquestração do estado de autenticação/tenant.
- Os guards estão agressivos demais: se o tenant atrasar, eles limpam sessão e mandam para login.
- O root `/` depende de um redirect automático; se esse handoff falha ou atrasa, o usuário fica sem um caminho confiável até o login/dashboard.

Plano de correção
1. Tornar a entrada `/` determinística em `src/App.tsx`
- Ajustar `PlatformEntryRedirect` para:
  - enviar rápido para `/login` quando não houver sessão resolvida
  - enviar para `/client/dashboard` só quando a sessão estiver realmente estável
  - mostrar ação manual de “Ir para login” se a resolução atrasar
- Evitar depender só de loading passivo.

2. Reduzir os logout forçados em `src/components/auth/SubAccountGuard.tsx` e `src/components/auth/TenantGuard.tsx`
- Parar de usar `signOut()` automático como reação padrão a lentidão de tenant.
- Manter:
  - redirect para `/login` apenas quando auth estiver resolvido e não houver usuário
  - estado de erro/recuperação quando tenant falhar
  - botão de retry em vez de expulsar sessão válida
- Isso elimina o loop “entra → tenant demora → sessão é limpa”.

3. Fortalecer `src/contexts/TenantContext.tsx`
- Garantir que retries e timeouts não deixem loading inconsistente.
- Separar claramente:
  - “auth ainda carregando”
  - “tenant carregando”
  - “tenant falhou”
  - “sem tenant, precisa provisionar”
- Evitar que retry assíncrono tardio sobrescreva estado já resolvido.

4. Ajustar o handoff do login em `src/pages/auth/Login.tsx`
- Garantir que o formulário sempre apareça quando auth init atrasar.
- Preservar redirect pós-login sem competir com redirects automáticos da raiz.
- Melhorar mensagem/estado quando houver sessão parcial ou backend lento.

5. Revisar pós-login e provisionamento em `src/components/auth/AutoProvisionTenant.tsx`
- Não mandar sempre para onboarding em qualquer resposta “already_provisioned”.
- Decidir corretamente entre onboarding e dashboard com base no estado real da conta/blog.
- Isso evita outro bloqueio depois do login.

6. Validar o contexto de preview vs publicado
- Se o problema for só no preview, não alterar callback OAuth nem configuração de auth por causa disso.
- Nesse caso, manter o fluxo de email/senha funcionando no preview e evitar mudanças perigosas de ambiente.

Arquivos que eu alteraria
- `src/App.tsx`
- `src/components/auth/SubAccountGuard.tsx`
- `src/components/auth/TenantGuard.tsx`
- `src/contexts/TenantContext.tsx`
- `src/pages/auth/Login.tsx`
- `src/components/auth/AutoProvisionTenant.tsx`

Resultado esperado após a correção
- Abrir `/` leva corretamente ao login quando você estiver deslogado.
- Após login, o app entra no dashboard sem limpar sua sessão por timeout intermediário.
- Se o tenant/backend atrasar, você verá retry/erro recuperável, não tela travada nem expulsão silenciosa.
- O fluxo fica estável tanto para login quanto para abertura do dashboard.

Validação que eu faria depois de implementar
- Acessar `/` deslogado e confirmar redirecionamento para `/login`
- Fazer login com email/senha e confirmar abertura de `/client/dashboard`
- Simular tenant lento/ausente e confirmar fallback com retry, sem logout forçado
- Confirmar que não há loop entre `/`, `/login`, `/client/dashboard` e onboarding
- Testar no preview e no publicado para separar bug real de comportamento específico do preview

Detalhes técnicos
- Eu não trataria isso como “problema visual do dashboard”; é um bug de controle de acesso/estado.
- Eu evitaria mexer em `src/integrations/supabase/client.ts`.
- Eu também evitaria “corrigir” preview alterando URLs OAuth de produção, porque isso pode quebrar o ambiente real.
