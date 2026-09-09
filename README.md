# Model Season

### [modelseason.com](https://modelseason.com)

Para onde vai o tráfego de tokens dos modelos de linguagem, semana a semana. Quem cresce, quem perde, quanto tempo um modelo dura no topo.

Atualizado todo dia.

---

## A tese

Modelos têm temporadas.

Nenhum modelo sustenta liderança por mais de dois trimestres neste dataset. A cadência de lançamento acelerou a ponto de cada geração ser canibalizada pela seguinte antes de amadurecer, e a janela útil de uma versão encolheu para cerca de um trimestre.

A consequência prática, para quem decide qual modelo colocar em produção: o ativo durável não é a escolha do modelo, é o método de avaliar e trocar. Quem investe em prompt acoplado a um modelo específico está construindo sobre algo com meia-vida medida em semanas. Quem investe em suíte de avaliação, em camada de abstração e em processo de troca, capitaliza cada temporada nova.

Esta página existe para sustentar esse argumento com série histórica, não com opinião de thread.

## O que a página mostra

**Tamanho e concentração.** Volume semanal em trilhões de tokens, share dos cinco maiores modelos, índice HHI.

**Leaderboard semanal.** Os quinze modelos mais usados, com share, volume, país-sede do laboratório, licença dos pesos e a posição que ocupavam quatro semanas antes. É onde se enxerga quem entrou e quem sumiu.

**Origem e licença.** Share por país-sede do laboratório e por modelo de licenciamento dos pesos. Mais o tráfego em endpoints gratuitos, que muda a leitura de qualquer número de crescimento.

**Posição da Anthropic.** Share ao longo do tempo contra os oito maiores concorrentes, volume por família e permanência de cada modelo Claude no top 10.

**Ciclo de vida.** Rotatividade do top 10, idade mediana dos modelos em uso, tempo até o pico e meia-vida depois dele, por trimestre de lançamento. É a seção que sustenta a tese.

**Para onde vai o dinheiro.** Gasto semanal estimado a preço de tabela, com a faixa de incerteza, e share de tokens contra share do gasto por laboratório. É a divergência mais importante do dataset e quase nenhuma análise pública mostra.

**Qualidade contra adoção.** Índice de inteligência no eixo horizontal, share de tokens no vertical. Os quadrantes separam o que é bom e usado do que é bom e ignorado.

**O que mudou esta semana.** Entradas e saídas do top 10, estreias no ranking e as maiores variações de share em quatro semanas. É o que justifica a página ser diária.

**Comparador.** Dois modelos lado a lado: adoção, preço, contexto, índice de inteligência, origem, pesos e a curva de share dos dois.

Cada seção tem um painel de leitura ao lado, com a interpretação e os caveats. Todo gráfico abre em tabela, e a legenda é clicável: dá para ligar e desligar séries para comparar só o que interessa.

**Filtros.** Uma barra no topo recorta o mercado inteiro por cobrança, licença dos pesos, país-sede do laboratório, faixa de preço, janela de contexto, modalidade e suporte a raciocínio. Todos os gráficos respondem ao mesmo recorte, e o filtro vai para a URL: um link já filtrado abre no mesmo estado para quem receber.

Com filtro ativo, os percentuais passam a ser calculados dentro do recorte, e a página diz quanto do volume ficou de fora.

## O que os dados já mostram

Números da semana de 31/08/2026, contra a primeira semana da série, 06/01/2025. A página tem sempre o número atual.

| | Jan 2025 | Ago 2026 |
|---|---|---|
| Volume semanal | 0,5T tokens | **115T** |
| Share dos 5 maiores modelos | 66,1% | **49,8%** |
| HHI | 1447 | **700** |
| Laboratórios chineses | 6,1% | **61,3%** |
| Pesos abertos | 23,2% | **65,7%** |
| Tráfego em endpoints gratuitos | 0,9% | **11,4%** |
| Anthropic | 48,1% | **4,5%** |

Quatro leituras que esses números permitem, e uma armadilha.

**O mercado desconcentrou enquanto crescia.** O HHI caiu de 1447 para 700, ou seja, saiu de "moderadamente concentrado" para "não concentrado" na escala antitruste convencional. Isso aconteceu com o volume total multiplicando por 231. Crescimento e pulverização vieram juntos.

**A virada de origem foi mais rápida do que qualquer narrativa acompanhou.** Laboratórios chineses saíram de 6% para 61% do tráfego em vinte meses. A curva de pesos abertos anda quase colada nessa, porque a maioria dos pesos abertos relevantes hoje é chinesa. São o mesmo fenômeno visto de dois ângulos, não duas tendências independentes.

**O topo é temporário por construção.** A cada quatro semanas, em torno de quatro ou cinco dos dez modelos mais usados são novos na lista. A idade mediana do top 10 gira em torno de seis semanas desde a estreia no ranking.

**Um em cada nove tokens é subsidiado.** O tráfego em endpoints gratuitos saiu de 1% para 11%. Parte relevante do crescimento agregado é demanda que ainda não foi testada contra preço.

**A armadilha.** O share da Anthropic caiu de 48% para 4,5%, mas em tokens absolutos o volume dela multiplicou por cerca de dezoito no mesmo período. O share caiu porque o denominador explodiu, não porque o uso encolheu. Ler share sem ler o absoluto produz a conclusão errada, e este é o exemplo mais limpo disso na série.

## Como ler estes dados

O que está aqui é share de **tokens**, não de receita, e vem de uma fonte com viés conhecido.

O OpenRouter concentra tráfego de desenvolvedores, agentes de código, roleplay e uso sensível a preço. Não representa consumo enterprise direto via API dos laboratórios, nem via Bedrock ou Vertex. Isso não invalida o retrato, delimita ele. Para acompanhar movimento de mercado em alta frequência, é o melhor sinal público disponível. Para dimensionar receita de laboratório, não serve.

Três limites que valem para qualquer número da página:

- A linha `other` agrega o volume fora do top 50 diário. Modelos que oscilam na fronteira do top 50 aparecem subcontados.
- Só semanas completas entram nos gráficos. Os dias 15/06/2025 e 15/07/2025 nunca foram publicados pela fonte, então as duas semanas que os contêm ficam de fora.
- Origem e licença dos pesos são atribuídas por laboratório e por padrão de nome. Casos ambíguos existem e estão listados no rodapé da página. Correção aqui é o tipo de contribuição mais útil: abra uma issue com o slug do modelo e a fonte.

## Os dados

`data/rankings_daily.csv` guarda o histórico bruto diário desde 01/01/2025, uma linha por dia e modelo, versionado a cada atualização. Mais de 31 mil linhas, crescendo todo dia. O dicionário de colunas está em [`data/README.md`](data/README.md).

Use à vontade, inclusive comercialmente. A licença exige apenas atribuição.

## Fonte e licença

Os dados vêm do endpoint público `rankings-daily` do [OpenRouter](https://openrouter.ai/rankings) e estão sob [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Ao republicar ou citar, a atribuição exigida é:

> Source: OpenRouter (openrouter.ai/rankings), as of {data}.

O campo `as_of` acompanha cada versão do dataset e aparece no rodapé da página.

**Model Season não é afiliado ao OpenRouter.** É um projeto independente de [Fabio Garcia](https://github.com/falercia).

O código deste repositório está sob [MIT](LICENSE). A licença dos dados é a do parágrafo acima, e vale mesmo para quem usar só o CSV.

---

Detalhes de pipeline, operação e contribuição: [`docs/pipeline.md`](docs/pipeline.md).
