---
id: custo-tarefa
titulo: "Accuracy vs. cost per task"
subtitulo: "OpenRouter evaluations, with the efficiency frontier"
tipo: dispersao
modos:
  - "τ-bench, airline"
  - "GPQA Diamond"
indicadores:
  - "Cost per evaluated task"
comoLer: >-
  One dot per model on the benchmark chosen in the selector: accuracy on the vertical axis and average cost per task on the horizontal, on a log scale. The stepped line traces the efficiency frontier, the models for which no other is both cheaper and more accurate. The table below lists those models.
perguntaQueResponde: >-
  How much does each extra point of accuracy cost, and which models charge a premium without delivering more? Off the frontier, there is always an option that costs less and scores at least as well.
oQueNaoMostra: >-
  It is a snapshot from the evaluation date and does not respond to the window or filters. It is not a value-for-money index: accuracy and cost stay on separate axes, with no ratio between them. Some models were evaluated on only a few dozen tasks, and their accuracy swings considerably.
---
