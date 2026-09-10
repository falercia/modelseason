---
id: spend
titulo: "Gasto semanal estimado"
subtitulo: "Milhões de dólares por semana, a preço de tabela. A faixa vai de \"tudo prompt\" a \"tudo completion\"; a linha usa 75% prompt."
tipo: linha
modos: []
indicadores:
  - "Gasto estimado"
comoLer: >-
  Linha do gasto estimado por período com uma faixa em volta. A linha usa uma mistura de 75% prompt e 25% completion, e a faixa vai do cenário tudo prompt ao cenário tudo completion. A tabela abre estimativa, piso, teto e o preço efetivo por milhão de tokens.
perguntaQueResponde: >-
  Quanto dinheiro esse tráfego representa a preço de tabela? Dá ordem de grandeza para conversas que normalmente acontecem sem nenhum número.
oQueNaoMostra: >-
  É estimativa, não medição, e a largura da faixa não é imprecisão do cálculo: a fonte soma prompt e completion sem separar, e completion custa várias vezes mais. Preço de tabela também não é preço pago, porque desconto por volume, cache e contrato não aparecem.
---
