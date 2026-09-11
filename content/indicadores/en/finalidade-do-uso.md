---
titulo: "Use case"
oQueE: >-
  A breakdown of the volume the source can classify by use case: four top-level categories (coding, agents, data and general use) and the tasks within them, measured in tokens and in requests.
comoECalculado: >-
  The source classifies a sample of traffic over a rolling multi-day window and publishes, for each task, its share of tokens, its share of requests and the models with the most tokens in it. The <span class='mono'>other</span> bucket is left out of the denominator. The site archives one snapshot a day, because the source keeps no history. The tokens ÷ requests ratio divides the two shares: above 1, each request for that task carries more tokens than the average across classified traffic.
oQueNaoConclui: >-
  It is a sample, built on the source's own taxonomy and classifier, with no published uncertainty. Rolling windows overlap, so the difference between two consecutive snapshots is almost entirely noise. Share within a task shows which model is used most for it, not which one handles it best.
---
