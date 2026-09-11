---
id: spend
titulo: "Estimated weekly spend"
subtitulo: "Millions of dollars per week, at list price. The band runs from \"all prompt\" to \"all completion\"; the line uses the declared mix."
tipo: linha
modos: []
indicadores:
  - "Estimated spend"
comoLer: >-
  Estimated spend per period as a line with a band around it. The line uses the prompt/completion mix declared in the pipeline, and the band runs from the all-prompt scenario to the all-completion scenario. The table breaks out the estimate, floor, ceiling and effective price per million tokens.
perguntaQueResponde: >-
  How much money does this traffic represent at list price? It puts an order of magnitude on conversations that usually happen without any numbers.
oQueNaoMostra: >-
  This is an estimate, not a measurement, and the width of the band does not reflect calculation error: the source sums prompt and completion without separating them, and completion costs several times more. Nor is list price the price paid, because volume discounts, caching and contracts do not show up. And today's price is applied to the entire past: a model whose price has dropped has its older spend overstated until a price history exists.
---
