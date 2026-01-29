# Motor de Artigos OmniSeen - Changelog

> Registro de alterações no Motor de Artigos de Autoridade Local.
> 
> Referência: `docs/ARTICLE_ENGINE_MASTER.md`

---

## [1.0.0] - 2026-01-29

### Adicionado
- Documento-mestre inicial com especificação completa
- Arquitetura multi-dimensional (Nicho, Subconta, Intenção, Template, Modo)
- 5 templates estruturais com variantes anti-padrão
- 13 nichos configurados
- Pipeline de 12 etapas
- Checklist de validação de 25 pontos
- Regras de Ouro (6 princípios invioláveis)
- Estruturas TypeScript no frontend (`src/lib/article-engine/`)

### Mapeamento do Sistema Existente
- Identificado pipeline em `generate-article-structured/index.ts`
- Identificado GEO Writer em `geoWriterCore.ts`
- Identificado rotação estrutural em `structureRotation.ts`
- Tabela `niche_profiles` com 13+ nichos já configurados
- Tabela `articles` com 57 colunas

---

## Formato de Changelog

### [X.Y.Z] - AAAA-MM-DD

#### Adicionado
- Novas features

#### Modificado
- Alterações em features existentes

#### Corrigido
- Bug fixes

#### Removido
- Features removidas

#### Segurança
- Correções de segurança

---

## Próximas Versões Planejadas

### [1.1.0] - Sprint 2
- [ ] Seleção de template inteligente (`templateSelector.ts`)
- [ ] Integração com pipeline existente

### [1.2.0] - Sprint 3
- [ ] E-E-A-T avançado por nicho
- [ ] ALT de imagens contextualizado

### [1.3.0] - Sprint 4
- [ ] Interface de preview de template
- [ ] Formulário avançado de brief
