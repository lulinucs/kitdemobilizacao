# Kit de Mobilização

Acervo independente e responsivo, em React + TypeScript, para consultar iniciativas, ferramentas, materiais e agendas de mobilização para o segundo turno das eleições de 2026. O portal agrega recursos existentes e não representa uma organização ou movimento político.

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
