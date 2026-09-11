---
id: carga-contexto
titulo: "Context window"
subtitulo: "% of volume by the model's maximum context window"
tipo: area
modos: []
indicadores:
  - "Price tier and context window"
  - "Token share"
comoLer: >-
  Stacked area that sums to 100% in each period. Each band is the volume served by models whose maximum context window falls in that range, from smallest at the bottom to largest. The gray band at the top is volume in models with no catalog record, and its size tells you how much of the chart is described.
perguntaQueResponde: >-
  Is traffic moving toward models that can handle long context? It is the most direct signal of a shift in workload: agents and coding tools read entire repositories and histories.
oQueNaoMostra: >-
  It measures the model's maximum window, not prompt size. Traffic on a long-window model may consist of short messages. Early in the series the gray band is large, because models discontinued before the first catalog collection lost their metadata.
---
