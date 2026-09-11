---
titulo: "Modalidade e raciocínio declarados"
oQueE: >-
  Dois atributos do modelo, tirados do catálogo: se ele aceita entrada além de texto (imagem, áudio, arquivo) e se declara suporte a raciocínio.
comoECalculado: >-
  Modalidade vem do campo de arquitetura do catálogo: entrada com mais de um tipo conta como multimodal, só texto conta como só texto. Raciocínio é verdadeiro quando o catálogo expõe o parâmetro de raciocínio para o modelo. Modelo sem registro no catálogo vira "Não identificado", nunca "não".
oQueNaoConclui: >-
  Descreve o modelo, não a requisição: tráfego num modelo multimodal pode ser só texto, e o catálogo não diz se o raciocínio é obrigatório ou opcional, nem quantos tokens de raciocínio foram gerados.
---
