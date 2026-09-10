# Model Season, arquitetura alvo

Escrito em 09/09/2026, substitui o plano de refatoração anterior. Não iniciado.

## As duas perguntas, respondidas

**Banco de dados: não.** O dado são 323 KB de JSON regerados todo dia a partir de CSV versionado. Não há escrita, usuário, sessão nem consulta que o cliente não faça sozinho. Banco traz custo recorrente, mais um segredo, mais um ponto de falha no deploy diário, e remove a propriedade que sustenta a autoridade da página: qualquer pessoa baixa o `data.json` e refaz a conta.

Gatilho para reabrir: **escrita de usuário** (cadastro de newsletter, alerta salvo, comentário) ou histórico que não caiba num arquivo. Com 17 KB comprimidos para 403 modelos por 85 semanas, o segundo está a anos de distância. O primeiro se resolve com serviço de terceiro, não com banco próprio.

**Front: sim, e a escolha certa é Astro.** O argumento que usei antes contra passo de build, de que ele preservaria auditabilidade, estava meio errado. A auditabilidade vem do `data.json` público, do pipeline em Python e do CI provando que um gera o outro. Não vem de alguém ler JavaScript inline.

## Por que Astro, e não vanilla, React ou SvelteKit

O projeto tem três necessidades declaradas: conteúdo revisável, bilíngue, e páginas por modelo para busca orgânica. Astro resolve as três nativamente.

| Necessidade | Astro | Vanilla + módulos ES | React / SvelteKit |
|---|---|---|---|
| Conteúdo com schema | **Content Collections + Zod.** Gráfico sem o bloco "o que não mostra" quebra o build | Arquivo JSON solto, sem validação | Igual ao vanilla, precisa montar |
| Bilíngue | Roteamento i18n nativo, `/` e `/en/` | Manual | Biblioteca extra |
| 403 páginas por modelo | `getStaticPaths`, HTML estático gerado no build | Impossível sem gerador | SSR ou build estático, com mais peso |
| Saída | HTML estático, sem servidor | HTML estático | Estático possível, orientado a servidor |
| D3 | Fica como está, numa ilha interativa | Fica como está | Conflito com o DOM virtual |
| TypeScript | Nativo | JSDoc | Nativo |

React não entra: o produto não tem estado de interface complexo, tem 14 variáveis e uma função de render. DOM virtual só atrapalharia o D3.

**O Content Collections é a peça que resolve o problema que você está vendo.** Hoje os 23 textos de gráfico moram dentro de 2.800 linhas de JavaScript, ninguém lê os 23 numa passada, e nada verifica se "área empilhada" é verdade. Com schema, cada gráfico vira um arquivo, e o build recusa qualquer um incompleto ou incoerente.

## Estrutura alvo

```
src/
├── content/
│   ├── config.ts              schema Zod: o contrato do conteúdo
│   ├── graficos/pt/*.md       23 arquivos, um por gráfico
│   ├── graficos/en/*.md
│   ├── indicadores/pt/*.md    17 verbetes
│   └── indicadores/en/*.md
├── lib/
│   ├── estado.ts              objeto único + mutadores nomeados
│   ├── eixo.ts                janela, granularidade, buckets
│   ├── dados.ts               agregação, matriz modelo × semana
│   ├── filtros.ts             motor de filtros e URL
│   └── formato.ts             números e datas em pt-BR
├── charts/
│   ├── base.ts                frame, tabela, crosshair, legenda
│   └── linha.ts  area.ts  barras.ts  dispersao.ts
├── components/
│   ├── Cartao.astro  Tiles.astro  Painel.astro  Filtros.astro
└── pages/
    ├── index.astro            pt
    ├── en/index.astro
    └── m/[slug].astro         403 páginas estáticas

public/data.json               gerado pelo pipeline Python, intocado
```

O pipeline em Python **não muda em nada**. Ele continua gerando `public/data.json` e commitando. A Vercel passa a rodar `astro build` em vez de servir o arquivo direto.

## O schema, que é o núcleo da proposta

```ts
// src/content/config.ts
const grafico = z.object({
  id: z.string(),
  titulo: z.string(),
  subtitulo: z.string(),
  tipo: z.enum(['linha','area','barras','dispersao','tabela','cartoes']),
  eixoX: z.string().optional(),
  eixoY: z.string().optional(),
  modos: z.array(z.string()).default([]),
  indicadores: z.array(z.string()).min(1),
  comoLer: z.string().min(80),
  perguntaQueResponde: z.string().min(60),
  oQueNaoMostra: z.string().min(60),
});
```

Cada campo obrigatório é um erro que hoje passa. Sem `oQueNaoMostra`, o build falha. Com `indicadores` apontando para verbete inexistente, o build falha. E o teste passa a cruzar declaração com realidade: se `tipo` diz barras, o SVG daquele cartão precisa ter barras; se `modos` tem dois nomes, o texto precisa citar os dois.

Isso é o que não existe hoje e é a razão dos erros que você está vendo.

## Migração, em quatro entregas independentes

| # | Entrega | Esforço | O que prova |
|---|---|---|---|
| 1 | **Envelope Astro.** A página atual entra quase como está, num componente só. Deploy provado, testes rodando | 3h | Que o build não quebra o deploy diário |
| 2 | **Conteúdo para Content Collections**, com schema e revisão dos 23 blocos | 4h | Que os textos ficam corretos e revisáveis |
| 3 | **Código em módulos**, estado tipado, D3 em ilha | 6h | Que o acoplamento invisível acabou |
| 4 | **EN + páginas por modelo** | 6h | Que o teto de busca orgânica saiu de 1 para 404 URLs |

Cada entrega vai para produção sozinha. Nenhuma depende da seguinte ter começado.

**Antes da entrega 1, obrigatório:** teste de foto em 12 configurações, exigindo igualdade byte a byte. Refatoração pura não pode mudar um pixel, e as 73 checagens verificam comportamento, não o resultado inteiro.

## Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Build quebra e o site para de atualizar | A Vercel mantém o último deploy bom no ar. Falha vira site desatualizado, não site fora. O guarda de frescor no pipeline já alerta em 2 dias |
| Dependência quebrando sozinha | Versões travadas, `npm ci`, Dependabot só para segurança |
| Perder simplicidade | Nenhum framework de componente, nenhum estado global de biblioteca. Astro gera HTML e sai do caminho |
| Refatoração introduzir bug silencioso | Teste de foto antes de tudo, e as quatro entregas separadas |

## Profissionalização, além da arquitetura

| Item | Decisão |
|---|---|
| Tipos | TypeScript, que vem nativo com Astro. Some a pergunta de JSDoc |
| Lint e formato | Biome, um binário só, rápido, substitui ESLint e Prettier |
| CI | Já existe. Ganha `astro build`, `biome check` e `tsc --noEmit` |
| Fluxo | Branch e PR, com preview da Vercel. Validação visual antes de publicar, não depois |
| Conteúdo | Revisão separada da revisão de código. Diff de texto para de se misturar com diff de lógica |
| Versionamento | CHANGELOG já existe e está sendo mantido |

## O que continua fora

- Backend, banco, login
- Previsão apresentada como previsão
- Índice próprio de qualidade
- React ou qualquer DOM virtual perto do D3
