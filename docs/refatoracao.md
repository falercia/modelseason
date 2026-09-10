> **Supersedido em 09/09/2026 por [`arquitetura.md`](arquitetura.md).** A decisão mudou: em vez de
> módulos ES sem empacotador, o alvo passou a ser Astro com Content Collections, porque ele resolve
> nativamente conteúdo com schema, bilíngue e as 403 páginas por modelo. O diagnóstico e o teste de
> foto continuam válidos e foram levados para o documento novo.

# Model Season, plano de quebra do `index.html`

Anotado em 09/09/2026, para executar antes do bilíngue. Não iniciado.

## Por que agora

O arquivo tem **186,6 KB e 2.822 linhas**, sendo 134,8 KB de JavaScript, 21,2 KB de CSS e apenas 7,1 KB de marcação. São 53 funções de topo, 37 constantes e **14 variáveis globais mutáveis**.

Os três defeitos da última rodada têm a mesma raiz, e nenhum deles aparece lendo o código:

| Defeito | Causa |
|---|---|
| Rótulos colados no painel de metodologia | Regra de estilo presa ao seletor `.met`, e o conteúdo clonado caía fora dele |
| 19 de 22 gráficos abrindo verbete com outro nome | Mapa de 22 entradas mantido à mão, sem nada verificando |
| `US$ 0,450` | `br()` inserido antes do corte de zeros, invertendo a ordem da formatação |

Acoplamento invisível é o custo do arquivo único. Ele já cobrou três vezes numa sessão.

O gatilho não é estética, é o bilíngue: extrair strings de 2.822 linhas num arquivo só é exatamente onde esse tipo de erro se multiplica. Como o bilíngue vai encostar em todo texto da página de qualquer jeito, fazer o corte junto sai quase de graça, e fazer depois sai duas vezes.

## A decisão que preserva a arquitetura

**Módulos ES nativos, sem empacotador.** `<script type="module" src="/js/main.js">`, arquivos separados servidos estaticamente pela Vercel.

| Opção | Custo | Veredito |
|---|---|---|
| Módulos ES nativos | Nenhum passo de build; ~14 requisições em HTTP/2 | **Escolhida.** Mantém a propriedade que sustenta o projeto: nenhum build, deploy em segundos, qualquer pessoa abre o arquivo e lê |
| esbuild ou Vite | Passo de build no Actions e no local, `node_modules` no caminho crítico do deploy diário | Rejeitada. Troca uma dívida de organização por uma de infraestrutura, e a infraestrutura é o que hoje funciona |
| Continuar em arquivo único | Zero hoje, crescente | Rejeitada. É o que estamos pagando |

D3 continua vendorizado e global, como já está.

## O obstáculo real: as 14 globais mutáveis

`W`, `N`, `GRAN`, `JANELA`, `SERIES`, `SEMANAS_ISO`, `MAPA_BUCKET`, `SEMANAS_POR_BUCKET`, `range`, `JANELA_INI`, `JANELA_TOTAL`, `HBAR_ORDEM`, `TRAJ_VIEW`, `QX`, `CMP`, `MAPA_MODO`.

Módulos ES exportam ligação viva mas **somente leitura para quem importa**, então `import {GRAN}` funciona para ler e quebra para escrever. Copiar essas variáveis para cada módulo é a forma mais rápida de introduzir um bug que nenhum teste pega, porque dois módulos passam a ter versões diferentes da mesma verdade.

Solução: um módulo `estado.js` exportando **um objeto único** e as funções que o mudam.

```js
// estado.js
export const S = { gran:'semana', janela:'all', W:[], N:0, SERIES:[], ... };
export function definirJanela(v){ S.janela=v; }
```

Leitura vira `S.gran`, escrita vira função nomeada. Efeito colateral bom: fica auditável quem muda o quê, que hoje não é.

## Mapa de módulos proposto

```
public/
├── index.html          ~8 KB   marcação e o esqueleto das seções
├── css/
│   ├── base.css                tokens, tema claro e escuro, tipografia
│   ├── componentes.css         cartões, chips, tabelas, painel, combobox
│   └── graficos.css            SVG, legendas, tooltip
└── js/
    ├── main.js                 init, ordem de render, resize
    ├── estado.js               objeto único + mutadores
    ├── formato.js              br, fmtT, fmtP, fmtNum, fmtUSD, fmtCtx, datas
    ├── eixo.js                 construirEixo, janela, granularidade, buckets
    ├── dados.js                recalcular, agregar, matriz modelo x semana
    ├── filtros.js              motor de filtros, URL, barra de status
    ├── graficos/
    │   ├── base.js             frame, table, crosshair, legend, vazio
    │   ├── linha.js  area.js  barras.js  dispersao.js
    ├── secoes/
    │   ├── tiles.js  leituras.js  mapa.js  comparador.js  sinais.js  mudou.js
    └── metodologia.js          painel, mapa gráfico → indicadores
```

Regra que vale mais que o mapa: **nenhum módulo escreve em `estado.js` fora de um mutador nomeado**, e **nenhum módulo de gráfico importa outro módulo de gráfico**.

## Step 0, obrigatório antes de mexer: teste de foto

Refatoração pura não pode mudar um pixel. As 72 checagens do `e2e.js` verificam comportamento, não o resultado inteiro. Antes de cortar qualquer coisa:

1. Capturar o texto e a estrutura renderizada em **12 configurações** (6 janelas × 2 granularidades), mais o tema escuro e três larguras.
2. Gravar como arquivo de referência versionado.
3. Depois do corte, exigir **igualdade byte a byte**.

Sem isso, a refatoração é fé. Com isso, é verificável, e o custo é de uma hora.

## Sequência

| # | Passo | Esforço | Risco |
|---|---|---|---|
| 0 | Teste de foto, 12 configurações | 1h | Nenhum |
| 1 | Extrair CSS para três arquivos | 30min | Baixo |
| 2 | `estado.js` + trocar as 14 globais por `S.x` | 2h | **Alto.** É onde mora o bug silencioso |
| 3 | `formato.js`, `eixo.js`, `dados.js` | 1h | Baixo |
| 4 | `graficos/` | 2h | Médio |
| 5 | `secoes/` | 2h | Médio |
| 6 | Rodar foto, e2e, fuzz, selftest | 30min | — |
| 7 | Só então: extração de strings para bilíngue | — | — |

O passo 2 é o único que merece medo. Pode ser feito sozinho, num commit isolado, ainda com tudo em arquivo único: troca as globais pelo objeto e prova com o teste de foto que nada mudou. Só depois o arquivo se abre. Cortar e mudar estado no mesmo commit é o jeito de não descobrir qual dos dois quebrou.

## O que NÃO fazer junto

- Não aproveitar para "melhorar" função nenhuma. Refatoração que corrige bug de passagem é refatoração que não dá para reverter.
- Não introduzir framework. O produto não tem estado de interface complexo, tem 14 variáveis e uma função de render.
- Não minificar. Parte da autoridade do site é qualquer pessoa abrir a fonte e conferir a conta.
