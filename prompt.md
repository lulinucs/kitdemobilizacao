# Kit de Mobilização — Recuperar cobertura nacional do mapa com localizações aproximadas

A última atualização consolidou 549 eventos, mas deixou 374 sem coordenadas após remover 280 pins que apontavam apenas para centros municipais.

A remoção foi correta do ponto de vista da precisão, mas prejudicou a cobertura visual do mapa nacional.

Precisamos recuperar esses eventos no mapa SEM fingir que conhecemos o endereço exato das manifestações.

## 1. Criar três níveis de localização

**Localização exata**
- Coordenadas de endereço, estabelecimento ou ponto de encontro confirmado.
- Pin normal do evento.
- Pode ser usada para calcular distâncias mais precisas.

**Localização aproximada**
- Município e UF identificados com segurança, mas ponto de encontro desconhecido ou não geocodificado.
- Utilizar coordenadas representativas do município.
- Marcar explicitamente `precisao: "cidade"`, respeitando o modelo de dados existente.
- Nunca apresentar essas coordenadas como endereço do evento.

**Localização pendente**
- Município/UF incertos ou inconsistentes.
- Não criar pin.
- Registrar o motivo para revisão humana.

Não alterar o endereço textual original para fazê-lo coincidir com o centro municipal.

## 2. Recuperar a cobertura usando dados existentes

Antes de consultar serviços externos:

1. Inspecionar o histórico Git e o cache de geocodificação.
2. Identificar coordenadas municipais anteriormente removidas.
3. Reutilizar somente coordenadas cuja correspondência município + UF seja confiável.
4. Não recuperar pins que apontavam para outro município ou estado.
5. Não transformar coordenadas municipais em coordenadas exatas.
6. Preservar todas as localizações precisas adicionadas na atualização anterior.

Se necessário, criar um índice reutilizável de coordenadas municipais, evitando geocodificar a mesma cidade dezenas de vezes.

Não executar uma geocodificação nacional completa.

## 3. Diferenciar visualmente os pins

No Leaflet, manter as cores de status temporal:

- Vermelho: acontecendo agora.
- Coral: possivelmente acontecendo ainda.
- Amarelo: atividade futura.

Adicionar uma distinção independente para precisão geográfica:

- Pin sólido: localização exata.
- Pin com contorno tracejado ou centro vazado: localização aproximada.

Não usar as mesmas cores para representar precisão e status.

Ao abrir um evento aproximado, mostrar claramente:

"Localização aproximada — o marcador representa o município, não o ponto de encontro."

Exibir também o local textual divulgado pela organização, quando disponível.

## 4. Ajustar os clusters

Os clusters em formato de anel, que mostram a composição por status temporal, já funcionam e devem ser preservados.

Verificar o comportamento quando muitos eventos aproximados compartilham a mesma coordenada municipal.

- Manter a contagem correta.
- Não perder eventos sobrepostos.
- Permitir acessar todos os eventos do agrupamento.
- Evitar que o usuário confunda um cluster no centro municipal com um único local de concentração.
- Não espalhar artificialmente coordenadas aproximadas para simular endereços diferentes.

## 5. Melhorar "Perto de mim"

Preservar a privacidade implementada anteriormente.

- Coordenadas GPS somente na memória do navegador.
- Nenhuma transmissão para backend, analytics ou geocodificadores.
- Nenhuma persistência local.
- Nenhum GPS pessoal em URLs externas.
- Não recentralizar tiles externos na posição GPS exata.

Para eventos com localização aproximada:
- Permitir estimativa de distância até o município.
- Exibir "Distância aproximada".
- Não apresentar a distância como trajeto ou distância até o ponto de encontro.

Para eventos com localização exata:
- Manter o cálculo local de distância em linha reta.

Ordenar os resultados por distância estimada, sinalizando a diferença de precisão.

## 6. Atualizar indicadores do mapa

Separar claramente:

- Total de mobilizações.
- Eventos com localização exata.
- Eventos com localização aproximada.
- Eventos sem município confiável.

O contador "localizadas no mapa" deve incluir exatas e aproximadas, mas o detalhamento precisa deixar essa distinção transparente.

Preservar o layout responsivo atual, especialmente a versão mobile.

## 7. Validações

Adicionar ou atualizar testes para garantir:

- Coordenadas municipais não são apresentadas como exatas.
- Município e UF são consistentes.
- Eventos aproximados aparecem no mapa.
- Eventos sobrepostos continuam acessíveis.
- Clusters mantêm contagens e cores corretas.
- "Perto de mim" não transmite GPS.
- Distâncias aproximadas são identificadas corretamente.
- Nenhuma coordenada precisa foi perdida.
- Build de produção aprovado.

## 8. Relatório final

Informar:

- Quantidade de eventos com localização exata.
- Quantidade com localização aproximada.
- Quantidade ainda sem coordenadas.
- Quantidade de municípios representados.
- Quantidade de coordenadas recuperadas do histórico/cache.
- Quantidade de novas consultas externas.
- Resultado dos testes e do build.

Não fazer commit, push ou deploy.

**Objetivo final: um mapa nacional abrangente, visualmente bonito, geograficamente honesto e que preserve a privacidade dos visitantes.**

Não redesenhar a página nem modificar componentes fora do necessário. Preservar a identidade visual e a experiência mobile existentes.