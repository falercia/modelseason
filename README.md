# Model Season

**[modelseason.com](https://modelseason.com)** · Para onde vai o tráfego de tokens dos modelos de linguagem, semana a semana.

Modelos têm temporadas. Nenhum sustenta liderança por mais de dois trimestres neste dataset, e a cadência de lançamento só acelera. O que dura não é a afinidade com um modelo, é o método de avaliar e trocar. Esta página existe para mostrar isso com número, não com opinião de thread.

Atualizada todo dia, às 03:30 de Brasília.

## O que a página mostra

**Tamanho e concentração do mercado.** Volume semanal em trilhões de tokens, share dos cinco maiores modelos e índice HHI. O mercado saiu de "moderadamente concentrado" para "não concentrado" na escala antitruste convencional, enquanto o volume total crescia em ordens de grandeza.

**Leaderboard semanal.** Os quinze modelos mais usados da última semana completa, com share, volume absoluto, país-sede do laboratório, licença dos pesos e a posição que ocupavam quatro semanas antes. É onde se vê quem entrou e quem sumiu.

**Open-weights contra proprietário, China contra EUA.** Duas curvas que se movem quase juntas, porque a maioria dos pesos abertos relevantes hoje é chinesa. E o share de tráfego em endpoints gratuitos, que responde por parte não trivial do crescimento e muda a leitura de qualquer número absoluto.

**Posição da Anthropic.** Share ao longo do tempo contra os oito maiores concorrentes, volume por família (Haiku, Sonnet, Opus, Fable) e permanência de cada modelo Claude no top 10. A história em share e a história em tokens absolutos são opostas, e a página mostra as duas.

**Ciclo de vida dos modelos.** Rotatividade do top 10, idade mediana dos modelos em uso, tempo até o pico e meia-vida após o pico, por trimestre de lançamento. É a seção que sustenta a tese.

Cada seção tem um painel de leitura ao lado, com a interpretação e os caveats. Todo gráfico tem um botão que mostra os números em tabela.

## Como ler estes dados

O que está aqui é share de **tokens**, não de receita, e vem de uma fonte com viés conhecido. O OpenRouter concentra tráfego de desenvolvedores, agentes de código, roleplay e uso sensível a preço. Não representa consumo enterprise direto via API dos laboratórios, nem via Bedrock ou Vertex.

Isso não invalida o retrato, delimita ele. Para quem decide qual modelo colocar em produção, é o melhor sinal público disponível sobre movimento de mercado em alta frequência. Para dimensionar receita de laboratório, não serve.

Três outros limites que valem a leitura de qualquer número:

- A linha `other` é o volume fora do top 50 diário. Modelos que oscilam na fronteira do top 50 têm o volume semanal subcontado.
- Apenas semanas completas entram nos gráficos. Os dias `2025-06-15` e `2025-07-15` nunca foram publicados pela fonte, então as duas semanas que os contêm ficam de fora.
- Origem e licença dos pesos são atribuídas por laboratório e por padrão de nome. Casos ambíguos existem e estão listados no rodapé da página.

## Os dados

`data/rankings_daily.csv` tem o histórico bruto diário desde 2025-01-01, uma linha por `(dia, modelo)`, versionado a cada atualização. São mais de 30 mil linhas e cresce todo dia.

Use à vontade. A licença exige atribuição:

> Source: OpenRouter ([openrouter.ai/rankings](https://openrouter.ai/rankings)), as of {data}.

Dados sob [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Model Season não é afiliado ao OpenRouter.

## Rodar local

```bash
pip install -r pipeline/requirements.txt
export OPENROUTER_API_KEY=sk-or-v1-...
python pipeline/fetch.py      # incremental, busca só os dias que faltam
python pipeline/build.py      # gera public/data.json
python -m http.server 8000 --directory public
```

O CSV já vem com o histórico completo, então o primeiro `fetch.py` só busca a diferença. Sem a chave, `build.py` e a página funcionam com o dado que já está no repositório.

## Como funciona

```
API OpenRouter ──▶ pipeline/fetch.py ──▶ data/rankings_daily.csv
                                                │
                                                ▼
                                       pipeline/build.py ──▶ public/data.json
                                                                    │
GitHub Actions (06:30 UTC) commita ──▶ Vercel redeploya ──▶ public/index.html
```

Toda a agregação vive em Python. A página lê um JSON e desenha com D3. Nenhum número é escrito à mão no HTML.

## Operação e alertas

O workflow `.github/workflows/daily.yml`:

- aborta com mensagem clara se o secret `OPENROUTER_API_KEY` não existir;
- tenta o `fetch.py` até 3 vezes, com 60s entre tentativas, para absorver 429 e instabilidade;
- roda o guard de integridade descrito abaixo;
- em caso de falha, abre uma issue com label `pipeline`, link do run e checklist de diagnóstico. Se falhar de novo, comenta na issue existente em vez de abrir outra;
- quando volta a funcionar, comenta e fecha a issue.

### Guard de integridade

`pipeline/check_freshness.py` roda depois do fetch, com três verificações em ordem de gravidade.

| Verificação | Comportamento | Por que existe |
|---|---|---|
| **Duplicatas** por `(date, model_permaslug)` | Falha sempre | A falha mais cara e a mais silenciosa. Se o dedupe quebrar, a agregação semanal soma o mesmo volume duas vezes e todo número da página fica errado sem nada parecer anormal |
| **Frescor** | Avisa a partir de 2 dias de atraso, falha a partir de 10 | A fonte atrasa publicação com alguma frequência. O aviso aparece no run e não abre issue |
| **Buracos** no histórico | Informativo | Os dois dias ausentes conhecidos estão catalogados. Um dia novo fora da lista vira aviso |

A separação entre aviso e falha é deliberada. Alerta que dispara por atraso da fonte, e não por defeito do pipeline, treina qualquer um a ignorar alerta.

```bash
python pipeline/check_freshness.py                                  # avisa em 2d, falha em 10d
python pipeline/check_freshness.py --max-lag-days 5 --warn-lag-days 1
```

O `workflow_dispatch` aceita `max_lag_days` e `warn_lag_days`, então dá para testar outro limite sem editar arquivo.

Para o e-mail nativo do Actions: Settings → Notifications → Actions → "Send notifications for failed workflows only".

## Limites da API

- Janela máxima de 366 dias por chamada. O `fetch.py` fatia em blocos de 364.
- 30 requisições por minuto por chave, 500 por dia por conta. O ciclo diário usa uma.
- O dataset começa em 2025-01-01.
- `period=week` só existe com filtro de categoria, por isso a agregação semanal é feita localmente a partir do diário.

## Classificações

`origin` (país-sede) e `weights` (Open-weights, Proprietário, Não identificado) são atribuídos em `pipeline/build.py`, por vendor e por padrão de nome. Ajustar os conjuntos `CN`, `US`, `EU`, `OPEN_V` e a função `openw()` quando surgirem laboratórios ou modelos novos. Modelos `stealth/*` e `openrouter/*-alpha` são testes anônimos.

Correção de classificação é o tipo de contribuição mais útil aqui. Abra uma issue com o slug do modelo e a fonte.

## Licença

Código sob [MIT](LICENSE). Dados sob [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), com atribuição ao OpenRouter conforme a seção "Os dados".
