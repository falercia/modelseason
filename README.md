# Model Season

**modelseason.com**

Página estática que mostra para onde vai o tráfego de tokens dos modelos de linguagem no OpenRouter: share por laboratório, open-weights vs. proprietário, China vs. EUA, posição da Anthropic e ciclo de vida dos modelos. Atualizada todo dia por GitHub Actions; hospedada na Vercel.

## Como funciona

```
OpenRouter API ──▶ pipeline/fetch.py ──▶ data/rankings_daily.csv (histórico bruto, versionado)
                                              │
                                              ▼
                                     pipeline/build.py ──▶ public/data.json
                                                                 │
GitHub Actions (06:30 UTC) commita os dois arquivos ──▶ Vercel redeploya ──▶ public/index.html lê data.json
```

A página não tem backend nem chave de API: é HTML + D3 (vendorizado em `public/vendor`) lendo um JSON estático. Toda a inteligência de agregação está em Python, no pipeline.

## Rodar local

```bash
pip install -r pipeline/requirements.txt
export OPENROUTER_API_KEY=sk-or-v1-...
python pipeline/fetch.py     # incremental: busca só os dias que faltam (+3 de sobreposição)
python pipeline/build.py     # gera public/data.json
python -m http.server 8000 --directory public   # abre http://localhost:8000
```

`data/rankings_daily.csv` já vem com o histórico de 2025-01-01 até 2026-08-31, então o primeiro `fetch.py` só busca os dias faltantes.

## Deploy

1. Repositório: `github.com/falercia/modelseason`.
2. Criar o secret `OPENROUTER_API_KEY` (Settings → Secrets and variables → Actions, ou `gh secret set OPENROUTER_API_KEY`, que pede a chave por prompt e não deixa rastro no histórico do shell). A chave nunca entra em arquivo, comentário ou log.
3. Rodar o workflow "Atualizar dados diariamente" manualmente uma vez (Actions → Run workflow) para validar.
4. Na Vercel, importar o repositório. O `vercel.json` já define `outputDirectory: public` sem build. Cada commit do bot dispara um deploy.

## Operação e alertas

O workflow `.github/workflows/daily.yml` roda às 06:30 UTC (03:30 America/Sao_Paulo) e:

- aborta cedo, com mensagem clara, se o secret não estiver configurado;
- tenta o `fetch.py` até 3 vezes, com 60s entre as tentativas, para absorver 429 e instabilidade da API;
- roda `pipeline/check_freshness.py`, o guard de integridade descrito abaixo;
- em caso de falha, abre (ou comenta em) uma issue com a label `pipeline`, contendo o link do run e um checklist de diagnóstico. O GitHub notifica por e-mail. Se o problema persistir, ele comenta na issue existente em vez de abrir outra;
- quando volta a funcionar, comenta e fecha a issue automaticamente.

### Guard de integridade

`pipeline/check_freshness.py` roda depois do fetch e faz três verificações, em ordem de gravidade.

| Verificação | Comportamento | Por que existe |
|---|---|---|
| **Duplicatas** por `(date, model_permaslug)` | **Falha sempre** | É a falha mais cara e a mais silenciosa. Se o dedupe do `fetch.py` quebrar, a agregação semanal soma o mesmo volume duas vezes e todo número da página fica errado sem nada parecer anormal |
| **Frescor** | **Avisa** a partir de 2 dias de atraso, **falha** a partir de 10 | A fonte atrasa publicação com alguma frequência. O aviso aparece no run e não abre issue; a falha abre |
| **Buracos** no histórico | Informativo | `2025-06-15` e `2025-07-15` nunca foram publicados pela fonte e estão catalogados em `BURACOS_CONHECIDOS`. Um dia ausente fora dessa lista vira aviso |

A separação entre aviso e falha é deliberada: alerta que dispara por atraso da fonte, e não por defeito do pipeline, treina você a ignorar alerta.

Rodar localmente:

```bash
python pipeline/check_freshness.py                                  # avisa em 2d, falha em 10d
python pipeline/check_freshness.py --max-lag-days 5 --warn-lag-days 1
```

O `workflow_dispatch` aceita `max_lag_days` e `warn_lag_days` como parâmetros, então dá para testar outro limite sem editar arquivo.

Para receber também o e-mail nativo de falha do Actions: GitHub → Settings → Notifications → Actions → "Send notifications for failed workflows only".

## Limites conhecidos da API

- Janela máxima de 366 dias por chamada (o `fetch.py` fatia em blocos de 365).
- 30 req/min por chave, 500/dia por conta. O fetch diário usa 1 chamada.
- Dataset começa em 2025-01-01. Linha `other` = volume fora do top 50 diário.
- `period=week` só funciona com filtro `category` ou `language_type`; por isso a agregação semanal é feita localmente a partir do diário.
- Licença CC BY 4.0: manter atribuição ao OpenRouter na página.

## Classificações (pipeline/build.py)

`origin` (país-sede do lab) e `weights` (Open-weights / Proprietário / Não identificado) são atribuídos por vendor e por padrão de nome. Ajustar os conjuntos `CN`, `US`, `EU`, `OPEN_V` e a função `openw()` quando surgirem labs ou modelos novos. Modelos `stealth/*` e `openrouter/*-alpha` são testes anônimos.
