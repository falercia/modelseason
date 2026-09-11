/**
 * Compila content/**\/<idioma>/*.md em content/conteudo.json ({ pt, en }),
 * validando o contrato. Roda antes de todo build e de todo dev (prebuild/predev).
 * Texto incompleto derruba a esteira: gráfico sem "o que não mostra" não vai ao ar.
 *
 * Idiomas: o português é a referência. Cada idioma precisa ter os mesmos
 * gráficos (mesmo id, tipo e indicadores, comparados pelo arquivo do indicador)
 * e os mesmos indicadores. No inglês, acento ou palavra de português é erro.
 * Em CI e na Vercel (variável CI) a paridade é estrita; localmente, arquivo que
 * falta cai no português com aviso, para dar para ver o site em construção.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

const IDIOMAS = ['pt', 'en'];
const ESTRITO = !!process.env.CI;
const raiz = path.resolve(import.meta.dirname, '..', 'content');
const erros = [], avisos = [];
const exigir = (c, m) => { if (!c) erros.push(m); };

const ler = (pasta, lang) => {
  const dir = path.join(raiz, pasta, lang);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(f => f.endsWith('.md')).sort()
    .map(f => ({ ...matter(readFileSync(path.join(dir, f), 'utf8')).data, _arq: `${lang}/${f}`, _nome: f }));
};

// Marca de português que não pode sobrar no inglês. Tags HTML e o nome τ-bench ficam fora da checagem.
const MARCA_PT = /[ãõçáéíóúâêôà]|\b(não|são|está|também|então|porque|pelo|pela|uma|dos|das|semana|semanas|mês|meses|laboratório|modelos?|gráfico|preço|gasto)\b/i;
const textoLimpo = s => String(s).replace(/<[^>]+>/g, ' ').replace(/τ-bench[^,.]*/g, '');

function compilar(lang) {
  const indicadores = ler('indicadores', lang).map(i => {
    exigir(i.titulo?.length >= 3, `${i._arq}: titulo`);
    for (const k of ['oQueE', 'comoECalculado', 'oQueNaoConclui']) exigir(typeof i[k] === 'string' && i[k].length >= 40, `${i._arq}: ${k} curto demais`);
    return { slug: i._nome.replace(/\.md$/, ''), titulo: i.titulo, oQueE: i.oQueE, comoECalculado: i.comoECalculado, oQueNaoConclui: i.oQueNaoConclui };
  });
  const porTitulo = new Map(indicadores.map(i => [i.titulo, i.slug]));
  const graficos = {}, indicadoresPorGrafico = {};
  for (const g of ler('graficos', lang)) {
    exigir(g.id, `${g._arq}: id`);
    exigir(!graficos[g.id], `${lang}: id repetido: ${g.id}`);
    exigir(g._nome === g.id + '.md', `${g._arq}: nome do arquivo precisa ser o id (${g.id})`);
    exigir(['linha', 'area', 'barras', 'dispersao', 'texto'].includes(g.tipo), `${g._arq}: tipo inválido ${g.tipo}`);
    exigir(typeof g.comoLer === 'string' && g.comoLer.length >= 80, `${g._arq}: comoLer`);
    exigir(typeof g.perguntaQueResponde === 'string' && g.perguntaQueResponde.length >= 60, `${g._arq}: perguntaQueResponde`);
    exigir(typeof g.oQueNaoMostra === 'string' && g.oQueNaoMostra.length >= 60, `${g._arq}: oQueNaoMostra`);
    exigir(Array.isArray(g.indicadores) && g.indicadores.length > 0, `${g._arq}: indicadores`);
    for (const t of g.indicadores ?? []) exigir(porTitulo.has(t), `${g._arq}: indicador desconhecido "${t}"`);
    indicadoresPorGrafico[g.id] = (g.indicadores ?? []).map(t => porTitulo.get(t));
    graficos[g.id] = { id: g.id, titulo: g.titulo, subtitulo: g.subtitulo || '', tipo: g.tipo, modos: g.modos || [],
      indicadores: g.indicadores, comoLer: g.comoLer, perguntaQueResponde: g.perguntaQueResponde, oQueNaoMostra: g.oQueNaoMostra };
  }
  // Dois gráficos não podem exibir a mesma explicação: é como um mapa repetido volta a mostrar o texto errado.
  const vistos = new Map();
  for (const g of Object.values(graficos)) { const k = g.comoLer.trim(); exigir(!vistos.has(k), `${lang}: ${g.id} repete a explicação de ${vistos.get(k)}`); vistos.set(k, g.id); }
  if (lang !== 'pt') {
    for (const obj of [...Object.values(graficos), ...indicadores]) for (const [k, v] of Object.entries(obj)) {
      if (['id', 'slug', 'tipo'].includes(k)) continue;
      for (const s of Array.isArray(v) ? v : [v]) if (typeof s === 'string' && MARCA_PT.test(textoLimpo(s)))
        erros.push(`${lang}/${obj.id ?? obj.slug}: ${k} com marca de português: "${textoLimpo(s).match(MARCA_PT)[0]}"`);
      for (const s of Array.isArray(v) ? v : [v]) if (typeof s === 'string' && /\d,\d|US\$/.test(textoLimpo(s)))
        erros.push(`${lang}/${obj.id ?? obj.slug}: ${k} com formato de número em português`);
    }
  }
  return { graficos, indicadores, indicadoresPorGrafico };
}

