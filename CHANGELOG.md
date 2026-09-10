# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/). Versionamento semântico.

O projeto foi construído em uma única sessão, então todas as versões abaixo carregam a mesma data. A separação em versões é lógica, não cronológica: cada uma marca um estado em que o site estava publicado e funcionando.

## [Não lançado]

Planejado para a v2, detalhado em [`docs/v2.md`](docs/v2.md).

### Adicionado

- **Arquivo diário das fontes sem histórico.** `pipeline/snapshots.py` grava a resposta bruta de `/classifications/task`, `/datasets/session-cost`, `/benchmarks`, `/models/{id}/endpoints` dos 50 maiores modelos e `/datasets/app-rankings` por categoria e subcategoria, em `data/*/AAAA-MM-DD.json.gz`. Quatro dessas fontes apagam o passado a cada atualização, então cada dia sem coleta era perdido para sempre. O arquivo leva a data da fonte no nome, nunca sobrescreve (revisão vira `.r2`) e deixa fora da comparação os campos de saúde de provedor, que mudam a cada minuto.
- Workflow próprio, `snapshots.yml`, às 07:15 UTC, separado do diário para que uma falha na coleta nova não afete a página. Abre issue com label `pipeline` quando alguma fonte falha e commita o que deu certo.
- **Cinco fontes públicas no arquivo diário**, sem consumir a cota da chave: `/providers` (país sede de cada provedor), `/endpoints/zdr` (endpoints com retenção zero de dados, de todos os modelos) e os catálogos de embeddings, imagem e vídeo, em `data/providers/`, `data/zdr/` e `data/catalogs/`.
- `pipeline/test_snapshots.py`, com 34 checagens offline: nome pela data da fonte, paginação, orçamento de chamadas, chave fora dos arquivos, revisão sem sobrescrita, resposta vazia tratada como falha e tolerância a 429. Roda no workflow de testes.

### Corrigido

- **Revisão falsa em `apps`.** A primeira execução no Actions gravou um `.r2` em que só o `app_name` de 7 apps mudava, alternando entre apelidos do mesmo app, com posição, id e tokens idênticos. O nome saiu da comparação, e a comparação passou a usar o hash recalculado pela regra atual. O `.r2` já gravado continua no repositório, porque arquivo bruto não se apaga. O `.r2` de `sessions` do mesmo dia é revisão legítima: a fonte entregou dois cálculos da mesma janela.

---

## [1.4.0] — 2026-09-09

### Adicionado

- **Explicação própria para cada um dos 23 gráficos.** A correção anterior fez o painel abrir com o título certo, mas o conteúdo continuava sendo a definição genérica do indicador: clicar em "Share da Anthropic vs. concorrentes" e ler o verbete de "share de tokens" não explica aquele gráfico. Cada um passou a ter três blocos escritos para ele, **como ler** (o que é cada eixo, cada marca, cada modo), **a pergunta que responde** (a decisão que o gráfico apoia) e **o que não mostra** (o limite honesto, na cor de alerta). A definição formal do indicador continua abaixo, para quem quiser conferir a conta.
- O comparador ganhou o "?", que antes não tinha.
- Duas travas no `tests/e2e.js`: uma exige que todo "?" traga título, texto próprio de pelo menos 200 caracteres e o indicador correspondente; outra falha se dois gráficos exibirem a mesma explicação, que é como um mapa com entrada repetida volta a mostrar o texto errado com o título certo.

---

## [1.3.1] — 2026-09-09

### Corrigido

- **O "?" abria um verbete com outro nome.** O mapa de gráfico para indicador era um para um contra um glossário de 17 verbetes, então 19 dos 22 gráficos abriam um painel com título diferente do que foi clicado: "Tração contra capacidade" abria "Share de tokens". Agora o painel abre com o título **do gráfico** e mostra o conjunto de indicadores que aquele gráfico usa, com um caminho de volta para a lista completa. Verbete continua morando num lugar só: três gráficos falam de rotatividade do top 10 e o texto não é duplicado.
- **Painel sem formatação.** Os rótulos "o que é", "como é calculado" e "o que não conclui" ficavam colados no texto, lendo "o que éSe os pesos do modelo…". As regras de estilo estavam presas ao seletor da seção, e o conteúdo clonado no painel caía fora dele. O painel passou a herdar o mesmo bloco de estilo, e o rótulo virou linha própria, em maiúsculas, com o "o que não conclui" na cor de alerta.
- Três gráficos apontavam para o indicador errado por descuido do mapa: `anfam` para "Share de tokens" quando mostra volume absoluto, `board` e `mudou` sem o verbete que de fato explica o que está na tela.

