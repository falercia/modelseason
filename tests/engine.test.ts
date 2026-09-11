/**
 * O motor da v2 contra o que o pipeline Python calculou (public/data.json).
 * Sem filtro, janela inteira e semana, as séries do motor precisam bater com as
 * do pipeline. É a mesma trava da v1: a página não pode calcular diferente do
 * que o repositório publica.
 *
 * Uso: node --experimental-strip-types tests/engine.test.ts
 */
import { readFileSync } from 'node:fs';
import { recortar, seriesSemanais, FAMILIAS, familiaDe } from '../lib/engine.ts';
import { LAB_SLOT } from '../lib/cores.ts';

const D = JSON.parse(readFileSync(new URL('../public/data.json', import.meta.url), 'utf8'));
const SS = seriesSemanais(D);
const falhas: string[] = [];
const ok = (nome: string, cond: boolean, det = '') => { console.log((cond ? '  ok  ' : '  X   ') + nome + (cond ? '' : `  [${det}]`)); if (!cond) falhas.push(nome); };
const perto = (a: number[], b: number[], tol: number) => a.length === b.length && a.every((v, i) => Math.abs((v ?? 0) - (b[i] ?? 0)) <= tol);
const maxDif = (a: number[], b: number[]) => Math.max(...a.map((v, i) => Math.abs((v ?? 0) - (b[i] ?? 0))));

const R = recortar(D, SS, { gran: 'semana', janela: 'all', filtros: {} });
ok('eixo tem as semanas do pipeline', R.N === D.weeks.length && R.eixo[0] === D.weeks[0], `${R.N} x ${D.weeks.length}`);
ok('volume semanal bate', perto(R.weekly_total_T, D.weekly_total_T, 0.01), String(maxDif(R.weekly_total_T, D.weekly_total_T)));
ok('top 5 bate', perto(R.top5, D.top5, 0.05), String(maxDif(R.top5, D.top5)));
ok('HHI bate', perto(R.hhi, D.hhi, 2), String(maxDif(R.hhi, D.hhi)));
for (const k of ['China', 'EUA/Canadá']) ok(`origem ${k} bate`, perto(R.origin_share[k], D.origin_share[k], 0.05), String(maxDif(R.origin_share[k], D.origin_share[k])));
// A página usa a licença com prova do catálogo (pesos_share_v2), não a heurística antiga (weights_share).
ok('pesos abertos bate com a classificação do catálogo', perto(R.weights_share['Open-weights'], D.pesos_share_v2['Open-weights'], 0.05));
ok('share da Anthropic bate', perto(R.lab_share.anthropic, D.an_share, 0.05), String(maxDif(R.lab_share.anthropic, D.an_share)));
ok('endpoint gratuito bate', perto(R.free_share, D.free_share, 0.05), String(maxDif(R.free_share, D.free_share)));
ok('gasto semanal bate', perto(R.spend_total_musd, D.spend_total_musd, 0.05), String(maxDif(R.spend_total_musd, D.spend_total_musd)));
// Preço efetivo na página: gasto sobre o volume TOTAL (o que não tem preço conta como zero), como na v1.
// O pipeline divide só pelo volume nomeado; a diferença é conhecida e documentada.
ok('preço efetivo = gasto / volume total', R.preco_efetivo.every((v, w) => !R.weekly_total_T[w] || Math.abs(v - R.spend_total_musd[w] / R.weekly_total_T[w]) < 0.01));
for (const f of Object.keys(D.an_fam_abs)) ok(`família Anthropic ${f} bate`, perto(R.familias_abs.anthropic[f], D.an_fam_abs[f], 0.01), String(R.familias_abs.anthropic[f] ? maxDif(R.familias_abs.anthropic[f], D.an_fam_abs[f]) : 'ausente'));

