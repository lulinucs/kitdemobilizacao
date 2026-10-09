# Utilitários da agenda

## Importação em lote

O arquivo `importar_agenda.mjs` valida e acrescenta eventos ao JSON atual da agenda sem substituir registros existentes.

O arquivo de entrada pode ser uma lista JSON de eventos ou um objeto com uma propriedade `eventos`. Os campos seguem o mesmo formato de `src/data/agenda-floripa.json`.

Simule primeiro:

```powershell
node utils/importar_agenda.mjs caminho\eventos.json --dry-run
```

Depois de revisar o relatório, grave os registros válidos:

```powershell
node utils/importar_agenda.mjs caminho\eventos.json --write
```

O utilitário verifica campos obrigatórios, datas, horários, UFs, categorias, status, modalidades e IDs. IDs já existentes ou repetidos bloqueiam a gravação. Possíveis duplicações por data, instituição/campus, cidade e horário aparecem como avisos no relatório.

Eventos com horário desconhecido devem usar `"inicio": null`. Eventos virtuais podem omitir `cidade` e `uf` e usar `"modalidade": "virtual"`. O script nunca associa eventos a uma mobilização automaticamente; `mobilizacaoId` precisa vir explicitamente no arquivo de entrada.

Destaques editoriais usam `"destaques": ["identificador-do-destaque"]`. Esse campo não substitui `mobilizacaoId`: ele apenas seleciona registros para uma apresentação ou filtro editorial.
