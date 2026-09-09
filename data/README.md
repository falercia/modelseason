# data/

`rankings_daily.csv` é o histórico bruto, uma linha por `(dia, modelo)`, desde 2025-01-01.

| Coluna | Tipo | Descrição |
|---|---|---|
| `date` | `YYYY-MM-DD` | Dia UTC |
| `model_permaslug` | texto | Slug estável do modelo, no formato `vendor/modelo-YYYYMMDD`. A linha `other` agrega todo o volume fora do top 50 daquele dia |
| `total_tokens` | inteiro | Tokens processados no dia, contados pelo tokenizador de cada provedor |

Atualizado diariamente por `.github/workflows/daily.yml`. O `fetch.py` refaz os últimos 3 dias a cada execução, para absorver revisões da fonte, e deduplica por `(date, model_permaslug)` mantendo o valor mais recente.

**Dias ausentes:** `2025-06-15` e `2025-07-15` nunca foram publicados pela fonte. As semanas que os contêm ficam de fora dos gráficos, porque `build.py` só usa semanas com 7 dias.

**Licença.** Dados sob CC BY 4.0. Atribuição exigida:

> Source: OpenRouter (openrouter.ai/rankings), as of {as_of}.

O campo `as_of` está em `public/data.json`.
