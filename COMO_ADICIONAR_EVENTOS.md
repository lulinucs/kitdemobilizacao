# Como adicionar eventos à Agenda Floripa

A agenda usa exclusivamente o arquivo `src/data/agenda-floripa.json`, importado estaticamente no build. Não há banco de dados nem painel administrativo.

## Exemplo mínimo

```json
{
  "id": "atividade-centro-1210",
  "titulo": "Nome divulgado da atividade",
  "categoria": "conversa",
  "data": "2026-10-12",
  "inicio": "14:00",
  "fim": null,
  "local": "Local divulgado",
  "bairro": "Centro",
  "descricao": "Descrição factual recebida da organização.",
  "status": "divulgado"
}
```

1. Use um `id` único, minúsculo e sem espaços.
2. Use uma categoria já declarada em `categorias`.
3. Datas seguem `AAAA-MM-DD`; horários seguem `HH:MM` no fuso `America/Sao_Paulo`.
4. Se a data não foi informada, use `data: null`, `status: "data_pendente"` e registre a informação recebida em `recorrencia.texto`. Não crie recorrências presumidas.
5. Status aceitos: `divulgado`, `confirmado`, `cancelado`, `alterado` e `data_pendente`. `encerrado` também pode ser derivado pela interface.
6. Não invente endereço, horário, organizador ou links ausentes.
7. Rode `npm test` e `npm run build`, então publique a nova pasta `dist/`.

## Nota de normalização

Os rótulos ambíguos de sexta e sábado recebidos na fonte foram normalizados, pelo contexto fornecido, para 9 e 10 de outubro de 2026. Essa decisão está preservada nas datas ISO existentes e não deve ser reinterpretada como setembro.
