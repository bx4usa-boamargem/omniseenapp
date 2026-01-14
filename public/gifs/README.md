# Tutorial GIFs

Esta pasta contém GIFs tutoriais para a Central de Ajuda da Omniseen.

## Como adicionar novos GIFs

1. Grave a tela demonstrando a funcionalidade
2. Converta para GIF (recomendado: 720p, 15fps, máx 5MB)
3. Nomeie o arquivo de forma descritiva (ex: `criar-artigo-radar.gif`)
4. Coloque nesta pasta

## GIFs Planejados

- [ ] `criar-artigo-radar.gif` - Como criar artigo a partir do Radar
- [ ] `ativar-automacao.gif` - Como ativar a automação
- [ ] `configurar-empresa.gif` - Como configurar perfil da empresa
- [ ] `usar-editor.gif` - Como usar o editor de artigos
- [ ] `publicar-artigo.gif` - Como publicar um artigo
- [ ] `agendar-publicacao.gif` - Como agendar publicação
- [ ] `personalizar-blog.gif` - Como personalizar o portal público
- [ ] `conectar-dominio.gif` - Como conectar domínio próprio
- [ ] `ver-resultados.gif` - Como interpretar os resultados
- [ ] `configurar-territorios.gif` - Como adicionar territórios

## Uso nos Artigos

Para usar um GIF em um artigo de ajuda, use a sintaxe:

```markdown
![gif:nome-do-arquivo.gif]
```

O parser em `ClientHelpArticle.tsx` irá renderizar automaticamente.
