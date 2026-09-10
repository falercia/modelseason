import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// O contrato do conteudo. Ate aqui os 23 textos de grafico moravam dentro de
// 2.800 linhas de JavaScript: ninguem lia os 23 numa passada e nada verificava
// se "area empilhada" era verdade. Agora cada grafico e um arquivo, e o build
// recusa qualquer um incompleto.
const indicadores = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/indicadores' }),
  schema: z.object({
    titulo: z.string().min(3),
    oQueE: z.string().min(40),
    comoECalculado: z.string().min(40),
    // O bloco que quase nenhum painel publica, e o que mais importa numa
    // decisao. Obrigatorio por schema para que ninguem "esqueca".
    oQueNaoConclui: z.string().min(40),
  }),
});

const graficos = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/graficos' }),
  schema: z.object({
    id: z.string().min(2),
    titulo: z.string().min(3),
    subtitulo: z.string().default(''),
    // Declarado aqui e conferido contra o DOM pelo tests/e2e.js: se diz barras,
    // o SVG daquele cartao precisa ter barras.
    tipo: z.enum(['linha', 'area', 'barras', 'dispersao', 'texto']),
    modos: z.array(z.string()).default([]),
    indicadores: z.array(z.string()).min(1),
    comoLer: z.string().min(80),
    perguntaQueResponde: z.string().min(60),
    oQueNaoMostra: z.string().min(60),
  }),
});

export const collections = { graficos, indicadores };
