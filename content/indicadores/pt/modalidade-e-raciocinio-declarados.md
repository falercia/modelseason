---
titulo: "Modalidade e raciocínio declarados"
oQueE: >-
  Dois atributos do modelo, tirados do catálogo: se ele aceita entrada além de texto (imagem, áudio, arquivo) e se declara suporte a raciocínio.
comoECalculado: >-
  Modalidade vem do campo de arquitetura do catálogo: entrada com mais de um tipo conta como multimodal, só texto conta como só texto. Raciocínio é verdadeiro quando o catálogo expõe o bloco de raciocínio para o modelo, seja ele opcional ou obrigatório. Modelo sem registro no catálogo vira "Não identificado", nunca "não".
oQueNaoConclui: >-
  Descreve o modelo, não a requisição: tráfego num modelo multimodal pode ser só texto. O catálogo declara, para parte dos modelos, se o raciocínio é obrigatório, se vem ligado por padrão e quais níveis de esforço aceita, mas este indicador usa só a presença do bloco, então não separa obrigatório de opcional, nem conta quantos tokens de raciocínio foram gerados.
---
