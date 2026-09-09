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
2. Em Settings → Secrets and variables → Actions, criar `OPENROUTER_API_KEY`.
3. Rodar o workflow "Atualizar dados diariamente" manualmente uma vez (Actions → Run workflow) para validar.
4. Na Vercel, importar o repositório. O `vercel.json` já define `outputDirectory: public` sem build. Cada commit do bot dispara um deploy.

## Limites conhecidos da API

- Janela máxima de 366 dias por chamada (o `fetch.py` fatia em blocos de 365).
- 30 req/min por chave, 500/dia por conta. O fetch diário usa 1 chamada.
- Dataset começa em 2025-01-01. Linha `other` = volume fora do top 50 diário.
- `period=week` só funciona com filtro `category` ou `language_type`; por isso a agregação semanal é feita localmente a partir do diário.
- Licença CC BY 4.0: manter atribuição ao OpenRouter na página.

## Classificações (pipeline/build.py)

`origin` (país-sede do lab) e `weights` (Open-weights / Proprietário / Não identificado) são atribuídos por vendor e por padrão de nome. Ajustar os conjuntos `CN`, `US`, `EU`, `OPEN_V` e a função `openw()` quando surgirem labs ou modelos novos. Modelos `stealth/*` e `openrouter/*-alpha` são testes anônimos.
