# Pipeline e operação

Documentação técnica do Model Season. O [README](../README.md) trata do produto.

## Arquitetura

```
rankings-daily ──▶ fetch.py ───────▶ data/rankings_daily.csv ─┐
                                                              ├─▶ enrich.py ─▶ build.py ─▶ public/data.json
/api/v1/models ──▶ fetch_models.py ▶ data/models_catalog.csv ─┘                    │
                                                                          make_og.py ─▶ public/og.png
GitHub Actions (06:30 UTC) commita ──▶ Vercel redeploya ──▶ public/index.html

classifications/task ─┐
session-cost ─────────┤
benchmarks ───────────┼─▶ snapshots.py ─▶ data/{tasks,sessions,benchmarks,endpoints,apps}/AAAA-MM-DD.json.gz
models/{id}/endpoints ┤                   (GitHub Actions, 07:15 UTC, workflow próprio)
app-rankings ─────────┘
```

`fetch.py` traz volume. `fetch_models.py` traz o que cada modelo é: preço, contexto, lançamento, modalidade, pesos e índices de qualidade. `enrich.py` casa os dois e deriva as dimensões que os gráficos usam.

Toda a agregação vive em Python. A página lê um JSON e desenha com D3. Nenhum número é escrito à mão no HTML.

## Rodar local

```bash
pip install -r pipeline/requirements.txt
export OPENROUTER_API_KEY=sk-or-v1-...
python pipeline/fetch.py          # volume, incremental
python pipeline/fetch_models.py   # catálogo de modelos, não exige chave
python pipeline/build.py          # gera public/data.json
python pipeline/make_og.py        # gera o card social
python -m http.server 8000 --directory public
```

O CSV já vem com o histórico completo, então o primeiro `fetch.py` só busca a diferença. Sem a chave, `build.py` e a página funcionam com o dado que já está no repositório.

A chave nunca entra em arquivo, comentário ou log. Em CI ela vive apenas no secret `OPENROUTER_API_KEY`. Para criá-lo sem deixar rastro no histórico do shell:

```bash
gh secret set OPENROUTER_API_KEY   # pede a chave por prompt
```

## Automação

`.github/workflows/daily.yml` roda às 06:30 UTC, 03:30 em Brasília, quando o dia UTC anterior já fechou.

- aborta com mensagem clara se o secret não existir;
- tenta o `fetch.py` até 3 vezes, com 60s entre tentativas, para absorver 429 e instabilidade;
- roda o guard de integridade;
- em caso de falha, abre uma issue com label `pipeline`, link do run e checklist de diagnóstico. Se falhar de novo, comenta na issue existente em vez de abrir outra;
- quando volta a funcionar, comenta e fecha a issue.

Para o e-mail nativo do Actions: Settings → Notifications → Actions → "Send notifications for failed workflows only".

## Guard de integridade

`pipeline/check_freshness.py` roda depois do fetch, com três verificações em ordem de gravidade.

| Verificação | Comportamento | Por que existe |
|---|---|---|
| **Duplicatas** por `(date, model_permaslug)` | Falha sempre | A falha mais cara e a mais silenciosa. Se o dedupe quebrar, a agregação semanal soma o mesmo volume duas vezes e todo número da página fica errado sem nada parecer anormal |
| **Frescor** | Avisa a partir de 2 dias de atraso, falha a partir de 10 | A fonte atrasa publicação com alguma frequência. O aviso aparece no run e não abre issue |
| **Buracos** no histórico | Informativo | Os dois dias ausentes conhecidos estão em `BURACOS_CONHECIDOS`. Um dia novo fora da lista vira aviso |

A separação entre aviso e falha é deliberada. Alerta que dispara por atraso da fonte, e não por defeito do pipeline, treina qualquer um a ignorar alerta.

```bash
python pipeline/check_freshness.py                                  # avisa em 2d, falha em 10d
python pipeline/check_freshness.py --max-lag-days 5 --warn-lag-days 1
```

O `workflow_dispatch` aceita `max_lag_days` e `warn_lag_days`, então dá para testar outro limite sem editar arquivo.

