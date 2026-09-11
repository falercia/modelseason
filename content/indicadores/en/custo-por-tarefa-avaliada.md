---
titulo: "Cost per evaluated task"
oQueE: >-
  What fraction of a standardized evaluation's tasks the model got right, and what each task cost on average, in dollars.
comoECalculado: >-
  It comes straight from the evaluations the source runs through its own router, at the price it charges: GPQA Diamond (graduate-level science questions) and τ-bench Verified in the airline scenario (the model serves a customer using tools). The efficiency frontier is calculated here: sorted by cost, a model makes the frontier if it beats the accuracy of every cheaper model.
oQueNaoConclui: >-
  It is a snapshot taken on the evaluation date, with no confidence interval, on a fixed set of tasks. Cost depends on how many reasoning tokens the model spends and which provider served it, and scoring higher on a public test does not guarantee better results on your workload.
---
