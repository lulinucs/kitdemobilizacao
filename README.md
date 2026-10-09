# Diretório de Mobilização

Site responsivo em React + TypeScript para consultar iniciativas de mobilização política. A busca ignora acentos e maiúsculas, pode ser combinada com categoria e atividade e mantém os filtros na URL para compartilhamento.

## Executar localmente

Requer Node.js 20 ou superior.

```bash
npm install
npm run dev
```

O terminal exibirá o endereço local do site.

## Testes e build

```bash
npm test
npm run build
npm run preview
```

O build estático é gerado em `dist/`. Essa pasta pode ser publicada em serviços como GitHub Pages, Netlify, Cloudflare Pages ou Vercel. Configure o provedor para executar `npm run build` e publicar `dist`.

## Adicionar uma iniciativa

1. Edite `src/data/iniciativas.json`.
2. Inclua o registro em `iniciativas`, usando um `id` único e uma categoria/atividade já existente.
3. Use apenas URLs `https:`. Marque um link como `principal: true`.
4. Preencha `verificacao` sem apresentar conteúdo não verificado como checado.
5. Atualize o número esperado na validação somente se a ampliação do diretório for intencional.
6. Rode `npm test` e `npm run build`.

O conteúdo do JSON é renderizado como texto pelo React; não é usado `dangerouslySetInnerHTML`.
