/**
 * Compila content/**\/*.md em content/conteudo.json, validando o contrato.
 * Roda antes de todo build e de todo dev (prebuild/predev). Texto incompleto
 * derruba a esteira: gráfico sem "o que não mostra" não vai ao ar.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

const raiz = path.resolve(import.meta.dirname, '..', 'content');
const ler = pasta => readdirSync(path.join(raiz, pasta, 'pt')).filter(f => f.endsWith('.md')).sort()
  .map(f => ({ ...matter(readFileSync(path.join(raiz, pasta, 'pt', f), 'utf8')).data, _arq: f }));
const erros = [];
const exigir = (c, m) => { if (!c) erros.push(m); };

const indicadores = ler('indicadores').map(i => {
  exigir(i.titulo?.length >= 3, `${i._arq}: titulo`);
  for (const k of ['oQueE', 'comoECalculado', 'oQueNaoConclui']) exigir(typeof i[k] === 'string' && i[k].length >= 40, `${i._arq}: ${k} curto demais`);
  return { slug: i._arq.replace(/\.md$/, ''), titulo: i.titulo, oQueE: i.oQueE, comoECalculado: i.comoECalculado, oQueNaoConclui: i.oQueNaoConclui };
});
const nomes = new Set(indicadores.map(i => i.titulo));
const graficos = {};
for (const g of ler('graficos')) {
  exigir(g.id, `${g._arq}: id`);
  exigir(!graficos[g.id], `id repetido: ${g.id}`);
  exigir(g._arq === g.id + '.md', `${g._arq}: nome do arquivo precisa ser o id (${g.id})`);
  exigir(['linha', 'area', 'barras', 'dispersao', 'texto'].includes(g.tipo), `${g._arq}: tipo inválido ${g.tipo}`);
  exigir(typeof g.comoLer === 'string' && g.comoLer.length >= 80, `${g._arq}: comoLer`);
  exigir(typeof g.perguntaQueResponde === 'string' && g.perguntaQueResponde.length >= 60, `${g._arq}: perguntaQueResponde`);
  exigir(typeof g.oQueNaoMostra === 'string' && g.oQueNaoMostra.length >= 60, `${g._arq}: oQueNaoMostra`);
  exigir(Array.isArray(g.indicadores) && g.indicadores.length > 0, `${g._arq}: indicadores`);
  for (const t of g.indicadores ?? []) exigir(nomes.has(t), `${g._arq}: indicador desconhecido "${t}"`);
  graficos[g.id] = { id: g.id, titulo: g.titulo, subtitulo: g.subtitulo || '', tipo: g.tipo, modos: g.modos || [],
    indicadores: g.indicadores, comoLer: g.comoLer, perguntaQueResponde: g.perguntaQueResponde, oQueNaoMostra: g.oQueNaoMostra };
}
// Dois gráficos não podem exibir a mesma explicação: é como um mapa repetido volta a mostrar o texto errado.
const vistos = new Map();
for (const g of Object.values(graficos)) { const k = g.comoLer.trim(); exigir(!vistos.has(k), `${g.id} repete a explicação de ${vistos.get(k)}`); vistos.set(k, g.id); }
if (erros.length) { console.error('Conteúdo inválido:\n  ' + erros.join('\n  ')); process.exit(1); }
writeFileSync(path.join(raiz, 'conteudo.json'), JSON.stringify({ graficos, indicadores }) + '\n');
console.log(`conteúdo: ${Object.keys(graficos).length} gráficos, ${indicadores.length} indicadores`);
