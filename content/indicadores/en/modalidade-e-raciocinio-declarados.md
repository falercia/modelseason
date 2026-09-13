---
titulo: "Declared modality and reasoning"
oQueE: >-
  Two model attributes taken from the catalog: whether it accepts input beyond text (image, audio, file) and whether it declares reasoning support.
comoECalculado: >-
  Modality comes from the catalog's architecture field: input with more than one type counts as multimodal, text alone counts as text only. Reasoning is true when the catalog exposes the reasoning block for the model, whether it is optional or mandatory. A model with no catalog entry becomes "Unknown", never "no".
oQueNaoConclui: >-
  It describes the model, not the request: traffic on a multimodal model may be text only. For part of the catalog the model declares whether reasoning is mandatory, whether it is on by default and which effort levels it accepts, but this indicator uses only the presence of the block, so it does not separate mandatory from optional, or count how many reasoning tokens were generated.
---
