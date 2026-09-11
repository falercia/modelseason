---
id: tarefas
titulo: "What the traffic is used for"
subtitulo: "Share of classified volume by use case, over the source's rolling window"
tipo: barras
modos:
  - "Tokens"
  - "Requests"
indicadores:
  - "Use case"
  - "Token share"
comoLer: >-
  The top bar splits classified volume across the four macro categories; clicking one filters the list. Below, the largest tasks as horizontal bars, in the color of their macro category. The toggle switches between token share and request share, and the tok÷req column divides one by the other: above 1, the task uses more tokens per call than average. Clicking a task shows its leading models in the adjacent card.
perguntaQueResponde: >-
  What is language-model traffic being used for, and which use cases are heavy workloads (few calls, many tokens) and which are light ones (many short calls)?
oQueNaoMostra: >-
  It is not a time series yet: it is the latest snapshot of a rolling window, and it does not respond to the History window or filters. It is a sample classified by the source, excluding the "other" bucket, and it does not show traffic the classifier cannot attribute.
---