## Arquivo das fontes sem histórico

Quatro fontes da API só mostram o presente: a foto de hoje apaga a de ontem. `pipeline/snapshots.py` guarda uma foto por dia de cada uma, e com o tempo isso vira uma série que não existe em nenhum outro lugar.

| Fonte | Endpoint | O que é | Histórico na fonte |
|---|---|---|---|
| `tasks` | `/classifications/task` | Share de uso por finalidade, com os modelos de cada tarefa | Nenhum, só os últimos 7 dias |
| `sessions` | `/datasets/session-cost` | Custo mediano por sessão, por harness, modelo e faixa de turnos | Nenhum, atualiza semanalmente |
| `benchmarks` | `/benchmarks` | Artificial Analysis, Design Arena e avaliações do OpenRouter, com custo por tarefa | Nenhum |
| `endpoints` | `/models/{id}/endpoints` | Preço e contexto do mesmo modelo em cada provedor, para os 50 maiores | Nenhum, e não exige chave |
| `apps` | `/datasets/app-rankings` | Top apps do dia, geral, trending, por categoria e por subcategoria | Aceita datas passadas desde 01/01/2025 |

Regras do arquivador:

- **Resposta bruta.** Nada é filtrado nem renomeado. O parser vem depois e pode ser refeito a partir do arquivo.
- **Data da fonte no nome do arquivo**, nunca a do relógio. A exceção é `endpoints`, que não informa data e usa o dia UTC da coleta.
- **Nunca sobrescreve.** Mesmo conteúdo na mesma data não gera arquivo. Se a fonte revisar um dia já gravado, a revisão vira `AAAA-MM-DD.r2.json.gz` e o original fica intacto.
- **Campos voláteis fora da comparação.** Em `endpoints`, status, uptime, latência e throughput de provedor mudam a cada minuto; em `apps`, o `meta.as_of` é o horário da consulta. Eles ficam no arquivo, mas não contam como revisão.
- **Falha alto.** Resposta vazia é falha. Uma fonte que falha não impede as outras de gravar, e o workflow abre uma issue com label `pipeline`.
- **gzip.** O JSON indentado dava cerca de 650 KB por dia só em `endpoints`; comprimido fica em torno de 30 KB. Para ler: `gzip -dc data/tasks/2026-09-10.json.gz | jq .`

O workflow é `.github/workflows/snapshots.yml`, separado do diário de propósito: se ele quebrar, a página segue atualizando. Divide o grupo de concorrência com o diário, então os dois nunca empurram ao mesmo tempo.

```bash
python pipeline/snapshots.py                          # todas as fontes, exige a chave
python pipeline/snapshots.py --only tasks,sessions
python pipeline/snapshots.py --only endpoints --out /tmp/teste   # sem chave
python pipeline/snapshots.py --only apps --apps-day 2026-08-01   # recuperar um dia de apps
python pipeline/test_snapshots.py                     # checagens offline, sem rede
```

Pelo Actions: *Run workflow* no "Arquivar fontes sem histórico", com `only` e `apps_day` opcionais.

## Limites da API

- Janela máxima de 366 dias por chamada. O `fetch.py` fatia em blocos de 364.
- 30 requisições por minuto por chave, 500 por dia por conta. O ciclo diário usa uma, o arquivador cerca de 27. `endpoints` é público e não conta.
- O dataset começa em 2025-01-01.
- `period=week` só existe com filtro de categoria, por isso a agregação semanal é feita localmente a partir do diário.

## Datas expostas no `data.json`

Três campos diferentes, de propósito. Misturá-los faz a página anunciar cobertura menor do que a que o repositório publica.

| Campo | Significado |
|---|---|
| `daily_first` / `daily_last` | Extremos do CSV **bruto**, antes de qualquer filtro. É o que o cabeçalho da página reporta |
| `last_week` | Última semana **completa**, base dos gráficos e dos tiles |
| `as_of` | Data da execução do build. É o valor que vai na atribuição exigida pela licença |

## Classificações