---

## [1.3.0] — 2026-09-09

### Adicionado

- **Busca própria no comparador.** O `datalist` nativo só casa prefixo do valor, e como todo slug começa pelo laboratório, digitar "sonnet" não trazia nada e o campo parecia quebrado. A lista agora casa em qualquer posição, aceita várias palavras soltas, navega por teclado, mostra o share de cada modelo e avisa quando não há resultado.
- **O "?" de cada gráfico abre o painel de metodologia no verbete daquele indicador**, em vez de arrastar o leitor até o fim da página e devolvê-lo perdido. Escape fecha e devolve o foco ao ponto de origem.
- **A leitura do ciclo de vida nomeia os 10 modelos** que ela usa. Falar de "os 10 mais usados" sem dizer quais deixa o número inauditável.
- Sete travas novas no `tests/e2e.js`, entre elas a que falha se algum eixo de tempo não mostrar o ano e a que falha se o "?" rolar a página.

### Corrigido

- **Eixo de tempo sem ano.** O ano só aparecia em janeiro, então uma série de 20 meses exibia dois "fev" e dois "abr" sem distinção; em tela estreita janeiro nem virava marca e o ano sumia da tela inteira. Agora o ano entra na primeira marca e sempre que ele vira.
- **`US$ 0,450`** no comparador. O corte de zero sobrando rodava depois da troca de ponto por vírgula, então a expressão procurava um ponto que já não existia. Acima de um dólar o preço passa a ter sempre duas casas.
- **"Mix Anthropic na última semana"** virou "na semana de 31 ago 26". Com o cabeçalho dizendo que os dados vão até ontem, "última semana" era ambíguo e não dava para conferir.
- **Ordenação por "Lançamento"** renomeada para "Estreia", com a ressalva de que é a primeira aparição no ranking e não a data de lançamento: modelos que já existiam quando a série começa aparecem todos na primeira semana.

---

## [1.2.0] — 2026-09-09

### Adicionado

- **Botão "Como ler esta página"** no topo à direita, abrindo um painel lateral com os 17 indicadores documentados. O conteúdo não é duplicado: é clonado da seção 12 na primeira abertura, então existe uma fonte de verdade só. Fecha com Escape ou clique fora, prende o foco enquanto aberto e devolve o foco ao botão.
- **Selo de variação nos tiles.** O número grande é sempre a última semana, que está em toda janela, então trocar a janela quase não mudava o que se via. Agora cada tile mostra ao lado quanto aquilo variou dentro da janela escolhida.
- **Rótulo de período dinâmico.** A palavra "semanal" e o cabeçalho "Semana" viraram elementos marcados com `data-per`, trocados num lugar só quando o agrupamento muda para mês. Rótulo novo nasce correto.
- Quatro travas novas no `tests/e2e.js`, entre elas a que falha se qualquer número aparecer na tela com ponto decimal, e a que falha se um gráfico continuar rotulado como semanal no modo mensal.

### Corrigido

- **Números em inglês espalhados pela página.** O eixo do gráfico principal mostrava `0.00T`, a leitura do ciclo de vida dizia `8.79 semanas`, e havia `2.5`, `0.11` e `53.4` em tabelas, tooltips e eixos. A correção estrutural está no helper `table()`, que agora formata qualquer célula numérica, e no `fmtNum`, usado por todos os rótulos de eixo. Tabela nova já nasce em português.
- **Concordância** em "do último semana", que aparecia na barra de filtros no modo semanal.
- **Cor com juízo de valor nos tiles.** A linha de apoio era verde fixo para China e pesos abertos, vermelha fixa para Anthropic e concentração. Isso é torcida, não dado. O selo agora usa seta para direção e cor neutra, e o leitor decide se aquilo é bom para ele.
- Painel lateral com `display:flex` sobrescrevendo o atributo `hidden`, o que o deixava invisível mas ainda interceptando cliques na página inteira.

---

## [1.1.0] — 2026-09-09

### Adicionado

- **Seção "Sinais da temporada".** Duas partes. *Achados* aplica cinco regras de anomalia sobre o recorte visível, sem curadoria manual: aceleração acima de dois desvios da própria oscilação, modelo ganhando share apesar de custar acima da mediana, sobrevivente no top 10 muito além da idade mediana do topo, inversão da tendência de concentração, e descolamento entre pesos abertos e China. *Se o ritmo atual se mantiver* estende a inclinação observada por mínimos quadrados, com aviso explícito de que não é previsão.
- **`tests/e2e.js`** ganhou seis verificações sobre a seção nova, entre elas a de que a janela muda a base do estimador e a de que nenhuma linha publica taxa que arredonda para zero.

