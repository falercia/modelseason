# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/). Versionamento semântico.

O projeto foi construído em uma única sessão, então todas as versões abaixo carregam a mesma data. A separação em versões é lógica, não cronológica: cada uma marca um estado em que o site estava publicado e funcionando.

## [Não lançado]

Planejado para a v2, detalhado em [`docs/v2.md`](docs/v2.md).

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
