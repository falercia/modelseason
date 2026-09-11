# Pipeline e operação

Documentação técnica do Model Season. O [README](../README.md) trata do produto.

## Arquitetura

```
rankings-daily ──▶ fetch.py ───────▶ data/rankings_daily.csv ─┐
                                                              ├─▶ enrich.py ─▶ build.py ─▶ public/data.json
/api/v1/models ──▶ fetch_models.py ▶ data/models_catalog.csv ─┘                    │
                                                                          make_og.py ─▶ public/og.png
rankings_daily.csv + catálogo + snapshots ──▶ build_web.py ──▶ data/web/{agora,mercado,modelos}.json
GitHub Actions (06:30 UTC) commita ──▶ Vercel redeploya ──▶ Next.js lê public/data.json e data/web/

classifications/task ─┐
session-cost ─────────┤
benchmarks ───────────┼─▶ snapshots.py ─▶ data/{tasks,sessions,benchmarks,endpoints,apps}/AAAA-MM-DD.json.gz
models/{id}/endpoints ┤                   (GitHub Actions, 07:15 UTC, workflow próprio)
app-rankings ─────────┤
providers, zdr ───────┤                   data/{providers,zdr}/  (públicas, sem chave)
embeddings/images/videos models ┤         data/catalogs/{embeddings,images,videos}/
models (todas as modalidades) ──┘         data/catalogs/models/  (histórico de preço)
```

`fetch.py` traz volume. `fetch_models.py` traz o que cada modelo é: preço, contexto, lançamento, modalidade, pesos e índices de qualidade. `enrich.py` casa os dois e deriva as dimensões que os gráficos usam.

`build_web.py` gera o que a v2 lê além do `data.json`: o bloco Agora com dado **diário** (a v1 só via semanas fechadas), os líderes por critério, as fontes sem histórico já resumidas (tarefas, apps, sessões, avaliações, provedores) e uma ficha por modelo para as páginas `/m/<slug>`. Ele roda no diário e no workflow de snapshots, e o CI confere que o `data/web` commitado é exatamente o que ele gera.

Toda a agregação de dados vive em Python. O recorte por janela, agrupamento e filtro acontece no navegador, em `lib/engine.ts`, a partir da matriz modelo × semana do `data.json` (porte do motor da v1, testado contra o pipeline). Nenhum número é escrito à mão na página nem nos textos de `content/`.

## Front (v2)

Next.js 16 (App Router), React 19 e TypeScript, hospedado na Vercel. D3 só calcula escala e geometria; React desenha o SVG.

| Pasta | O que tem |
|---|---|
| `app/` | Rotas: `/` (estática), `/m/[...slug]` (página de modelo, 30 pré-geradas e o resto sob demanda, em cache até o próximo deploy), `sitemap.xml`, `robots.txt` |
| `components/agora/` | Bloco Agora, líderes e o que mudou, renderizados no servidor |
| `components/secoes/` | As 15 seções do Histórico, uma por arquivo (`S01.tsx` a `S15.tsx`) |
| `components/modelo/` | A página de modelo |
| `components/shell/` | Topo com busca, índice lateral, filtros, painel do "?" |
| `components/graficos/base.tsx` | Primitivos: série temporal (linhas, área, empilhada, banda), barras, legenda, tabela |
| `lib/engine.ts` | O motor de recorte (janela, agrupamento, filtros, famílias de modelo) |
| `content/` | Um arquivo por gráfico e por indicador. `scripts/conteudo.mjs` valida e compila antes de todo build |

Sem banco. Cada commit do pipeline gera um deploy, e o deploy é o cache. O Postgres entra quando houver dado que justifique, sem mudar as páginas: só a camada `lib/data.ts`.


## Rodar local