### Corrigido

- **A janela passou a fazer parte do dado, não do desenho.** Os painéis de leitura repetiam o mesmo texto em todas as janelas porque cada gráfico recortava a série por conta própria e os textos liam a série inteira. Agora `W`, `N` e `SERIES` já saem recortados, e o índice 0 é o início da janela para todo mundo. É uma correção estrutural: painel novo nasce correto sem precisar lembrar da regra.
- **A projeção ignorava a janela.** A base do estimador era fixa em oito períodos, então "tudo", "52", "26" e "13" produziam a mesma reta até a casa decimal, e o chip de janela não mudava nada naquele cartão. Base e horizonte passaram a sair da própria janela, com o horizonte limitado a um quarto do que foi observado.
- **Reta que fura o piso não publica mais o valor de chegada.** Extrapolar oito pontos por treze períodos levava qualquer série pequena a zero, e a página exibia "Anthropic 4,5% → 0,0%" como manchete, com a ressalva embaixo. Agora a informação publicada é o rompimento, em vermelho, com uma nota única explicando que ele é a prova de que a taxa não se sustenta.
- Linhas de projeção com taxa que arredondava para zero, exibindo "caindo 0,0pp por semana".
- Gráfico de idade gerando NaN na janela de quatro semanas. A censura dos primeiros doze pontos vivia no desenho, com índice absoluto, e não sobrevivia ao recorte.
- Leituras que citavam laboratório por nome fixo e quebravam a página quando o filtro removia aquele laboratório.
- Legendas dos gráficos passaram a ser clicáveis, com estado de série oculta e botão de restaurar.
- Busca digitável e ordem alfabética no comparador de modelos; barras e linhas ordenadas por valor.

---

## [1.0.0] — 2026-09-09

### Adicionado

- **O mapa da temporada.** Os 19 laboratórios com volume posicionados por percentil: tração no eixo vertical, capacidade no horizontal, com rastro de onde cada um dos oito maiores estava doze semanas antes. Quatro quadrantes: Líderes, Desafiantes, Promessas e Nichados. Dois modos de eixo horizontal, capacidade declarada e Índice de Inteligência, e pesos ajustáveis pelo leitor.
- **Granularidade semanal ou mensal**, e janelas de tudo, ano corrente, 52, 26, 13 e 4 semanas.
- **Seção "Como ler cada indicador"**, com 16 indicadores documentados. Cada um responde o que é, como é calculado, e o que **não** conclui.
- **`tests/fuzz.js`**, varredura que aplica cada opção de filtro isolada, todos os pares entre dimensões e recortes degenerados, e falha em erro de JavaScript, número inválido, gráfico em branco ou painel vazio.
- Atalho "pular para o conteúdo", marco `<main>`, `role="img"` e rótulo em todos os SVGs, `caption` nas tabelas.

### Corrigido

- Frase "0 de 0 modelos têm o índice" em nove recortes de filtro, encontrada pela varredura automática.
- Contraste de texto abaixo de 4,5:1 em `--ink-3` (3,79:1) e no acento (3,41:1) no tema claro.
- Eixo de meses colidindo em telas estreitas. A causa era `d3.timeMonth.every(n)`, que filtra por mês do ano e faz novembro e janeiro caírem colados na virada.

### Notas de método

Ao agrupar por mês, valores absolutos passam a ser a **média semanal do mês**, não a soma. Sem isso, um mês de cinco semanas apareceria 25% maior que um de quatro sem nada ter acontecido no mercado. Percentuais não mudam, porque share é razão de somas.

---

## [0.6.0] — 2026-09-09

### Adicionado

- **Seção "Para onde vai o dinheiro"**: gasto semanal estimado com faixa piso-teto, e share de tokens contra share do gasto por laboratório.
- **Seção "Qualidade contra adoção"**: dispersão do Índice de Inteligência contra share, com alternância para preço em escala logarítmica.
- **Seção "O que mudou esta semana"**: entradas e saídas do top 10, estreias no ranking e maiores variações de share em quatro semanas.
- **Comparador de dois modelos**, com onze atributos lado a lado e a curva de share dos dois.

### Corrigido

- Faixa piso-teto do gasto colapsada, porque a matriz só carregava o preço misto.
- Preço exibido como `US$ 1.251` para um dólar e vinte e cinco.
- Contexto exibido como `1.05M`, precisão que a diferença entre 1048576 e 1050000 não sustenta.

---

## [0.5.0] — 2026-09-09

### Adicionado

