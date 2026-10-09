# Prompt para o Codex — Diretório de Mobilização

Implemente um site completo e responsivo, em português brasileiro, para organizar e facilitar a descoberta de iniciativas de mobilização política. A inspiração de arquitetura de informação é o Pirataria.link: navegação lateral, índice por tópicos, busca muito evidente e leitura rápida. Não copie identidade visual, código ou marca do site de referência.

## Fonte de dados

- Utilize **exclusivamente** `iniciativas.json` como fonte de dados das iniciativas, categorias, atividades, links e descrições. Coloque-o em `src/data/iniciativas.json` (ou em `public/data/` se justificar tecnicamente).
- Preserve todos os 11 registros, IDs e URLs exatamente como fornecidos. Não invente novos links, números, endossos ou informações de verificação.
- Os registros com `verificacao.status = "nao-verificado"` não devem ser apresentados como checados. O campo `verificacao.observacao` pode aparecer em um detalhe discreto, sobretudo para links indiretos e endereços potencialmente desatualizados.
- A mesma iniciativa pode aparecer em vários filtros por meio de `atividades`, sem duplicação de registros.
- Valide integridade e IDs únicos em desenvolvimento; URLs devem ser `https:` e links externos abrir com `target="_blank" rel="noopener noreferrer"`.
- Não utilize `dangerouslySetInnerHTML` com conteúdo do JSON.

## Stack e qualidade

- React + TypeScript + Vite; CSS moderno (CSS Modules ou Tailwind, escolha uma opção e mantenha consistência); ícones Lucide.
- Sem backend, banco de dados, autenticação, analytics, cookies de rastreamento ou bibliotecas desnecessárias.
- Código organizado em componentes reutilizáveis: `AppShell`, `Sidebar`, `Search`, `CategoryNav`, `ActivityFilters`, `InitiativeCard`, `InitiativeList`, `EmptyState`, `ThemeToggle`.
- Projeto pronto para `npm install`, `npm run dev`, `npm run build`.
- Tipos TypeScript correspondentes ao esquema JSON; tratar valores opcionais e links múltiplos.

## Experiência de uso

- **Prioridade absoluta: encontrar um recurso em poucos segundos.** O site é um diretório útil, não uma landing page institucional.
- Desktop: sidebar fixa ou sticky à esquerda com Início, categorias e atividades; conteúdo principal em largura confortável (aprox. 850–1000px); cabeçalho discreto com busca e tema.
- Mobile: menu recolhível acessível, busca no topo e filtros horizontais; nenhuma rolagem horizontal da página.
- Página inicial: título breve, explicação em até duas linhas, busca proeminente, atalhos "Quero compartilhar", "Quero conversar", "Quero imprimir", "Quero organizar", seguidos do índice de iniciativas.
- Cards compactos, legíveis, com nome, sinopse, tags discretas e **link principal bem visível**; links secundários separados (ex.: WhatsApp e Instagram). Não esconder o link principal em menus.
- Listagem adaptável: desktop pode exibir uma coluna de cards compactos ou duas quando houver espaço; mobile uma coluna.
- Busca instantânea, sem distinção de maiúsculas/minúsculas e acentos, em `nome`, `descricao`, `tags`, `categoria` e rótulos dos links.
- Permitir combinar categoria + atividade + texto; chips removíveis; botão "Limpar filtros"; contador de resultados e estado vazio útil.
- Navegação com URL compartilhável, usando query params (`?categoria=nas-redes&atividade=compartilhar&q=...`) ou rotas equivalentes. Botões Voltar/Avançar devem funcionar.
- Ordenação padrão: ordem da categoria, depois nome; oferecer ordenação alfabética se útil.
- Tema claro/escuro com preferência do sistema e escolha manual persistida em localStorage; contrastes AA; foco visível; navegação por teclado; `aria-label` em ícones interativos.
- Não use carrosséis, animações excessivas, hero gigante, contadores fictícios ou fotos decorativas.

## Informação e responsabilidade

- Preserve linguagem informativa e descritiva, sem acrescentar chamadas persuasivas próprias ou alegações não verificadas.
- Exiba aviso curto no rodapé: "Diretório independente de links de terceiros. Verifique informações e respeite a legislação eleitoral e as regras de uso dos espaços."
- Em recursos para colagem de cartazes, evitar instruir afixação em locais proibidos.
- Links que apontam para notícias ou páginas explicativas devem ser rotulados como tal, não como se fossem a ferramenta em si.
- Sem afirmar que qualquer iniciativa é oficial, a menos que haja confirmação documental.

## Entrega

1. Implemente todos os arquivos e componentes, sem pseudocódigo.
2. Crie README com instruções de execução, build, deploy estático e como adicionar uma iniciativa ao JSON.
3. Adicione validação simples do JSON e testes úteis de filtragem e busca (Vitest se for adequado).
4. Rode build e testes e corrija os erros encontrados.
5. Ao final, apresente resumo dos arquivos criados, decisões de UX e comandos executados.

Critério de sucesso: alguém que entre pelo celular deve conseguir localizar e abrir uma iniciativa relevante em até três interações, sem precisar entender previamente o nome de cada projeto.