`origin` (país-sede) e `weights` (Open-weights, Proprietário, Não identificado) são atribuídos em `pipeline/build.py`, por vendor e por padrão de nome. Ajustar os conjuntos `CN`, `US`, `EU`, `OPEN_V` e a função `openw()` quando surgirem laboratórios ou modelos novos. Modelos `stealth/*` e `openrouter/*-alpha` são testes anônimos.

Correção de classificação é a contribuição mais útil ao projeto. Abra uma issue com o slug do modelo e a fonte da informação.

## Card social

`pipeline/make_og.py` gera `public/og.png`, 1200×630, a partir do `public/data.json`. Roda no fim do ciclo diário, então o card que aparece no LinkedIn, no WhatsApp e no X carrega os números do dia, não um print congelado.

Usa Pillow, não headless browser, para rodar em CI em segundos sem baixar navegador. Depende de DejaVu Sans, presente por padrão nos runners `ubuntu-latest`; o script tenta três caminhos de sistema e avisa no stderr se cair na fonte padrão do Pillow.

```bash
python pipeline/build.py && python pipeline/make_og.py
```

As tags `og:image` e `twitter:image` em `public/index.html` apontam para `https://modelseason.com/og.png` com URL fixa, sem query de versão. Redes sociais fazem cache agressivo desse arquivo. Depois de uma mudança de layout do card, force a revalidação no [Post Inspector do LinkedIn](https://www.linkedin.com/post-inspector/) e no [Sharing Debugger do Facebook](https://developers.facebook.com/tools/debug/).

## Enriquecimento

`pipeline/enrich.py` casa `model_permaslug` com `canonical_slug` e deriva preço, gasto, faixas, modalidade e qualidade. Três decisões de modelagem que mudam a leitura de qualquer número:

**Sufixos.** `deepseek/v4:free` não é outro modelo, é o mesmo servido por endpoint gratuito. O join usa o slug base e o sufixo vira coluna. A diferença entre tráfego pago e tráfego subsidiado do mesmo modelo é uma das leituras mais úteis do dataset, e antes disso os dois estavam contados como entidades separadas.

**Gasto é estimativa, não medição.** `total_tokens` soma prompt e completion sem separar, e os preços são diferentes. Por isso o pipeline publica três números: piso (tudo prompt), teto (tudo completion) e a estimativa com a mistura declarada em `BLEND_PROMPT`, hoje 75% prompt e 25% completion. Endpoint gratuito custa zero para quem chama, sempre. Qualquer gráfico de dinheiro precisa mostrar a banda, não só a linha.

**Pesos abertos: prova antes de heurística.** Onde `hugging_face_id` existe, ele decide. Onde não existe, cai na heurística por padrão de nome, e a coluna `origem_peso` registra qual das duas respondeu.

## Chaves novas no `data.json`

| Chave | O que é |
|---|---|
| `spend_share`, `spend_total_musd`, `spend_band` | Gasto estimado por laboratório e no total, com piso e teto |
| `volume_vs_dinheiro` | Share de tokens contra share de gasto, por laboratório, e a razão entre os dois |
| `preco_efetivo` | USD por 1M de tokens efetivamente consumidos, semana a semana |
| `cobranca_share` | Pago, endpoint gratuito, modelo gratuito |
| `pesos_share_v2` | Pesos abertos por prova, não por heurística |
| `faixa_preco_share`, `faixa_ctx_share` | Distribuição do volume por faixa de preço e de contexto |
| `multimodal_share`, `raciocinio_share` | Adoção por modalidade e por suporte a raciocínio |
| `ctx_mediano` | Contexto mediano ponderado por volume |
| `qualidade` | Últimos 60 modelos por share, com Intelligence Index, Elo, preço, contexto e lançamento |
| `cobertura`, `cobertura_ultima_semana` | Quanto do volume tem metadado. Número honesto que a página precisa mostrar |
| `blend` | A mistura presumida entre prompt e completion |

## Testes

A página é ferramenta de mercado: número errado publicado em silêncio custa mais caro do que build que falha. Por isso a confiabilidade é verificada, não prometida.

```bash
python pipeline/selftest.py                       # invariantes do data.json
npm i -D playwright && npx playwright install chromium
python -m http.server 8000 --directory public &
node tests/e2e.js http://localhost:8000           # 24 verificações no navegador
```

**`pipeline/selftest.py`** roda no pipeline diário, antes do commit. Verifica que a matriz reconcilia com o CSV bruto, que todo conjunto de shares soma 100% em toda semana, que não há NaN nem infinito, que as chaves que a página consome existem com o tamanho certo, e que o leaderboard é consistente com a matriz.

**`tests/e2e.js`** roda no CI a cada push. Carrega a página em navegador real e compara o que ela calcula no cliente com o que o pipeline calculou em Python. Também exercita filtros, verifica que as partes somam o todo, que o estado vai e volta pela URL, que não há transbordo horizontal em 390, 768 e 1440px, e que o tema escuro desenha.

**`.github/workflows/tests.yml`** ainda checa que o `public/data.json` commitado é exatamente o que `build.py` gera a partir dos CSVs versionados. Isso impede que alguém edite o JSON à mão e a página passe a mostrar número que o pipeline não produz.

Três bugs reais foram encontrados por esses testes antes de qualquer deploy: a linha `other` entrando no leaderboard como se fosse modelo, o `top5` mudando de semântica no cliente, e a fatia "Outros" contada duas vezes no gráfico por laboratório.

## Motor de filtros

A página não consome mais séries pré-agregadas: ela recalcula tudo a partir de `matriz`, uma tabela modelo × semana esparsa com tokens em milhões inteiros. São ~17 KB comprimidos para 403 modelos e 85 semanas.

Sem isso, filtro é impossível: para responder "só modelos pagos acima de 128k de contexto" o navegador precisa dos números por modelo, não do total.

`window.MS` expõe o estado para auditoria: `MS.D` são as séries do recorte atual, `MS.MX` a matriz, `MS.FILTROS` o recorte, `MS.agregar(fn, peso)` a função de agregação. Os testes usam esse mesmo ponto de entrada.

**Duas decisões que mudam a leitura dos números sob filtro:**

A linha `other` da fonte agrega o volume fora do top 50 diário e não tem metadado. Ela conta no total geral, mas sai de qualquer recorte filtrado, porque não dá para saber a composição dela. A página avisa isso explicitamente em vez de fingir que o total continua completo.

O `top5` exclui `other` do ranking mas mantém no denominador: a pergunta é "quanto do mercado os cinco maiores modelos capturam", não "quanto dos modelos nomeados". O HHI, que depende de participações bem definidas, normaliza apenas sobre os nomeados.

## Estimativa de gasto

`tokens × preço de tabela`. Três decisões que o leitor precisa conhecer, todas explícitas na página:

- A fonte soma prompt e completion sem separar, e completion custa várias vezes mais. Por isso o gráfico mostra uma **faixa**: piso (tudo prompt), teto (tudo completion) e a linha na mistura de `BLEND_PROMPT`, hoje 75% prompt. Gráfico de dinheiro sem a faixa seria precisão falsa.
- **Endpoint gratuito custa zero**, sempre, mesmo quando o modelo base é pago.
- É preço de tabela: não considera desconto por volume, cache, batch nem contrato. Serve para comparar posicionamento entre laboratórios, não para estimar receita.

A razão dinheiro/volume de cada laboratório aproxima o posicionamento de preço dentro do mix real de uso. Um laboratório com razão 7× tem tráfego pequeno e caro; com razão 0,1×, tráfego grande e barato.

## Índices de qualidade

`aa_intelligence`, `aa_coding` e `aa_agentic` vêm da **Artificial Analysis** e chegam pela API do OpenRouter. `da_elo_models` é a mediana de Elo nas categorias da arena `models` do Design Arena.

A cobertura é parcial, em torno de um terço dos modelos com volume, e a página informa a razão exata em cada carga. Modelo sem índice não aparece no gráfico de qualidade, e isso está escrito no subtítulo em vez de escondido.