- **Motor de filtros**: cobrança, licença dos pesos, país-sede, faixa de preço, janela de contexto, modalidade e raciocínio. Todos os gráficos respondem ao mesmo recorte, e o estado vai para a URL.
- **Matriz modelo × semana** esparsa no `data.json`, 403 modelos e 85 semanas em cerca de 17 KB comprimidos. É o que torna filtro possível: sem os números por modelo, o navegador não consegue reagregar.
- **`pipeline/selftest.py`**, invariantes do `data.json`, no pipeline diário.
- **`tests/e2e.js`**, verificações em navegador real, incluindo a comparação entre o que a página calcula no cliente e o que o pipeline calculou em Python.
- **`.github/workflows/tests.yml`**, que também valida que o `data.json` commitado é exatamente o que o `build.py` gera a partir dos CSVs versionados.
- `window.MS`, ponto de inspeção público para auditar os números no console.

### Corrigido

- Linha `other` da fonte entrando no leaderboard como se fosse um modelo.
- `top5` com semântica divergente entre Python e JavaScript, 6,8 pontos percentuais de desvio numa semana.
- Fatia "Outros" contada duas vezes no gráfico por laboratório, 10,7 pontos percentuais faltando.
- Painéis de leitura com nome de laboratório escrito no código, que derrubavam a página inteira quando o filtro removia o laboratório do top 8.
- Multiplicador absurdo nos tiles sob filtro (`×66716 desde 06 jan 25`), quando a base de comparação era próxima de zero.

---

## [0.4.0] — 2026-09-09

### Adicionado

- **"A forma de uma temporada"**: 126 modelos alinhados na semana de estreia e normalizados pelo próprio pico, com mediana e faixa interquartil. Segunda visão em small multiples por trimestre de lançamento.
- **Legenda clicável** em todos os gráficos, para ligar e desligar séries.
- Layout para telas abaixo de 600px.

### Alterado

- **Paleta reduzida de oito para quatro cores categóricas.** Busca por script mostrou que quatro é o máximo que passa em todos os testes de daltonismo e de visão normal, nos temas claro e escuro. A quinta cor sempre viola algum piso, porque o tema escuro exige luminância numa faixa estreita.
- Gráfico da Anthropic passou a usar ênfase em tinta em vez de uma cor de categoria: o sujeito do gráfico não é um item da lista.

### Corrigido

- Paleta anterior falhava em `--pairs all`: verde escuro contra laranja com ΔE 3,2 sob protanopia, e vermelho contra laranja com ΔE 7,1 em visão normal.

---

## [0.3.0] — 2026-09-09

### Adicionado

- **`data/models_catalog.csv`**, catálogo acumulativo de 347 modelos com preço, contexto, data de lançamento, modalidade, pesos, raciocínio, Índice de Inteligência e Elo. Linhas nunca são removidas: modelo descontinuado some da API e levaria os metadados junto.
- **`pipeline/enrich.py`**, junção do ranking com o catálogo. Cobertura de 99,9% do volume da última semana.
- Dimensões novas no `data.json`: gasto estimado, preço efetivo, faixas de preço e contexto, modalidade, raciocínio, contexto mediano e qualidade cruzada com adoção.
- Guard de duplicatas no catálogo e de cobertura mínima de metadado.

### Corrigido

- Sufixo `:free` tratado como modelo distinto. É um endpoint gratuito do mesmo modelo, e sete modelos apareciam duplicados.
- `hugging_face_id` como string vazia contando como preenchido, inflando a cobertura de pesos abertos em 65%.
- Deduplicação de variantes dependente da ordenação da API.

---

## [0.2.0] — 2026-09-09

### Adicionado

- Domínio `modelseason.com` na Vercel, com DNS na Cloudflare, apex como primário e `www` redirecionando com 308.
- Card social gerado pelo pipeline a cada execução, com os números do dia.
- Tags Open Graph e Twitter, `robots.txt`, `sitemap.xml`, canonical e favicon.
- README orientado ao produto; conteúdo técnico movido para `docs/pipeline.md`.
- `LICENSE` separando MIT no código de CC BY 4.0 nos dados.

### Corrigido

- Atribuição ao OpenRouter fora do formato exigido pela licença. A frase canônica com `as_of` dinâmico passou a constar no rodapé.
- `daily_first` e `daily_last` saindo do dataframe já filtrado por semanas completas, fazendo a página anunciar dois dias a menos de cobertura do que o repositório publica.

---

## [0.1.0] — 2026-09-09

### Adicionado

- Estrutura do repositório, pipeline diário no GitHub Actions e deploy na Vercel.
- Guard de integridade com duplicatas, frescor em dois níveis e buracos catalogados.
- Alerta por issue do GitHub, com fechamento automático quando o pipeline volta a funcionar.
