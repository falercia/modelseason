---
id: carga-contexto
titulo: "Janela de contexto"
subtitulo: "% do volume por janela de contexto máxima do modelo"
tipo: area
modos: []
indicadores:
  - "Faixa de preço e janela de contexto"
  - "Share de tokens"
comoLer: >-
  Área empilhada que soma 100% em cada período. Cada faixa é o volume servido por modelos com janela de contexto máxima naquele intervalo, da menor, embaixo, para a maior. A faixa cinza do topo é o volume em modelos sem registro no catálogo, e o tamanho dela diz quanto do gráfico está descrito.
perguntaQueResponde: >-
  O tráfego está indo para modelos que aguentam contexto longo? É o sinal mais direto de mudança de carga: agentes e código leem repositórios e históricos inteiros.
oQueNaoMostra: >-
  Mede a janela máxima do modelo, não o tamanho dos prompts. Tráfego num modelo de janela longa pode ser de mensagens curtas. No começo da série a faixa cinza é grande, porque modelo descontinuado antes da primeira coleta do catálogo perdeu o metadado.
---
