# data/

Dois datasets tabulares, versionados a cada atualização diária, e as pastas de snapshots brutos das fontes que não guardam histórico.

## `rankings_daily.csv`

Histórico bruto de volume, uma linha por dia e por modelo, desde 01/01/2025.

| Coluna | Tipo | Descrição |
|---|---|---|
| `date` | `YYYY-MM-DD` | Dia UTC |
| `model_permaslug` | texto | Slug estável do modelo, `vendor/modelo-YYYYMMDD`. Pode ter sufixo (`:free`, `:beta`, `:thinking`, `:extended`), que identifica um endpoint alternativo do mesmo modelo, não outro modelo. A linha `other` agrega todo o volume fora do top 50 daquele dia |
| `total_tokens` | inteiro | Tokens processados no dia, prompt e completion somados, contados pelo tokenizador de cada provedor |

O `fetch.py` refaz os últimos 3 dias a cada execução, para absorver revisões da fonte, e deduplica por `(date, model_permaslug)` mantendo o valor mais recente.

**Dias ausentes:** `2025-06-15` e `2025-07-15` nunca foram publicados pela fonte. As semanas que os contêm ficam fora dos gráficos, porque `build.py` só usa semanas com 7 dias.

## `models_catalog.csv`

Metadados de cada modelo: preço, contexto, data de lançamento, modalidade, pesos e índices de qualidade.

**Por que ele é acumulativo.** O endpoint `/api/v1/models` é um retrato do agora. Modelo descontinuado some dele e leva junto todo o metadado. O ranking, em compensação, guarda o modelo para sempre. Sem acumular, cada modelo que sai do ar viraria uma linha sem metadado no histórico, de forma irreversível. Por isso linhas nunca são removidas: `first_seen` e `last_seen` marcam a janela em que o modelo esteve listado, e `active` diz se ele estava no catálogo na última execução.

| Coluna | Descrição |
|---|---|
| `canonical_slug` | Chave de junção com o `model_permaslug` do ranking, depois de remover o sufixo |
| `model_id`, `name`, `vendor` | Identificação |
| `created_at` | Data de lançamento informada pela fonte, não inferida do nome |
| `context_length`, `max_completion_tokens` | Janela |
| `price_prompt`, `price_completion`, `price_cache_read`, `price_cache_write` | USD por token |
| `modality`, `input_modalities`, `output_modalities`, `tokenizer` | Arquitetura |
| `hugging_face_id` | Presença comprova pesos abertos. Ausência não prova o contrário |
| `reasoning` | Se o modelo suporta raciocínio |
| `aa_intelligence`, `aa_coding`, `aa_agentic` | Índices da Artificial Analysis, expostos pela API do OpenRouter |
| `da_elo_models` | Elo mediano nas categorias da arena `models` do Design Arena |
| `da_categorias` | Quantas categorias entraram nessa mediana |
| `first_seen`, `last_seen`, `active` | Janela de presença no catálogo |

**Cobertura.** Em 09/09/2026, 347 modelos distintos, cobrindo 99,9% do volume da última semana e 88% do volume histórico. A diferença são modelos descontinuados antes do primeiro snapshot, e ela diminui a cada dia que o catálogo roda.

**Consolidação de variantes.** Vários `id` compartilham o mesmo `canonical_slug`, por exemplo `:free`, `:batch` e `:thinking` do mesmo modelo. O `fetch_models.py` consolida por slug: preço vem da variante sem sufixo, que é o modelo de verdade, e os demais campos são coalescidos.

## Snapshots brutos: `tasks/`, `sessions/`, `benchmarks/`, `endpoints/`, `apps/`, `providers/`, `zdr/`, `catalogs/`

Uma foto por dia das fontes que só mostram o presente, gravada por `pipeline/snapshots.py`. Detalhes de cada fonte e das regras em [`docs/pipeline.md`](../docs/pipeline.md#arquivo-das-fontes-sem-histórico).

- **Nome:** `AAAA-MM-DD.json.gz`, com a data informada pela própria fonte. Revisão da fonte para um dia já gravado vira `AAAA-MM-DD.r2.json.gz`; o original nunca é alterado.
- **Conteúdo:** um envelope com `source`, `as_of`, `fetched_at`, `content_sha256`, `citation`, `license` e `requests`, a lista de chamadas feitas com `path`, `params` e a `response` exatamente como a API devolveu.
- **Ler:** `gzip -dc data/tasks/2026-09-10.json.gz | jq .`

Estes arquivos são a fonte de verdade. Qualquer tabela derivada deles, inclusive o banco da v2, pode ser reconstruída a partir daqui.

## Licença e atribuição

Todos os arquivos derivam de endpoints públicos do OpenRouter e estão sob [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Ao republicar ou citar:

> Source: OpenRouter (openrouter.ai/rankings), as of {as_of}.

As colunas `aa_*` do catálogo são índices produzidos pela **Artificial Analysis** e distribuídos pela API do OpenRouter. Cite a Artificial Analysis ao usar especificamente esses campos.

O campo `as_of` está em `public/data.json`.
