# Pipeline e operação

Documentação técnica do Model Season. O [README](../README.md) trata do produto.

## Arquitetura

```
API OpenRouter ──▶ pipeline/fetch.py ──▶ data/rankings_daily.csv
                                                │
                                                ▼
                                       pipeline/build.py ──▶ public/data.json
                                                                    │
GitHub Actions (06:30 UTC) commita ──▶ Vercel redeploya ──▶ public/index.html
```

Toda a agregação vive em Python. A página lê um JSON e desenha com D3. Nenhum número é escrito à mão no HTML.

## Rodar local

```bash
pip install -r pipeline/requirements.txt
export OPENROUTER_API_KEY=sk-or-v1-...
python pipeline/fetch.py      # incremental, busca só os dias que faltam
python pipeline/build.py      # gera public/data.json
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

## Limites da API

- Janela máxima de 366 dias por chamada. O `fetch.py` fatia em blocos de 364.
- 30 requisições por minuto por chave, 500 por dia por conta. O ciclo diário usa uma.
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
