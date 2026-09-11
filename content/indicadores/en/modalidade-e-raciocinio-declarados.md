---
titulo: "Declared modality and reasoning"
oQueE: >-
  Two model attributes taken from the catalog: whether it accepts input beyond text (image, audio, file) and whether it declares reasoning support.
comoECalculado: >-
  Modality comes from the catalog's architecture field: input with more than one type counts as multimodal, text alone counts as text only. Reasoning is true when the catalog exposes the reasoning parameter for the model. A model with no catalog entry becomes "Unknown", never "no".
oQueNaoConclui: >-
  It describes the model, not the request: traffic on a multimodal model may be text only, and the catalog does not say whether reasoning is mandatory or optional, or how many reasoning tokens were generated.
---