const saida = {};
const PT = compilar('pt');
saida.pt = { graficos: PT.graficos, indicadores: PT.indicadores };
for (const lang of IDIOMAS.filter(l => l !== 'pt')) {
  const X = compilar(lang);
  const falta = (m) => (ESTRITO ? erros : avisos).push(m);
  // Paridade com o português, e o que falta cai no português.
  for (const id of Object.keys(PT.graficos)) {
    const g = X.graficos[id];
    if (!g) { falta(`${lang}: gráfico ${id} sem tradução`); X.graficos[id] = PT.graficos[id]; continue; }
    exigir(g.tipo === PT.graficos[id].tipo, `${lang}/${id}: tipo diferente do português`);
    exigir(JSON.stringify(X.indicadoresPorGrafico[id]) === JSON.stringify(PT.indicadoresPorGrafico[id]),
      `${lang}/${id}: indicadores diferentes do português (${X.indicadoresPorGrafico[id]} vs ${PT.indicadoresPorGrafico[id]})`);
    exigir((g.modos || []).length === (PT.graficos[id].modos || []).length, `${lang}/${id}: modos diferentes do português`);
  }
  for (const id of Object.keys(X.graficos)) exigir(PT.graficos[id], `${lang}: gráfico ${id} não existe em português`);
  const slugsX = new Set(X.indicadores.map(i => i.slug));
  for (const i of PT.indicadores) if (!slugsX.has(i.slug)) { falta(`${lang}: indicador ${i.slug} sem tradução`); X.indicadores.push(i); }
  for (const i of X.indicadores) exigir(PT.indicadores.some(p => p.slug === i.slug), `${lang}: indicador ${i.slug} não existe em português`);
  X.indicadores.sort((a, b) => PT.indicadores.findIndex(p => p.slug === a.slug) - PT.indicadores.findIndex(p => p.slug === b.slug));
  saida[lang] = { graficos: X.graficos, indicadores: X.indicadores };
}
if (avisos.length) console.warn(`conteúdo: ${avisos.length} texto(s) sem tradução, usando o português:\n  ` + avisos.slice(0, 20).join('\n  '));
if (erros.length) { console.error('Conteúdo inválido:\n  ' + erros.join('\n  ')); process.exit(1); }
writeFileSync(path.join(raiz, 'conteudo.json'), JSON.stringify(saida) + '\n');
console.log(`conteúdo: ${Object.keys(PT.graficos).length} gráficos, ${PT.indicadores.length} indicadores, idiomas ${IDIOMAS.join(' e ')}`);
