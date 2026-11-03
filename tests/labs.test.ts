/**
 * Cartões de /labs: notícia do Radar junto com movimento oficial (lib/itens-labs.ts).
 *  1. Mesmo lançamento: versão e palavra própria em comum, a até sete dias.
 *  2. Notícia que repete movimento de modelo ou preço, ou outra notícia, sai.
 *  3. Semana do dia e "há N dias".
 *  4. Dado real: nenhuma notícia duplicada por laboratório e o Kimi K3.1 Pro no cartão da Moonshot.
 *
 * Uso: node --experimental-strip-types tests/labs.test.ts (roda junto com npm run test:format)
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { diasDesde, mesmoAssunto, noticiasLabs, ordenarItens, semanaDoDia } from '../lib/itens-labs.ts';

const falhas: string[] = [];
const ok = (nome: string, cond: boolean, det = '') => { console.log((cond ? '  ok  ' : '  X   ') + nome + (cond ? '' : `  [${det}]`)); if (!cond) falhas.push(nome); };

const T = (data: string, titulo: string) => ({ data, titulo });
console.log('mesmo lançamento');
ok('GPT-6.1 Terra na nota e na notícia', mesmoAssunto(T('2026-10-26', 'OpenAI launches GPT-6.1 Terra in the API'), T('2026-10-27', 'OpenAI introduces GPT-6.1 Terra, a fast and efficient model')));
ok('GPT-6.1 Sol e GPT-6.1 Terra são lançamentos diferentes', !mesmoAssunto(T('2026-10-26', 'OpenAI launches GPT-6.1 Terra'), T('2026-10-28', 'OpenAI launches GPT-6.1 Sol')));
ok('Opus 5.5 e Sonnet 5.5 são lançamentos diferentes', !mesmoAssunto(T('2026-09-22', 'Claude Opus 5.5 arrives 40% cheaper'), T('2026-09-28', 'Anthropic launches Claude Sonnet 5.5, faster')));
ok('mesmo modelo a mais de sete dias não junta', !mesmoAssunto(T('2026-09-01', 'Kimi K3.1 Pro arrives'), T('2026-09-20', 'Kimi K3.1 Pro tops the chart')));
ok('data só com o mês não compara', !mesmoAssunto(T('2026-10', 'Kimi K3.1 Pro arrives'), T('2026-10-23', 'Kimi K3.1 Pro arrives')));
ok('ano e porcentagem não contam como versão', !mesmoAssunto(T('2026-10-01', 'Google cuts 40% in 2026 pricing'), T('2026-10-02', 'Google 2026 pricing cut 40%')));
ok('família e número viram versão: Gemini 4 Argon junta, Argon e Carbon não',
  mesmoAssunto(T('2026-10-13', 'Google launches Gemini 4 Argon, its new frontier model'), T('2026-10-13', 'Gemini 4 Argon is available to everyone in the API'))
  && !mesmoAssunto(T('2026-10-13', 'Google launches Gemini 4 Argon'), T('2026-10-18', 'Google unveils Gemini 4 Carbon')));
ok('versão com hífen inteira', mesmoAssunto(T('2026-10-17', 'DeepSeek-V4.1-Flash-1017 reaches the site, app and API'), T('2026-10-19', 'DeepSeek publishes DeepSeek-V4.1-Flash-1017 weights on Hugging Face')));

console.log('notícias nos cartões');
const fonte = (link: string, veiculo = 'x.com') => ({ veiculo, titulo: 't', link });
const assunto = (id: string, categoria: string, labs: string[], en: string, publicado_em: string, link: string) => ({
  id, categoria, nota: 1, labs, publicado_em, fontes: [fonte('https://news.ycombinator.com/item?id=1', 'hn'), fonte(link)],
  pt: { titulo: en, resumo: 'r' }, en: { titulo: en, resumo: 'r' }, cruzamento: [],
});
const mov = (id: string, lab: string, data: string, tipo: 'modelo' | 'api', en: string) => ({
  id, lab, fonte: 'f', link: 'https://l/' + id, data, tipo, pt: { titulo: en, simples: '', tecnico: '' }, en: { titulo: en, simples: '', tecnico: '' },
});
const pautas = [
  { dia: '2026-10-26', assuntos: [
    assunto('a1', 'lancamento', ['moonshotai'], 'Moonshot launches Kimi K3.1 Pro on the API, still without open weights', '2026-10-23T16:59:08Z', 'https://kimi/blog'),
    assunto('a2', 'mercado', ['anthropic'], 'Anthropic files for IPO', '2026-10-25T10:00:00Z', 'https://ipo'),
    assunto('a3', 'lancamento', ['openai', 'x-ai'], 'OpenAI introduces GPT-6.1 Terra, a fast and efficient model', '2026-10-27T10:00:00Z', 'https://terra'),
  ] },
  { dia: '2026-10-28', assuntos: [assunto('a1', 'lancamento', ['moonshotai'], 'Kimi K3.1 Pro climbs to the top 10', '2026-10-27T10:00:00Z', 'https://kimi/2')] },
];
const movs = [mov('m1', 'openai', '2026-10-26', 'modelo', 'OpenAI launches GPT-6.1 Terra in the API'), mov('m2', 'moonshotai', '2026-10', 'api', 'Kimi Batch API accepts kimi-k3.1-pro')];
const N = noticiasLabs(pautas, movs, new Set(['openai', 'moonshotai', 'anthropic']));
ok('lançamento sem nota de versão entra no cartão', N.some(n => n.lab === 'moonshotai' && n.link === 'https://kimi/blog'));
ok('fonte principal não é o Hacker News', N.every(n => !/ycombinator/.test(n.link)));
ok('notícia que repete o movimento de modelo sai', !N.some(n => n.lab === 'openai'), JSON.stringify(N.map(n => n.id)));
ok('segunda notícia do mesmo lançamento sai', N.filter(n => n.lab === 'moonshotai').length === 1, JSON.stringify(N.map(n => n.id)));
ok('categoria fora de lançamento e preço não entra', !N.some(n => n.lab === 'anthropic'));
ok('laboratório não acompanhado não entra', !N.some(n => n.lab === 'x-ai'));
ok('data vem da fonte', N[0].data === '2026-10-23');
const O = ordenarItens([...movs, ...N]);
ok('ordem do mais novo para o mais velho', O.map(x => x.id).join() === ['m1', 'm2', N[0].id].join() || O[0].data >= O.at(-1)!.data, O.map(x => x.id + ':' + x.data).join());

console.log('semana e dias');
const S = ['2026-10-19', '2026-10-26'];
ok('dia dentro da última semana', semanaDoDia(S, '2026-11-01') === 1);
ok('segunda é o primeiro dia da semana', semanaDoDia(S, '2026-10-26') === 1 && semanaDoDia(S, '2026-10-25') === 0);
ok('dia depois da última semana completa fica fora', semanaDoDia(S, '2026-11-02') === null);
ok('dia antes da primeira semana fica fora', semanaDoDia(S, '2026-10-18') === null);
ok('mês sem dia fica fora', semanaDoDia(S, '2026-10') === null);
ok('há N dias', diasDesde('2026-10-30', '2026-11-03') === 4 && diasDesde('2026-11-03', '2026-11-03') === 0 && diasDesde('2026-10', '2026-11-03') === null);

console.log('dado real');
const pasta = new URL('../data/pauta/', import.meta.url);
const reais = existsSync(pasta) ? readdirSync(pasta).filter(a => /^\d{4}-\d{2}-\d{2}\.json$/.test(a)).sort().map(a => JSON.parse(readFileSync(new URL(a, pasta), 'utf8'))) : [];
const ini = new URL('../data/movimentos/inicial.json', import.meta.url);
const movsReais = [...reais.flatMap(p => p.movimentos ?? []), ...(existsSync(ini) ? JSON.parse(readFileSync(ini, 'utf8')).movimentos : [])];
const L = JSON.parse(readFileSync(new URL('../data/web/labs.json', import.meta.url), 'utf8'));
const NR = noticiasLabs(reais, movsReais, new Set(L.labs.map((l: { vendor: string }) => l.vendor)));
const ids = NR.map(n => n.id);
ok('ids únicos', new Set(ids).size === ids.length);
ok('toda notícia tem link http e título nos dois idiomas', NR.every(n => /^https?:\/\//.test(n.link) && n.pt.titulo && n.en.titulo));
let dup = '';
for (const a of NR) for (const b of NR) if (a.id < b.id && a.lab === b.lab && mesmoAssunto({ data: a.data, titulo: a.en.titulo }, { data: b.data, titulo: b.en.titulo })) dup = `${a.id} × ${b.id}`;
ok('nenhum lançamento repetido no mesmo cartão', !dup, dup);
if (reais.some(p => p.dia === '2026-10-26')) ok('Kimi K3.1 Pro no cartão da Moonshot', NR.some(n => n.lab === 'moonshotai' && /K3\.1 Pro/.test(n.en.titulo)));
console.log(`  (${NR.length} notícias levadas aos cartões)`);

console.log(`\n${falhas.length ? 'Falharam ' + falhas.length : 'Todas passaram'}.`);
process.exit(falhas.length ? 1 : 0);