// famílias somam o volume do laboratório, para os três
for (const g of FAMILIAS) {
  const soma = R.eixo.map((_, w) => Object.values(R.familias_abs[g.lab]).reduce((s, v) => s + v[w], 0));
  const lab = R.vendor_abs[g.lab];
  ok(`famílias de ${g.rotulo} somam o volume do laboratório`, perto(soma, lab, 0.02), String(maxDif(soma, lab)));
}
ok('GPT-5.6 Luna é GPT-5/6', familiaDe(FAMILIAS[1], 'openai/gpt-5.6-luna-20260709') === 'GPT-5 e GPT-6');
ok('o4-mini é raciocínio', familiaDe(FAMILIAS[1], 'openai/o4-mini-2025-04-16') === 'Codex e série o');
ok('gpt-4o fica em anteriores', familiaDe(FAMILIAS[1], 'openai/gpt-4o-2024-11-20') === 'GPT-4 e anteriores');
ok('no máximo 4 famílias nomeadas por laboratório', FAMILIAS.every(g => g.familias.length <= 4));
ok('gpt-5-mini é mini', familiaDe(FAMILIAS[1], 'openai/gpt-5-mini-2025-08-07') === 'Mini e nano');
ok('gemini flash-lite não vira flash', familiaDe(FAMILIAS[2], 'google/gemini-2.5-flash-lite') === 'Gemini Flash-Lite');
ok('gemma é pesos abertos', familiaDe(FAMILIAS[2], 'google/gemma-4-31b-it-20260402') === 'Gemma (pesos abertos)');

// shares somam 100 por período
const somaV = R.eixo.map((_, w) => Object.values(R.vendor_share).reduce((s, v) => s + v[w], 0));
ok('share por laboratório soma 100', somaV.every(v => Math.abs(v - 100) < 0.2), String(Math.max(...somaV.map(v => Math.abs(v - 100)))));

// mês preserva share e usa média semanal no absoluto
const M = recortar(D, SS, { gran: 'mes', janela: 'all', filtros: {} });
const somaM = M.eixo.map((_, w) => Object.values(M.vendor_share).reduce((s, v) => s + v[w], 0));
ok('mês: share soma 100', somaM.every(v => Math.abs(v - 100) < 0.2));
ok('mês: absoluto é média semanal', Math.abs(M.weekly_total_T.at(-1)! - R.weekly_total_T.slice(-M.semanasPorBucket.at(-1)!).reduce((s, v) => s + v, 0) / M.semanasPorBucket.at(-1)!) < 0.02);

// janelas
for (const j of ['52', '26', '13', '4'] as const) {
  const J = recortar(D, SS, { gran: 'semana', janela: j, filtros: {} });
  ok(`janela ${j}: ${j} pontos terminando na última semana`, J.N === +j && J.eixo.at(-1) === R.eixo.at(-1));
  ok(`janela ${j}: idade mediana sem NaN`, J.age.every(v => v == null || Number.isFinite(v)));
}

// filtro: recorte menor, share dentro do recorte
const iCN = D.matriz.dic.origin.indexOf('China');
const F = recortar(D, SS, { gran: 'semana', janela: 'all', filtros: { origin: [iCN] } });
ok('filtro China: só China no share de origem', Math.abs((F.origin_share['China']?.at(-1) ?? 0) - 100) < 0.01);
ok('filtro China: cobertura menor que o total', F.cobertura.filtrando && F.cobertura.pct < 100 && F.cobertura.pct > 0);
ok('filtro China: Anthropic sai do recorte', (F.lab_share.anthropic.at(-1) ?? 0) === 0);

// As quatro cores de laboratório são dos quatro maiores em volume acumulado.
const acum = Object.entries(R.vendor_abs).filter(([k]) => k !== 'Outros').map(([k, v]) => [k, v.reduce((s, x) => s + x, 0)] as [string, number]).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k]) => k).sort();
const slots = Object.keys(LAB_SLOT).filter(k => k !== 'Outros').sort();
ok('as 4 cores de laboratório são dos 4 maiores em volume acumulado', JSON.stringify(acum) === JSON.stringify(slots), `acumulado: ${acum.join(', ')}; cores: ${slots.join(', ')}`);

console.log(`\n${falhas.length ? 'Falharam ' + falhas.length : 'Todas passaram'}.`);
process.exit(falhas.length ? 1 : 0);
