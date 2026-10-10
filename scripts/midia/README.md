# Organização local do acervo

Os originais ficam em `public/midia/`. As ferramentas desta pasta não alteram imagens ou PDFs durante a análise.

## Gerar análise e revisão

No diretório raiz do projeto:

```powershell
python -m pip install --target scripts/midia/.deps -r scripts/midia/requirements.txt
python scripts/midia/catalogar.py
python scripts/midia/renomear.py
```

`catalogar.py` gera `inventario.csv`, `renomeacoes.csv`, `duplicatas.csv`, `possiveis-duplicatas-visuais.csv`, `relatorio.md` e `revisao.html`. Abra `scripts/midia/revisao.html` diretamente no navegador. As miniaturas estão embutidas no HTML, que fica fora de `public/` e é ignorado pelo Git. Os CSVs usam UTF-8 com BOM para facilitar a abertura no Excel do Windows.

Gerar a análise novamente substitui os CSVs e limpa aprovações manuais ainda não aplicadas. Guarde uma cópia do plano revisado antes de regenerá-lo.

O modo padrão de `renomear.py` apenas mostra propostas, conflitos e pendências. Nomes genéricos permanecem como `REVISAR`; eles nunca são renomeados pelo script.

## Aplicar após aprovação

Revise `renomeacoes.csv`. Para cada linha segura que deseja executar, mantenha `situacao=AUTOMATICO` e marque `aprovado=SIM`. Não marque linhas `REVISAR`. Depois execute:

```powershell
python scripts/midia/renomear.py --apply
```

Antes de alterar qualquer nome, o script verifica o SHA-256 original, a existência dos destinos, colisões sem distinção de maiúsculas e minúsculas, pasta e extensão. Renomeações que alteram apenas a caixa usam um nome intermediário na mesma pasta. Nenhum destino é substituído e nenhuma duplicata é apagada. O script grava cada alteração imediatamente em `scripts/midia/manifestos/renomeacoes-*.csv`. Guarde e versione esse manifesto com a mudança dos arquivos.

Para restaurar os nomes de uma aplicação específica, desde que os arquivos não tenham sido alterados nem os nomes originais ocupados:

```powershell
python scripts/midia/renomear.py --undo scripts/midia/manifestos/renomeacoes-AAAAmmdd-HHMMSS-ffffff.csv
```

Faça uma nova análise após aplicar ou desfazer renomeações. Não reutilize um plano antigo depois que os nomes ou conteúdos mudarem.