```bash
pip install -r pipeline/requirements.txt
export OPENROUTER_API_KEY=sk-or-v1-...
python pipeline/fetch.py          # volume, incremental
python pipeline/fetch_models.py   # catálogo de modelos, não exige chave
python pipeline/build.py          # gera public/data.json
python pipeline/make_og.py        # gera o card social
python pipeline/build_web.py      # gera data/web/*.json
npm ci && npm run dev             # http://localhost:3000
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

### Google Analytics

A página carrega o GA4 só quando existe `NEXT_PUBLIC_GA_ID` (formato `G-XXXXXXX`) nas variáveis de ambiente da Vercel. Sem a variável, nada é carregado, e é assim no CI e em desenvolvimento. O componente é `components/shell/Analytics.tsx`.

- Configurar só no ambiente **Production** da Vercel, para preview não mandar visita para a propriedade. Como é `NEXT_PUBLIC_`, o valor entra no build: depois de criar ou trocar, é preciso redeployar.
- Consent Mode com publicidade negada por padrão (`ad_storage`, `ad_user_data`, `ad_personalization`). A página não tem anúncio.
- Com o GA ativo, o rodapé avisa que a página usa Google Analytics.
- A troca de recorte (janela, agrupamento, filtro) muda a URL. As medições aprimoradas do GA4 podem contar isso como visualização de página; se poluir o relatório, desligar "alterações de página com base em eventos do histórico do navegador" na propriedade.

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
| `providers` | `/providers` | Os provedores de inferência, com país sede e páginas de privacidade e termos. Permite separar onde a inferência roda de quem fez o modelo | Nenhum, e não exige chave |
| `zdr` | `/endpoints/zdr` | Todos os endpoints, de todos os modelos, que aceitam retenção zero de dados | Nenhum, e não exige chave |
| `embeddings`, `images`, `videos` | `/embeddings/models`, `/images/models`, `/videos/models` | Catálogos de três mercados vizinhos ao de texto, com preço e data de lançamento. Como no `/models`, modelo que sai do ar some do catálogo | Nenhum, e não exigem chave |
| `models` | `/models?output_modalities=all` | O catálogo inteiro, de todas as modalidades, com preço, contexto, parâmetros, avaliações e data de expiração. O `fetch_models.py` guarda só o preço de hoje, sobrescrito; esta foto é o que permite reconstruir o preço de cada dia e calcular o gasto histórico com o preço da época. Arquivado desde 12/09/2026; antes disso, o preço só existe nas versões do `models_catalog.csv` no git, a partir de 09/09 | Nenhum, e não exige chave |

Regras do arquivador:

- **Resposta bruta.** Nada é filtrado nem renomeado. O parser vem depois e pode ser refeito a partir do arquivo.
- **Data da fonte no nome do arquivo**, nunca a do relógio. A exceção são as fontes públicas (`endpoints`, `providers`, `zdr` e os catálogos), que não informam data e usam o dia UTC da coleta.
- **Nunca sobrescreve.** Mesmo conteúdo na mesma data não gera arquivo. Se a fonte revisar um dia já gravado, a revisão vira `AAAA-MM-DD.r2.json.gz` e o original fica intacto.
- **Campos voláteis fora da comparação.** Em `endpoints` e `zdr`, status, uptime, latência e throughput de provedor mudam a cada minuto. Em `apps`, o `meta.as_of` é o horário da consulta e o `app_name` oscila entre apelidos do mesmo app, com posição e tokens idênticos. Eles ficam no arquivo, mas não contam como revisão. A comparação usa o hash recalculado pela regra atual, então tornar um campo volátil não gera revisão falsa nos arquivos antigos.
- **Falha alto.** Resposta vazia é falha. Uma fonte que falha não impede as outras de gravar, e o workflow abre uma issue com label `pipeline`.
- **gzip.** O JSON indentado dava cerca de 650 KB por dia só em `endpoints`; comprimido fica em torno de 30 KB. Para ler: `gzip -dc data/tasks/2026-09-10.json.gz | jq .`

O workflow é `.github/workflows/snapshots.yml`, separado do diário de propósito: se ele quebrar, a página segue atualizando. Divide o grupo de concorrência com o diário, então os dois nunca empurram ao mesmo tempo.

```bash
python pipeline/snapshots.py                          # todas as fontes, exige a chave
python pipeline/snapshots.py --only tasks,sessions
python pipeline/snapshots.py --only endpoints,providers,zdr,embeddings,images,videos,models --out /tmp/teste   # sem chave
python pipeline/snapshots.py --only apps --apps-day 2026-08-01   # recuperar um dia de apps
python pipeline/test_snapshots.py                     # checagens offline, sem rede
```

Pelo Actions: *Run workflow* no "Arquivar fontes sem histórico", com `only` e `apps_day` opcionais.

## Limites da API

- Janela máxima de 366 dias por chamada. O `fetch.py` fatia em blocos de 364.
- 30 requisições por minuto por chave, 500 por dia por conta. O ciclo diário usa uma, o arquivador cerca de 27. As fontes públicas (`endpoints`, `providers`, `zdr` e catálogos) não contam.
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

A página é ferramenta de mercado: número errado publicado em silêncio custa mais caro do que build que falha.

```bash
python pipeline/selftest.py              # invariantes do data.json
python pipeline/test_snapshots.py        # arquivador, offline
npm run test:engine                      # motor da página contra o pipeline
npm run typecheck                        # conteúdo de content/ e tipos
npm run build && npx next start -p 3099 &
node tests/e2e.mjs http://localhost:3099 # a página rodando, em navegador real
```

**`tests/engine.test.ts`** compara o motor do navegador com o `data.json` do Python: volume, top 5, HHI, origem, licença, share da Anthropic, gasto, famílias, janelas, agrupamento mensal e filtro. Também falha quando as quatro cores de laboratório deixarem de ser as dos quatro maiores em volume acumulado.

**`tests/e2e.mjs`** carrega a página: o líder e a manchete do Agora batem com `agora.json`, todo cartão tem "?" com texto cadastrado e próprio, o painel abre com o título do gráfico, as três abas de família estão no HTML, janela e agrupamento vão para a URL, filtro por URL funciona, nada vira NaN, nada rola de lado em 400px nos dois temas, todo link de modelo abre, slug inexistente dá 404, e o sitemap lista as páginas de modelo.

**`.github/workflows/tests.yml`** roda tudo isso em todo push para `main` e `dev` e em todo PR, e ainda confere que `public/data.json` e `data/web/` commitados são exatamente o que o pipeline gera.

## Motor de filtros

A página não consome mais séries pré-agregadas: ela recalcula tudo a partir de `matriz`, uma tabela modelo × semana esparsa com tokens em milhões inteiros. São ~17 KB comprimidos para 403 modelos e 85 semanas.

Sem isso, filtro é impossível: para responder "só modelos pagos acima de 128k de contexto" o navegador precisa dos números por modelo, não do total.

Na v2 o motor é `lib/engine.ts`, uma função pura `recortar(D, séries, estado, pesos)`. As seções só leem o recorte; nenhuma recorta nada por conta própria.

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
