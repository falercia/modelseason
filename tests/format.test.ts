/**
 * Formatação por idioma.
 *  1. Português idêntico à v1: toda saída de formatadores('pt') bate com a foto
 *     tirada do código antigo (tests/fixtures/format-pt.json).
 *  2. Inglês com convenção americana e as mesmas regras de arredondamento.
 *  3. Nenhum texto em inglês com vírgula decimal, "US$", "mi", "mil" ou mês em português.
 *
 * Uso: node --experimental-strip-types tests/format.test.ts
 */
import { readFileSync } from 'node:fs';
import { formatadores, curto } from '../lib/format.ts';
import { caminho, trocarIdioma, semPrefixo, urlModelo } from '../lib/i18n.ts';
import { temRotuloEn, rotuloValor, rotuloLab, rotuloPesos } from '../lib/rotulos.ts';

const falhas: string[] = [];
const ok = (nome: string, cond: boolean, det = '') => { console.log((cond ? '  ok  ' : '  X   ') + nome + (cond ? '' : `  [${det}]`)); if (!cond) falhas.push(nome); };
const eq = (nome: string, a: unknown, b: unknown) => ok(nome, JSON.stringify(a) === JSON.stringify(b), `${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);

const FOTO = JSON.parse(readFileSync(new URL('./fixtures/format-pt.json', import.meta.url), 'utf8'));
const P = formatadores('pt'), E = formatadores('en');
const nums = [null, undefined, NaN, Infinity, -3.456, -0.04, 0, 0.0004, 0.001, 0.0049, 0.012, 0.05, 0.123, 0.5, 0.999, 1, 1.005, 1.25, 2.5, 9.99, 10, 12.345, 99.5, 100, 123.456, 999, 1000, 1500, 12345.6, 32768, 131072, 200000, 1000000, 1048576, 2000000, 1e8, 2.5e9];
const datas = ['2025-01-06', '2026-02-28', '2026-09-08', '2026-12-31'];
const slugs = ['anthropic/claude-sonnet-4.5', 'openai/gpt-5-mini-20250807', 'deepseek/deepseek-v4-flash-2026-07-31:free', 'x', 'google/gemini-3-pro:thinking'];

type F = typeof P;
const serie = (X: F) => {
  const o: Record<string, unknown> = {};
  const run = (nome: string, fn: (v: any) => unknown) => { o[nome] = nums.map(v => { try { return fn(v); } catch { return 'ERRO'; } }); };
  run('fmtT', X.fmtT); run('fmtNum1', v => X.fmtNum(v)); run('fmtNum0', v => X.fmtNum(v, 0)); run('fmtNum2', v => X.fmtNum(v, 2));
  run('fmtP', v => X.fmtP(v)); run('fmtP2', v => X.fmtP(v, 2)); run('fmtP0', v => X.fmtP(v, 0)); run('fmtPP', X.fmtPP);
  run('fmtUSD', X.fmtUSD); run('fmtUSDm', X.fmtUSDm); run('fmtCtx', X.fmtCtx); run('fmtVez', X.fmtVez);
  run('pct', X.pct); run('fmtCusto', X.fmtCusto); run('fmtCustoCurto', X.fmtCustoCurto); run('fmtReq', X.fmtReq); run('fmtTokReq', X.fmtTokReq);
  run('fmtTrilhao', X.fmtTrilhao); run('fmtVezes', X.fmtVezes); run('ord', v => (typeof v === 'number' && isFinite(v) ? X.ord(Math.round(Math.abs(v)) || 1) : 'x'));
  o.fD = datas.map(X.fD); o.fMes = datas.map(X.fMes); o.fBR = datas.map(X.fBR);
  o.fPerS = datas.map(d => X.fPer(d, 'semana')); o.fPerM = datas.map(d => X.fPer(d, 'mes'));
  o.curto = slugs.map(curto); o.urlModelo = slugs.map(s => urlModelo(s, X.lang));
  o.fmtModalidade = [null, 'text->text', 'text+image->text', 'text+image+file+audio->text+image', 'video'].map(X.fmtModalidade);
  o.nomeAvaliacao = ['gpqa_diamond', 'tau_bench_verified_airline', 'swe_bench_x'].map(X.nomeAvaliacao);
  o.br = ['1.5', 2.25, '3'].map(X.br);
  return o;
};

console.log('português idêntico à v1');
const SP = serie(P);
for (const k of Object.keys(FOTO)) if (k !== 'fmtPesos') eq(`pt ${k}`, SP[k], FOTO[k]);

console.log('inglês');
const SE = serie(E);
const textos = Object.values(SE).flat().filter((v): v is string => typeof v === 'string');
ok('en sem vírgula decimal', !textos.some(s => /\d,\d/.test(s)), textos.filter(s => /\d,\d/.test(s)).join(' | '));
ok('en sem US$, " mi" ou " mil"', !textos.some(s => /US\$| mi\b| mil\b/.test(s)));
ok('en sem mês em português', !textos.some(s => /\b(fev|abr|mai|ago|set|out|dez)\b/.test(s)));
ok('en sem º', !textos.some(s => s.includes('º')));
eq('en fmtUSD', [3, 0.5, 12.5, 150, 0.0123].map(E.fmtUSD), ['$3.00', '$0.5', '$12.50', '$150', '$0.012']);
eq('en fmtUSDm', [1.23, 45.6].map(E.fmtUSDm), ['$1.2M', '$46M']);
eq('en fmtP / fmtPP', [E.fmtP(12.34), E.fmtP(0.5, 2), E.fmtPP(5.46), E.fmtPP(-1.24), E.fmtPP(0)], ['12.3%', '0.50%', '+5.5 pp', '−1.2 pp', '0.0 pp']);
eq('en fmtT', [0.123, 2.5, 123].map(E.fmtT), ['0.12T', '2.5T', '123T']);
eq('en fmtReq / fmtTokReq', [E.fmtReq(16_000_000), E.fmtReq(820_000), E.fmtTokReq(132_000), E.fmtTokReq(1500)], ['16.0M', '820K', '132K', '1.5K']);
eq('en datas', [E.fD('2026-09-08'), E.fMes('2026-09-08'), E.fBR('2026-01-06'), E.marcaDia(new Date(2026, 8, 8)), E.marcaMes(new Date(2026, 0, 1), true), E.marcaMes(new Date(2026, 1, 1), false)],
  ['Sep 8, 2026', 'Sep 2026', 'Jan 6, 2026', 'Sep 8', "Jan '26", 'Feb']);
eq('pt marcas de eixo', [P.marcaDia(new Date(2026, 8, 8)), P.marcaMes(new Date(2026, 0, 1), true), P.marcaMes(new Date(2026, 1, 1), false)], ['08 set', 'jan 26', 'fev']);
eq('en ordinais', [1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111, 112].map(E.ord), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st', '111th', '112th']);
eq('en modalidade', E.fmtModalidade('text+image+file->text'), 'text, image and file → text');
eq('listas', [P.lista(['a', 'b', 'c']), E.lista(['a', 'b', 'c']), E.lista(['a']), E.lista([])], ['a, b e c', 'a, b and c', 'a', '']);

console.log('rotas');
eq('caminho', [caminho('pt', '/'), caminho('en', '/'), caminho('en', '/m/a/b'), caminho('en', '/#s03'), caminho('pt', '/?janela=13#s03'), caminho('en', '/?x=1')],
  ['/', '/en', '/en/m/a/b', '/en#s03', '/?janela=13#s03', '/en?x=1']);
eq('urlModelo', [urlModelo('openai/gpt-5:free', 'pt'), urlModelo('openai/gpt-5:free', 'en')], ['/m/openai/gpt-5', '/en/m/openai/gpt-5']);
eq('semPrefixo', ['/en', '/en/m/x', '/pt/m/x', '/m/x', '/', '/english'].map(semPrefixo), ['/', '/m/x', '/m/x', '/m/x', '/', '/english']);
eq('trocarIdioma', [trocarIdioma('/m/x', 'en', '?janela=13', '#s03'), trocarIdioma('/en/m/x', 'pt'), trocarIdioma('/en', 'pt'), trocarIdioma('/', 'en')],
  ['/en/m/x?janela=13#s03', '/m/x', '/', '/en']);

console.log('rótulos do dado');
const D = JSON.parse(readFileSync(new URL('../public/data.json', import.meta.url), 'utf8'));
const semEn = Object.entries(D.matriz.dic as Record<string, string[]>).filter(([d]) => d !== 'vendor')
  .flatMap(([, vs]) => vs).filter(v => !temRotuloEn(v));
ok('todo valor de filtro do data.json tem rótulo em inglês', !semEn.length, semEn.join(' | '));
ok('rótulos em inglês sem acento nem vírgula decimal', !Object.values(D.matriz.dic as Record<string, string[]>).flat()
  .map(v => rotuloValor(v, 'en')).some(v => /[ãõçáéíóúâêô]|\d,\d/i.test(v)));
eq('laboratórios', [rotuloLab('x-ai', 'en'), rotuloLab('stealth', 'en'), rotuloLab('Outros', 'en'), rotuloLab('stealth', 'pt'), rotuloLab('novo-lab', 'en')],
  ['xAI', 'Anonymous (stealth)', 'Other', 'Anônimo (stealth)', 'Novo Lab']);
eq('pesos', [rotuloPesos('Open-weights', 'pt'), rotuloPesos('Open-weights', 'en'), rotuloPesos('x', 'en')], ['Pesos abertos', 'Open weights', 'Unknown']);

console.log(falhas.length ? `\n${falhas.length} falharam.` : '\nTodas passaram.');
if (falhas.length) process.exit(1);
