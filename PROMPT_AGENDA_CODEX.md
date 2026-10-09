# Codex — implementar Agenda Floripa no diretório existente

Leia a estrutura do projeto e preserve a identidade visual, navegação, acessibilidade e catálogo existentes. Integre `agenda-floripa.json` como fonte única de dados da agenda, sem backend nem banco de dados. Não reescreva o catálogo de iniciativas.

## Interface
- Criar item fixo `Agenda Floripa` na sidebar e no menu mobile, separado das categorias de iniciativas.
- Criar widget compacto `Próxima atividade` na home e, em desktop, também na lateral direita quando houver espaço. Mostrar título, data, hora, bairro/local e botão `Ver agenda`. Se não houver atividade futura confirmada/divulgada com data e horário, mostrar `Nenhuma atividade futura cadastrada` e link para a agenda; nunca mostrar atividade passada como próxima.
- Criar visualização expandida da agenda com cabeçalho `Mobilizações em Florianópolis`, dias selecionáveis e linha do tempo por horário. Permitir alternar para lista cronológica. Cards compactos com horário, título, local, bairro, descrição, orientações de participação e links úteis.
- Filtros combináveis por dia, bairro e categoria, com busca textual por título/local/descrição. Indicar contagem de resultados e oferecer `Limpar filtros`. Sem resultados: estado vazio claro.
- Na home e na agenda, usar o fuso `America/Sao_Paulo` para definir dia atual e próximo evento. Ordenar por data e hora, com tratamento explícito de hora final ausente.
- Para eventos sem data, criar seção separada `Atividades com data a confirmar`, nunca incluí-los na lista cronológica ou no widget de próxima atividade.
- Link permanente para cada evento (`/agenda/:id` ou query param com suporte a refresh em hospedagem estática). Botão `Compartilhar` usa Web Share API se disponível, com fallback de copiar link e texto. Botão `Ver no mapa` apenas se endereço/local puder ser resolvido sem inventar coordenadas; usar URL de pesquisa do Google Maps com o texto de endereço/local existente, devidamente codificado.
- Mostrar aviso geral de confirmação e badge discreto de status. `divulgado` não equivale a verificado; prever `confirmado`, `cancelado`, `alterado`, `data_pendente` e `encerrado` (encerrado pode ser derivado do tempo). Nunca criar endereços, horários ou organizadores ausentes.
- Serigrafia tem dias não informados, horário 08:00–23:00; exibir em seção pendente. Não criar recorrência semanal automaticamente.
- Não inserir o texto `9/9` e `10/9` como setembro: a fonte diz sexta/sábado, e o contexto aponta 09/10 e 10/10 de 2026. Preservar nota de normalização no código/documentação.
- Mostrar eventos passados em `Arquivo` ou filtro `Ver anteriores`, ocultos por padrão no widget e na listagem de próximas atividades.
- Garantir bom contraste, navegação por teclado, labels, foco visível, modo claro/escuro, mobile-first e sem dependências desnecessárias.

## Dados e arquitetura
- Colocar `agenda-floripa.json` em `src/data/` (import estático) ou `public/data/` (fetch); escolher e documentar. Não duplicar eventos em JSX. Tipar o schema com TypeScript ou JSDoc, validar datas, horas, IDs únicos, categorias e status na inicialização; erros de registros devem ser mostrados no console e ignorados sem quebrar a página.
- Criar utilitários puros para normalizar datas, ordenar eventos, determinar futuros/passados, filtrar, formatar datas pt-BR e gerar links de compartilhamento.
- Evitar confundir data sem fim com evento de duração zero; considerar como passado após o horário de início apenas para o widget de próxima atividade, mantendo-o visível na programação do dia.
- Criar testes de: ordenação; fuso de Florianópolis; data pendente; filtros; IDs; eventos passados; virada de dia; evento cancelado; compartilhamento.
- Adicionar documentação `COMO_ADICIONAR_EVENTOS.md` com exemplo mínimo de JSON e instruções de edição e deploy.
- Não inventar dados nem alterar textos factuais sem indicação. Ao finalizar, executar build e testes e listar arquivos modificados e limitações.
