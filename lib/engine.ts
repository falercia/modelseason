/**
 * Motor de recorte da seção "Histórico".
 *
 * Porte fiel do construirEixo() + recalcular() da v1 (public/index.html, até a
 * 1.4.0). Tudo o que a página mostra abaixo do divisor sai daqui: a janela e a
 * granularidade redefinem o eixo, os filtros de modelo redefinem quem entra na
 * soma, e as séries são recalculadas a partir da matriz semanal por modelo.
 *
 * Função pura: recebe o data.json e o estado dos controles, devolve as séries.
 * Nenhum gráfico recorta nada por conta própria. Isso elimina a classe de erro
 * da v1 em que cada painel precisava lembrar de usar o início da janela.
 *
 * Diferença deliberada em relação à v1: as famílias deixaram de ser só da
 * Anthropic. OpenAI e Google ganharam a mesma leitura (seção 09, em abas).
 */
import * as d3 from 'd3';

// ------------------------------------------------------------------ tipos

export type Serie = number[];
export type Series = Record<string, Serie>;

export interface ModeloMatriz {
  s: string; n: string | null; d: number[]; p: number | null; pp: number | null; pc: number | null;
  c: number | null; l: string | null; q: number | null; e: number | null; m: boolean;
}
export interface Matriz {
  semanas: string[]; dims: string[]; dic: Record<string, string[]>; modelos: ModeloMatriz[];
  t0: number[]; v: number[][]; unidade: string;
}
export interface Vida {
  model: string; vendor: string; origin: string; weights: string; first: string; peak_week: string;
  peak_share: number; weeks_to_peak: number; half_life_weeks: number | null; weeks_in_top10: number;
  total_T: number; still_alive: boolean; weeks_alive?: number;
}
/** O data.json da v1, com os campos que o motor e as seções leem. */
export interface DadosV1 {
  weeks: string[]; matriz: Matriz; churn: (number | null)[]; age: (number | null)[];
  life: Vida[]; life_series: Record<string, number[]>; entrants: Record<string, unknown>;
  trajetoria: any; blend: { prompt: number; completion: number };
  last_week: string; n_models: number; as_of: string; daily_first: string; daily_last: string;
  daily_days: number; cobertura: any; cobertura_ultima_semana: any; ctx_mediano?: number[];
  [k: string]: unknown;
}

export type Gran = 'semana' | 'mes';
export type Janela = 'all' | 'ytd' | '52' | '26' | '13' | '4';
export type Filtros = Record<string, number[]>; // dimensão -> índices de valor aceitos

export interface Estado { gran: Gran; janela: Janela; filtros: Filtros }
export const ESTADO_INICIAL: Estado = { gran: 'semana', janela: 'all', filtros: {} };

export const LAB_ROTULO: Record<string, string> = {
  deepseek: 'DeepSeek', google: 'Google', anthropic: 'Anthropic', openai: 'OpenAI', xiaomi: 'Xiaomi',
  tencent: 'Tencent', minimax: 'MiniMax', 'z-ai': 'Z.ai (GLM)', Outros: 'Outros', 'x-ai': 'xAI',
  nvidia: 'NVIDIA', mistralai: 'Mistral AI', moonshotai: 'Moonshot AI', thinkingmachines: 'Thinking Machines',
  stepfun: 'StepFun', inclusionai: 'InclusionAI', poolside: 'Poolside', upstage: 'Upstage', qwen: 'Qwen',
  meta: 'Meta', 'meta-llama': 'Meta', alibaba: 'Alibaba', bytedance: 'ByteDance', 'bytedance-seed': 'ByteDance',
  'arcee-ai': 'Arcee AI', cohere: 'Cohere', microsoft: 'Microsoft', amazon: 'Amazon', perplexity: 'Perplexity',
  liquid: 'Liquid AI', baai: 'BAAI', kwaipilot: 'KwaiPilot', 'nex-agi': 'Nex AGI', 'dots-studio': 'Dots Studio',
  tngtech: 'TNG', nousresearch: 'Nous Research', openchat: 'OpenChat', 'ibm-granite': 'IBM Granite',
  stealth: 'Anônimo (stealth)', openrouter: 'Teste anônimo', 'aion-labs': 'AionLabs',
};
export const rotuloLab = (k: string) =>
  LAB_ROTULO[k] ?? k.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

// ------------------------------------------------------------------ famílias

export interface Familia { nome: string; teste: (nomeModelo: string) => boolean }
export interface GrupoFamilias { lab: string; rotulo: string; familias: Familia[] }

/**
 * Famílias por laboratório, derivadas do slug. A ordem importa: a primeira regra
 * que casa ganha. "Flash-Lite" vem antes de "Flash", "série o" antes de "mini".
 * Modelo que não casa nenhuma entra em "Outros" do próprio laboratório, para a
 * soma das famílias continuar igual ao volume do laboratório.
 */
export const FAMILIAS: GrupoFamilias[] = [
  { lab: 'anthropic', rotulo: 'Anthropic', familias: [
    { nome: 'Opus', teste: n => n.includes('opus') },
    { nome: 'Sonnet', teste: n => n.includes('sonnet') },
    { nome: 'Haiku', teste: n => n.includes('haiku') },
    { nome: 'Fable', teste: n => n.includes('fable') },
  ] },
  { lab: 'openai', rotulo: 'OpenAI', familias: [
    // Quatro famílias nomeadas e o resto em cinza: a paleta validada para
    // daltonismo tem quatro cores, e a quinta sempre viola um dos pisos.
    { nome: 'gpt-oss (pesos abertos)', teste: n => n.includes('gpt-oss') },
    { nome: 'Codex e série o', teste: n => n.includes('codex') || /^o\d/.test(n) },
    { nome: 'Mini e nano', teste: n => /-(mini|nano)(\b|-)/.test(n) },
    { nome: 'GPT-5 e GPT-6', teste: n => /^gpt-[56]/.test(n) },
  ] },
  { lab: 'google', rotulo: 'Google', familias: [
    { nome: 'Gemma (pesos abertos)', teste: n => n.startsWith('gemma') },
    { nome: 'Gemini Flash-Lite', teste: n => n.includes('flash-lite') || n.includes('flash-8b') || n.includes('1.5-8b') },
    { nome: 'Gemini Flash', teste: n => n.includes('flash') },
    { nome: 'Gemini Pro', teste: n => n.includes('pro') },
  ] },
];

/** Nome da faixa cinza de cada laboratório. */
export const OUTROS_FAMILIA: Record<string, string> = { anthropic: 'Outros', openai: 'GPT-4 e anteriores', google: 'Outros' };

export function familiaDe(grupo: GrupoFamilias, slug: string): string {
  const n = slug.split('/').pop()!.toLowerCase().split(':')[0];
  return grupo.familias.find(f => f.teste(n))?.nome ?? OUTROS_FAMILIA[grupo.lab] ?? 'Outros';
}

// ------------------------------------------------------------------ resultado

export interface Lider { model: string; T: number; share: number; vendor: string; origin: string; weights: string }
export interface Variacao { s: string; de: number; para: number; delta: number; origin: string }
export interface Achado { t: string; v: string; p: string; slug?: string }
export interface Projecao { rot: string; atual: string; alvo: string | null; n: number; dir: 'sobe' | 'cai'; taxa: string; rompe: { lim: string; n: number } | null }
export interface PerfilLab {
  lab: string; tokens: number; gasto: number; ctx: number; multi: number; rac: number; ampl: number; cad: number;
  aa: number | null; origem: string; modelos: number; multi_p: number; rac_p: number;
  share: number; shareG: number; cresc: number; pct: Record<string, number>; y: number; xRec: number; xAA?: number; x?: number;
}
export interface PesosMapa { tracao: { share: number; gasto: number; cresc: number }; cap: { ctx: number; multi: number; rac: number; ampl: number; cad: number } }
export const PESOS_PADRAO: PesosMapa = { tracao: { share: 40, gasto: 30, cresc: 30 }, cap: { ctx: 25, multi: 20, rac: 20, ampl: 20, cad: 15 } };

export interface Recorte {
  estado: Estado;
  /** Rótulos ISO do eixo (início de semana ou primeiro dia do mês). */
  eixo: string[]; N: number; semanasPorBucket: number[]; janelaIni: number; janelaTotal: number;
  weekly_total_T: Serie;
  vendor_share: Series; vendor_abs: Series; origin_share: Series; weights_share: Series;
  cobranca_share: Series; free_share: Serie;
  faixa_ctx_share: Series; multimodal_share: Series; raciocinio_share: Series; faixa_preco_share: Series;
  top5: Serie; hhi: Serie; top5_modelos: { s: string; share: number }[][];
  lab_share: Series; comp_share: Record<string, Series>; familias_abs: Record<string, Series>;
  lab_modelos: Record<string, Series>;
  boards: { last: Lider[]; prev12: { model: string; T: number }[]; yearago: { model: string; T: number }[] };
  dist_prev: number;
  spend_total_musd: Serie; spend_band: { piso: Serie; teto: Serie }; spend_share: Series; preco_efetivo: Serie;
  volume_vs_dinheiro: { lab: string; share_tokens: number; share_gasto: number; razao: number | null }[];
  qualidade: { slug: string; nome: string | null; aa: number | null; elo: number | null; preco: number | null; ctx: number | null; lanc: string | null; T: number; share: number; origin: string; pesos: string }[];
  mapa: { labs: PerfilLab[]; antes: Record<string, { x: number; xAA?: number; y: number }>; periodos_atras: number; com_indice: number; total: number };
  mudancas: { semana: string; comparada: string; distancia: number; entraram: string[]; sairam: string[]; subiram: Variacao[]; cairam: Variacao[]; estreantes: { s: string; share: number; origin: string; lanc: string | null }[]; n_estreantes: number };
  sinais: { achados: Achado[]; projs: Projecao[]; base: number; horiz: number; per1: string; perN: string };
  churn: (number | null)[]; age: (number | null)[];
  cobertura: { modelos: number; totalModelos: number; pct: number; filtrando: boolean };
}

// ------------------------------------------------------------------ utilidades

const fmtP = (v: number) => d3.format('.1f')(v).replace('.', ',') + '%';
const br = (s: string | number) => String(s).replace('.', ',');
const fmtUSD = (v: number | null) => {
  if (v == null) return '—';
  const s = v >= 100 ? d3.format('.0f')(v) : v >= 1 ? v.toFixed(2) : v.toFixed(3).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  return 'US$ ' + br(s);
};

function rangeFor(key: Janela, total: number, eixo: Date[], gran: Gran): [number, number] {
  const fim = total - 1;
  if (key === 'all') return [0, fim];
  if (key === 'ytd') {
    const ano = eixo[fim].getFullYear();
    const i = eixo.findIndex(d => d.getFullYear() === ano);
    return [i < 0 ? 0 : i, fim];
  }
  const sem = +key;
  const pontos = gran === 'semana' ? sem : Math.max(2, Math.round(sem / 4.345));
  return [Math.max(0, total - pontos), fim];
}

const iso = (d: Date) => d3.timeFormat('%Y-%m-%d')(d);
const dataDe = (s: string) => new Date(s + 'T00:00:00');

/** Séries semanais por modelo a partir da matriz esparsa. Calculado uma vez por carga. */
export function seriesSemanais(D: DadosV1): number[][] {
  const MX = D.matriz, NW = MX.semanas.length;
  return MX.modelos.map((_, i) => {
    const a = MX.t0[i], v = MX.v[i], s = new Array(NW).fill(0);
    for (let j = 0; j < v.length; j++) s[a + j] = v[j];
    return s;
  });
}

// ------------------------------------------------------------------ motor

export function recortar(D: DadosV1, SERIES_SEM: number[][], estado: Estado, pesos: PesosMapa = PESOS_PADRAO): Recorte {
  const { gran, janela, filtros } = estado;
  const MX = D.matriz;
  const DIMI: Record<string, number> = {}; MX.dims.forEach((d, i) => (DIMI[d] = i));
  const rotulo = (dim: string, i: number) => MX.dic[dim][i];

  // ---- eixo (construirEixo) ----
  const datas = MX.semanas.map(dataDe);
  let eixoTodo: Date[], mapaTodo: number[];
  if (gran === 'semana') { eixoTodo = datas; mapaTodo = datas.map((_, i) => i); }
  else {
    // Semana entra no mês do seu primeiro dia (segunda). Única regra que preserva a soma.
    const chave = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    const chaves = datas.map(chave), unicas = [...new Set(chaves)];
    eixoTodo = unicas.map(k => dataDe(k + '-01'));
    mapaTodo = chaves.map(k => unicas.indexOf(k));
  }
  const nTodo = eixoTodo.length;
  const semTodo = new Array(nTodo).fill(0); mapaTodo.forEach(b => semTodo[b]++);
  // Absoluto vira média semanal dentro do mês: mês de 5 semanas não parece 25% maior.
  const serieTodo = gran === 'semana' ? SERIES_SEM : SERIES_SEM.map(s => {
    const o = new Array(nTodo).fill(0);
    for (let w = 0; w < s.length; w++) o[mapaTodo[w]] += s[w] || 0;
    return o.map((v, i) => v / (semTodo[i] || 1));
  });
  const colMedia = (s: (number | null)[]) => {
    const soma = new Array(nTodo).fill(0), n = new Array(nTodo).fill(0);
    for (let w = 0; w < s.length; w++) { const v = s[w]; if (v == null) continue; soma[mapaTodo[w]] += v; n[mapaTodo[w]]++; }
    return soma.map((v, i) => (n[i] ? +(v / n[i]).toFixed(2) : null));
  };
  const CHURN_SEM = (D.churn || []).slice();
  // As 12 primeiras semanas da idade mediana são censuradas: propriedade do dado.
  const AGE_SEM = (D.age || []).map((v, i) => (i < 12 ? null : v));
  const churnTodo = gran === 'semana' ? CHURN_SEM : colMedia(CHURN_SEM);
  const ageTodo = gran === 'semana' ? AGE_SEM : colMedia(AGE_SEM);

  const [a, b] = rangeFor(janela, nTodo, eixoTodo, gran);
  const W = eixoTodo.slice(a, b + 1), N = W.length, NW = N;
  const SERIES = serieTodo.map(s => s.slice(a, b + 1));
  const eixo = W.map(iso);

  // ---- filtros ----
  const FIL: Record<string, Set<number>> = {};
  for (const k in filtros) if (filtros[k]?.length) FIL[k] = new Set(filtros[k]);
  const filtrando = Object.keys(FIL).length > 0;
  const passa = (m: ModeloMatriz) => {
    if (!filtrando) return true;
    if (!m.m) return false; // sem metadado sai de recorte
    for (const d in FIL) if (!FIL[d].has(m.d[DIMI[d]])) return false;
    return true;
  };
  const sel: [ModeloMatriz, number][] = MX.modelos.map((m, i) => [m, i] as [ModeloMatriz, number]).filter(([m]) => passa(m));
  const iFree = MX.dic.cobranca.indexOf('Endpoint gratuito');
  const agregar = (chaveFn: (m: ModeloMatriz) => string | null, peso: 'tok' | 'usd' = 'tok') => {
    const out: Series = {}, tot = new Array(NW).fill(0);
    for (const [m, i] of sel) {
      const k = chaveFn(m); if (k == null) continue;
      const s = SERIES[i];
      const fator = peso === 'usd' ? ((m.p && m.d[DIMI.cobranca] !== iFree) ? m.p : 0) : 1;
      if (peso === 'usd' && !fator) continue;
      if (!out[k]) out[k] = new Array(NW).fill(0);
      for (let w = 0; w < NW; w++) { const v = s[w] * fator; out[k][w] += v; tot[w] += v; }
    }
    return { porChave: out, total: tot };
  };
  const paraShare = (ag: { porChave: Series; total: number[] }) => {
    const o: Series = {};
    for (const k in ag.porChave) o[k] = ag.porChave[k].map((v, w) => (ag.total[w] ? +(100 * v / ag.total[w]).toFixed(2) : 0));
    return o;
  };

  const porTok = agregar(() => 't');
  const tot = porTok.total;
  const weekly_total_T = tot.map(v => +(v / 1e6).toFixed(3));
  const ehOther = (m: ModeloMatriz) => m.s === 'other';
  const porVendor = agregar(m => (ehOther(m) ? 'Outros' : rotulo('vendor', m.d[DIMI.vendor])));
  const shV = paraShare(porVendor);
  const ult = NW - 1;
  const rank = Object.keys(shV).filter(k => k !== 'Outros').sort((x, y) => shV[y][ult] - shV[x][ult]);
  const top8 = rank.slice(0, 8);
  const vendor_share: Series = {}; top8.forEach(k => (vendor_share[k] = shV[k]));
  // Período sem volume no recorte fica em zero, e não em 100% de Outros.
  vendor_share['Outros'] = tot.map((t, w) => (t ? +Math.max(0, 100 - top8.reduce((s, k) => s + shV[k][w], 0)).toFixed(2) : 0));

  const origin_share = paraShare(agregar(m => rotulo('origin', m.d[DIMI.origin])));
  const weights_share = paraShare(agregar(m => rotulo('pesos', m.d[DIMI.pesos])));
  const cobranca_share = paraShare(agregar(m => rotulo('cobranca', m.d[DIMI.cobranca])));
  const free_share = cobranca_share['Endpoint gratuito'] || new Array(NW).fill(0);
  // Seção 05: a mesma agregação, por dimensão de carga. Filtrável, ao contrário da v1.
  const faixa_ctx_share = paraShare(agregar(m => rotulo('faixa_ctx', m.d[DIMI.faixa_ctx])));
  const multimodal_share = paraShare(agregar(m => rotulo('multimodal', m.d[DIMI.multimodal])));
  const raciocinio_share = paraShare(agregar(m => rotulo('raciocinio', m.d[DIMI.raciocinio])));
  const faixa_preco_share = paraShare(agregar(m => rotulo('faixa_preco', m.d[DIMI.faixa_preco])));

  // Concentração: other fora do ranking, mas no denominador do top 5. HHI só nomeados.
  const semOther = sel.filter(([m]) => !ehOther(m));
  const top5: Serie = [], hhi: Serie = [], top5_modelos: { s: string; share: number }[][] = [];
  for (let w = 0; w < NW; w++) {
    const vs = semOther.map(([, i]) => SERIES[i][w]).filter(v => v > 0).sort((x, y) => y - x);
    const sNom = vs.reduce((x, y) => x + y, 0), sTot = tot[w];
    top5.push(sTot ? +(100 * vs.slice(0, 5).reduce((x, y) => x + y, 0) / sTot).toFixed(2) : 0);
    hhi.push(sNom ? Math.round(vs.reduce((acc, v) => acc + Math.pow(100 * v / sNom, 2), 0)) : 0);
    const linhas = semOther.map(([m, i]) => ({ s: m.s, v: SERIES[i][w] })).filter(r => r.v > 0).sort((x, y) => y.v - x.v).slice(0, 5);
    const den = tot[w] || 1;
    top5_modelos.push(linhas.map(r => ({ s: r.s, share: +(100 * r.v / den).toFixed(2) })));
  }

  // Grandes laboratórios: share, concorrentes e famílias (abas da seção 09).
  const lab_share: Series = {}, comp_share: Record<string, Series> = {}, familias_abs: Record<string, Series> = {}, lab_modelos: Record<string, Series> = {};
  for (const g of FAMILIAS) {
    lab_share[g.lab] = shV[g.lab] || new Array(NW).fill(0);
    const comp: Series = {};
    [g.lab, ...rank.filter(k => k !== g.lab).slice(0, 8)].forEach(k => { if (shV[k]) comp[k] = shV[k]; });
    comp_share[g.lab] = comp;
    const iLab = MX.dic.vendor.indexOf(g.lab);
    const fam: Series = {}; const mods: Series = {};
    for (const [m, i] of sel) {
      if (m.d[DIMI.vendor] !== iLab) continue;
      const s = SERIES[i], f = familiaDe(g, m.s);
      if (!fam[f]) fam[f] = new Array(NW).fill(0);
      for (let w = 0; w < NW; w++) fam[f][w] += s[w] / 1e6;
      mods[m.s] = s.map(v => +(v / 1e6).toFixed(3));
    }
    const ordem = [...g.familias.map(f => f.nome), OUTROS_FAMILIA[g.lab] ?? 'Outros'];
    const out: Series = {};
    ordem.forEach(f => { if (fam[f] && (d3.max(fam[f]) ?? 0) > 0) out[f] = fam[f].map(v => +v.toFixed(3)); });
    familias_abs[g.lab] = out; lab_modelos[g.lab] = mods;
  }

  // Leaderboard do último período e comparação com 12 semanas (3 meses) antes.
  const linhas = sel.filter(([m]) => !ehOther(m)).map(([m, i]) => ({
    model: m.s, T: SERIES[i][ult] / 1e6, vendor: rotulo('vendor', m.d[DIMI.vendor]),
    origin: rotulo('origin', m.d[DIMI.origin]), weights: rotulo('pesos', m.d[DIMI.pesos]), share: 0,
  })).filter(r => r.T > 0).sort((x, y) => y.T - x.T);
  const somaT = linhas.reduce((s, r) => s + r.T, 0) || 1;
  linhas.forEach(r => { r.share = +(100 * r.T / somaT).toFixed(2); r.T = +r.T.toFixed(2); });
  const doze = Math.max(0, ult - (gran === 'semana' ? 12 : 3));
  const anoAtras = Math.max(0, ult - (gran === 'semana' ? 52 : 12));
  const quadro = (w: number) => sel.filter(([m]) => !ehOther(m)).map(([m, i]) => ({ model: m.s, T: SERIES[i][w] }))
    .filter(r => r.T > 0).sort((x, y) => y.T - x.T).slice(0, 15);
  const boards = { last: linhas.slice(0, 15), prev12: quadro(doze), yearago: quadro(anoAtras) };

  const vendor_abs: Series = {};
  for (const k in porVendor.porChave) vendor_abs[k] = porVendor.porChave[k].map(v => +(v / 1e6).toFixed(3));

  // ---- dinheiro estimado: piso tudo prompt, teto tudo completion, mistura declarada ----
  const precoDe = (m: ModeloMatriz) => {
    if (!m.p || m.d[DIMI.cobranca] === iFree) return null;
    return { mix: m.p, piso: m.pp != null ? m.pp : m.p, teto: m.pc != null ? m.pc : m.p };
  };
  const gastoLab: Series = {}, gastoTot = new Array(NW).fill(0), piso = new Array(NW).fill(0), teto = new Array(NW).fill(0);
  for (const [m, i] of sel) {
    if (ehOther(m)) continue;
    const pr = precoDe(m); if (!pr) continue;
    const k = rotulo('vendor', m.d[DIMI.vendor]), s = SERIES[i];
    if (!gastoLab[k]) gastoLab[k] = new Array(NW).fill(0);
    for (let w = 0; w < NW; w++) { const u = s[w] * pr.mix; gastoLab[k][w] += u; gastoTot[w] += u; piso[w] += s[w] * pr.piso; teto[w] += s[w] * pr.teto; }
  }
  const spend_total_musd = gastoTot.map(v => +(v / 1e6).toFixed(2));
  const spend_band = { piso: piso.map(v => +(v / 1e6).toFixed(2)), teto: teto.map(v => +(v / 1e6).toFixed(2)) };
  const shG: Series = {};
  for (const k in gastoLab) shG[k] = gastoLab[k].map((v, w) => (gastoTot[w] ? +(100 * v / gastoTot[w]).toFixed(2) : 0));
  const rankG = Object.keys(shG).sort((x, y) => shG[y][ult] - shG[x][ult]).slice(0, 8);
  const spend_share: Series = {}; rankG.forEach(k => (spend_share[k] = shG[k]));
  spend_share['Outros'] = gastoTot.map((g, w) => (g ? +Math.max(0, 100 - rankG.reduce((s, k) => s + shG[k][w], 0)).toFixed(2) : 0));
  const preco_efetivo = gastoTot.map((g, w) => (tot[w] ? +(g / tot[w]).toFixed(3) : 0));

  const vd: Record<string, { tok: number; usd: number }> = {};
  for (const [m, i] of sel) {
    if (ehOther(m)) continue;
    const k = rotulo('vendor', m.d[DIMI.vendor]);
    vd[k] = vd[k] || { tok: 0, usd: 0 };
    vd[k].tok += SERIES[i][ult];
    const pr = precoDe(m); if (pr) vd[k].usd += SERIES[i][ult] * pr.mix;
  }
  const somaTok = Object.values(vd).reduce((s, o) => s + o.tok, 0) || 1;
  const somaUsd = Object.values(vd).reduce((s, o) => s + o.usd, 0) || 1;
  const volume_vs_dinheiro = Object.entries(vd).filter(([, o]) => o.tok > 0).map(([lab, o]) => ({
    lab, share_tokens: +(100 * o.tok / somaTok).toFixed(2), share_gasto: +(100 * o.usd / somaUsd).toFixed(2),
    razao: o.tok ? +((o.usd / somaUsd) / (o.tok / somaTok)).toFixed(2) : null,
  })).sort((x, y) => y.share_tokens - x.share_tokens).slice(0, 12);

  const qualidade = sel.filter(([m]) => !ehOther(m)).map(([m, i]) => ({
    slug: m.s, nome: m.n, aa: m.q, elo: m.e, preco: m.p, ctx: m.c, lanc: m.l,
    T: +(SERIES[i][ult] / 1e6).toFixed(3), share: +(100 * SERIES[i][ult] / (tot[ult] || 1)).toFixed(3),
    origin: rotulo('origin', m.d[DIMI.origin]), pesos: rotulo('pesos', m.d[DIMI.pesos]),
  })).filter(r => r.T > 0).sort((x, y) => y.share - x.share);

  // ---- mapa da temporada: percentis, não valores ----
  const HOJE = dataDe(MX.semanas[MX.semanas.length - 1]);
  const perfilLabs = (indice: number) => {
    const L: Record<string, any> = {};
    for (const [m, i] of sel) {
      if (ehOther(m)) continue;
      const k = rotulo('vendor', m.d[DIMI.vendor]);
      const tk = SERIES[i][indice] || 0;
      if (!L[k]) L[k] = { lab: k, tokens: 0, gasto: 0, ctx: 0, multi: 0, rac: 0, ampl: 0, cad: 0, aa: null, origem: {}, modelos: 0 };
      const o = L[k]; o.modelos++; o.tokens += tk;
      const pr = precoDe(m); if (pr) o.gasto += tk * pr.mix;
      if (tk > 0) {
        o.ampl++; o.ctx = Math.max(o.ctx, m.c || 0);
        if (rotulo('multimodal', m.d[DIMI.multimodal]) === 'Multimodal') o.multi++;
        if (rotulo('raciocinio', m.d[DIMI.raciocinio]) === 'Com raciocínio') o.rac++;
        if (m.q != null) o.aa = Math.max(o.aa ?? 0, m.q);
        const org = rotulo('origin', m.d[DIMI.origin]); o.origem[org] = (o.origem[org] || 0) + tk;
        if (m.l) { const dias = (+HOJE - +dataDe(m.l)) / 864e5; if (dias <= 180) o.cad++; }
      }
    }
    return Object.values(L).filter((o: any) => o.tokens > 0).map((o: any) => ({
      ...o, multi_p: o.ampl ? o.multi / o.ampl : 0, rac_p: o.ampl ? o.rac / o.ampl : 0,
      origem: (Object.entries(o.origem) as [string, number][]).sort((x, y) => y[1] - x[1])[0][0],
    })) as PerfilLab[];
  };
  const percentis = (arr: any[], campo: string) => {
    const vals = arr.map(o => o[campo] ?? 0), ord = [...vals].sort((x, y) => x - y);
    return vals.map(v => { const menores = ord.filter(x => x < v).length, iguais = ord.filter(x => x === v).length; return 100 * (menores + iguais / 2) / ord.length; });
  };
  const comporta = (perfil: PerfilLab[], anterior: PerfilLab[] | null, modo: 'recursos' | 'indice') => {
    const sT = perfil.reduce((s, o) => s + o.tokens, 0) || 1, sG = perfil.reduce((s, o) => s + o.gasto, 0) || 1;
    const antMap: Record<string, PerfilLab> = {}; (anterior || []).forEach(o => (antMap[o.lab] = o));
    const sTa = (anterior || []).reduce((s, o) => s + o.tokens, 0) || 1;
    perfil.forEach(o => { o.share = 100 * o.tokens / sT; o.shareG = 100 * o.gasto / sG; const an = antMap[o.lab]; o.cresc = o.share - (an ? 100 * an.tokens / sTa : 0); });
    const P: Record<string, number[]> = {};
    ['share', 'shareG', 'cresc', 'ctx', 'multi_p', 'rac_p', 'ampl', 'cad'].forEach(c => (P[c] = percentis(perfil, c)));
    const wT = pesos.tracao, sTw = wT.share + wT.gasto + wT.cresc || 1;
    const wC = pesos.cap, sCw = wC.ctx + wC.multi + wC.rac + wC.ampl + wC.cad || 1;
    perfil.forEach((o, i) => {
      o.pct = { share: P.share[i], gasto: P.shareG[i], cresc: P.cresc[i], ctx: P.ctx[i], multi: P.multi_p[i], rac: P.rac_p[i], ampl: P.ampl[i], cad: P.cad[i] };
      o.y = (wT.share * P.share[i] + wT.gasto * P.shareG[i] + wT.cresc * P.cresc[i]) / sTw;
      o.xRec = (wC.ctx * P.ctx[i] + wC.multi * P.multi_p[i] + wC.rac * P.rac_p[i] + wC.ampl * P.ampl[i] + wC.cad * P.cad[i]) / sCw;
    });
    const comAA = perfil.filter(o => o.aa != null), pAA = percentis(comAA, 'aa');
    comAA.forEach((o, i) => (o.xAA = pAA[i]));
    perfil.forEach(o => (o.x = modo === 'indice' ? o.xAA : o.xRec));
    return perfil;
  };
  const atras = Math.max(0, ult - (gran === 'semana' ? 12 : 3));
  const perfilAgora = comporta(perfilLabs(ult), perfilLabs(atras), 'recursos');
  const antesRaw = comporta(perfilLabs(atras), null, 'recursos');
  const antes: Record<string, { x: number; xAA?: number; y: number }> = {};
  antesRaw.forEach(o => (antes[o.lab] = { x: o.xRec, xAA: o.xAA, y: o.y }));
  const mapa = { labs: perfilAgora, antes, periodos_atras: ult - atras, com_indice: perfilAgora.filter(o => o.aa != null).length, total: perfilAgora.length };

  // ---- o que mudou nas últimas 4 semanas (ou 1 mês) ----
  const passo4 = gran === 'semana' ? 4 : 1;
  const ant = Math.max(0, ult - passo4);
  const topN = (w: number, n: number) => sel.filter(([m]) => !ehOther(m)).map(([m, i]) => ({ s: m.s, v: SERIES[i][w] }))
    .filter(r => r.v > 0).sort((x, y) => y.v - x.v).slice(0, n).map(r => r.s);
  const t10a = topN(ant, 10), t10b = topN(ult, 10);
  const totAnt = sel.reduce((s, [, i]) => s + SERIES[i][ant], 0) || 1;
  const varia: Variacao[] = sel.filter(([m]) => !ehOther(m)).map(([m, i]) => {
    const x = 100 * SERIES[i][ant] / totAnt, y = 100 * SERIES[i][ult] / (tot[ult] || 1);
    return { s: m.s, de: +x.toFixed(2), para: +y.toFixed(2), delta: +(y - x).toFixed(2), origin: rotulo('origin', m.d[DIMI.origin]) };
  }).filter(r => Math.abs(r.delta) >= 0.05);
  const estreantes = sel.filter(([, i]) => {
    const s = SERIES[i]; if (!s[ult]) return false;
    for (let w = 0; w <= ant; w++) if (s[w] > 0) return false; return true;
  }).map(([m, i]) => ({ s: m.s, share: +(100 * SERIES[i][ult] / (tot[ult] || 1)).toFixed(2), origin: rotulo('origin', m.d[DIMI.origin]), lanc: m.l }))
    .sort((x, y) => y.share - x.share);
  const mudancas = {
    semana: eixo[ult], comparada: eixo[ant], distancia: ult - ant,
    entraram: t10b.filter(s => !t10a.includes(s)), sairam: t10a.filter(s => !t10b.includes(s)),
    subiram: varia.slice().sort((x, y) => y.delta - x.delta).slice(0, 6),
    cairam: varia.slice().sort((x, y) => x.delta - y.delta).slice(0, 6),
    estreantes: estreantes.slice(0, 8), n_estreantes: estreantes.length,
  };

  // ---- sinais: achados por regra e extrapolação condicional ----
  const inclin = (s: (number | null)[], n: number) => {
    const ini = Math.max(0, (s || []).length - n);
    const v = (s || []).slice(ini).filter((x): x is number => x != null && isFinite(x));
    if (v.length < 3) return null;
    const xm = (v.length - 1) / 2, ym = d3.mean(v)!;
    let num = 0, den = 0; v.forEach((y, i) => { num += (i - xm) * (y - ym); den += (i - xm) * (i - xm); });
    return den ? num / den : null;
  };
  const LOOK = Math.max(4, Math.min(26, Math.round(N / 3)));
  const HORIZ = Math.max(2, Math.min(gran === 'semana' ? 13 : 3, Math.round(N / 4)));
  const achados: Achado[] = [];
  const per1 = gran === 'mes' ? 'mês' : 'semana', perN = gran === 'mes' ? 'meses' : 'semanas';
  const jan4 = Math.min(4, ult);
  const b1 = (v: number) => v.toFixed(1).replace('.', ',');
  if (ult >= 6) {
    let melhor: any = null;
    for (const [m, i] of sel) {
      if (ehOther(m)) continue;
      const sh = SERIES[i].map((v, w) => (tot[w] ? 100 * v / tot[w] : 0));
      if (sh[ult] < 0.5) continue;
      const d: number[] = []; for (let w = 1; w <= ult; w++) d.push(sh[w] - sh[w - 1]);
      const dp = d3.deviation(d) || 0, recente = sh[ult] - sh[ult - jan4];
      if (dp <= 0) continue;
      const z = recente / (dp * Math.sqrt(jan4));
      if (!melhor || z > melhor.z) melhor = { s: m.s, z, recente, agora: sh[ult] };
    }
    if (melhor && melhor.z >= 2)
      achados.push({ t: 'Aceleração fora do padrão', v: `+${b1(melhor.recente)}pp`, slug: melhor.s,
        p: `${melhor.s} subiu ${b1(melhor.recente)} pontos em ${jan4} ${jan4 === 1 ? per1 : perN}, ${b1(melhor.z)} desvios acima da própria oscilação típica. Chegou a ${fmtP(melhor.agora)} do volume.` });
  }
  {
    const precos = sel.filter(([m]) => !ehOther(m) && m.p).map(([m]) => m.p as number);
    const medP = precos.length ? d3.median(precos)! : null;
    if (medP) {
      let melhor: any = null;
      for (const [m, i] of sel) {
        if (ehOther(m) || !m.p || m.p <= medP) continue;
        const s = SERIES[i], den0 = tot[ult - jan4] || 1, den1 = tot[ult] || 1;
        const d = 100 * s[ult] / den1 - 100 * s[ult - jan4] / den0;
        if (d <= 0.2) continue;
        if (!melhor || d > melhor.d) melhor = { s: m.s, d, preco: m.p, mult: m.p / medP };
      }
      if (melhor) achados.push({ t: 'Ganhou share sendo mais caro', v: `${b1(melhor.mult)}× a mediana`, slug: melhor.s,
        p: `${melhor.s} custa ${fmtUSD(melhor.preco)} por 1M, ${b1(melhor.mult)} vezes a mediana do mercado, e mesmo assim ganhou ${b1(melhor.d)} pontos de share em ${jan4} ${jan4 === 1 ? per1 : perN}. Contraria a força dominante do dataset, que é preço.` });
    }
  }
  {
    const t10 = sel.filter(([m]) => !ehOther(m)).map(([m, i]) => ({ m, v: SERIES[i][ult] })).filter(r => r.v > 0).sort((x, y) => y.v - x.v).slice(0, 10);
    const idades = t10.filter(r => r.m.l).map(r => (+HOJE - +dataDe(r.m.l!)) / 6048e5);
    if (idades.length >= 4) {
      const med = d3.median(idades)!;
      const velho = t10.filter(r => r.m.l).map(r => ({ s: r.m.s, sem: (+HOJE - +dataDe(r.m.l!)) / 6048e5 })).sort((x, y) => y.sem - x.sem)[0];
      if (velho && velho.sem >= med * 2)
        achados.push({ t: 'Resistindo à temporada', v: `${Math.round(velho.sem)} semanas`, slug: velho.s,
          p: `${velho.s} foi lançado há ${Math.round(velho.sem)} semanas e continua no top 10, ${b1(velho.sem / med)} vezes a idade mediana do topo. A tese diz que isso é raro, e é exatamente por isso que vale olhar o que ele faz de diferente.` });
    }
  }
  {
    const curta = inclin(hhi, Math.min(LOOK, N)), longa = inclin(hhi, N);
    if (curta != null && longa != null && Math.sign(curta) !== Math.sign(longa) && Math.abs(curta) >= 8)
      achados.push({ t: curta > 0 ? 'O mercado voltou a concentrar' : 'A concentração voltou a cair', v: `HHI ${curta > 0 ? '+' : ''}${Math.round(curta)}/${per1}`,
        p: `O HHI vinha ${longa < 0 ? 'caindo' : 'subindo'} ao longo da janela e inverteu: nas últimas ${Math.min(LOOK, N)} ${perN} ele ${curta > 0 ? 'sobe' : 'cai'} ${Math.abs(Math.round(curta))} pontos por ${per1}. Reversão de concentração costuma anteceder a chegada de um modelo que domina, ou a saída de um que dominava.` });
  }
  {
    const cn = origin_share['China'] || [], ow = weights_share['Open-weights'] || [];
    if (cn.length === N && ow.length === N && ult >= 8) {
      const g0 = Math.abs(ow[ult - Math.min(12, ult)] - cn[ult - Math.min(12, ult)]), g1 = Math.abs(ow[ult] - cn[ult]);
      if (g1 - g0 >= 4)
        achados.push({ t: 'Pesos abertos descolando da China', v: `${b1(g1)}pp de distância`,
          p: `As duas curvas costumam andar juntas, porque a maioria dos pesos abertos relevantes é chinesa. A distância entre elas passou de ${b1(g0)} para ${b1(g1)} pontos. Ou apareceu peso aberto fora da China, ou lab chinês fechando modelo.` });
    }
  }
  const projs: Projecao[] = [];
  const proj = (rot: string, serie: number[] | undefined, fmt: (v: number) => string, pisoL: number | null, tetoL: number | null, unidTaxa?: 'pp') => {
    const s = serie || []; if (s.length < 4) return;
    const m = inclin(s, Math.min(LOOK, N)); const atual = s[s.length - 1];
    const minimo = unidTaxa === 'pp' ? 0.05 : 0.005;
    if (m == null || !isFinite(atual) || Math.abs(m) < minimo) return;
    const bruto = atual + m * HORIZ, MARGEM = HORIZ * 1.5;
    let rompe: { lim: string; n: number } | null = null, n: number;
    if (pisoL != null && m < 0 && (n = Math.ceil((pisoL - atual) / m)) <= MARGEM) rompe = { lim: fmt(pisoL), n };
    if (tetoL != null && m > 0 && (n = Math.ceil((tetoL - atual) / m)) <= MARGEM) rompe = { lim: fmt(tetoL), n };
    projs.push({ rot, atual: fmt(atual), alvo: rompe ? null : fmt(bruto), n: HORIZ, dir: m > 0 ? 'sobe' : 'cai',
      taxa: unidTaxa === 'pp' ? Math.abs(m).toFixed(1).replace('.', ',') + 'pp' : fmt(Math.abs(m)), rompe });
  };
  proj('Share de laboratórios chineses', origin_share['China'], fmtP, 0, 100, 'pp');
  proj('Share de pesos abertos', weights_share['Open-weights'], fmtP, 0, 100, 'pp');
  proj('Share da Anthropic', lab_share['anthropic'], fmtP, 0, 100, 'pp');
  proj('Share da OpenAI', lab_share['openai'], fmtP, 0, 100, 'pp');
  proj('Share do Google', lab_share['google'], fmtP, 0, 100, 'pp');
  proj('Tráfego em endpoints gratuitos', free_share, fmtP, 0, 100, 'pp');
  proj('Concentração dos 5 maiores', top5, fmtP, 0, 100, 'pp');
  proj('Preço efetivo do mercado', preco_efetivo, v => 'US$ ' + v.toFixed(2).replace('.', ','), 0, null);

  const totalGeral = MX.modelos.reduce((s, _m, i) => s + SERIES[i][ult], 0);
  return {
    estado, eixo, N, semanasPorBucket: semTodo.slice(a, b + 1), janelaIni: a, janelaTotal: nTodo,
    weekly_total_T, vendor_share, vendor_abs, origin_share, weights_share, cobranca_share, free_share,
    faixa_ctx_share, multimodal_share, raciocinio_share, faixa_preco_share,
    top5, hhi, top5_modelos, lab_share, comp_share, familias_abs, lab_modelos,
    boards, dist_prev: ult - doze,
    spend_total_musd, spend_band, spend_share, preco_efetivo, volume_vs_dinheiro, qualidade, mapa, mudancas,
    sinais: { achados, projs, base: Math.min(LOOK, N), horiz: HORIZ, per1, perN },
    churn: churnTodo.slice(a, b + 1), age: ageTodo.slice(a, b + 1),
    cobertura: { modelos: sel.length, totalModelos: MX.modelos.length, pct: totalGeral ? 100 * tot[ult] / totalGeral : 0, filtrando },
  };
}

/** Os valores de cada dimensão de filtro, na ordem de exibição da v1. */
export const GRUPOS_FILTRO: [string, string][] = [
  ['cobranca', 'Cobrança'], ['pesos', 'Licença dos pesos'], ['origin', 'País-sede do lab'],
  ['faixa_preco', 'Faixa de preço (por 1M tokens)'], ['faixa_ctx', 'Janela de contexto'],
  ['multimodal', 'Modalidade'], ['raciocinio', 'Raciocínio'],
];
export const ORDEM_FILTRO: Record<string, string[]> = {
  faixa_preco: ['Gratuito', 'Até $0,20', '$0,20 a $1', '$1 a $5', 'Acima de $5', 'Não identificado'],
  faixa_ctx: ['Até 32k', '33k a 128k', '129k a 400k', 'Acima de 400k', 'Não identificado'],
  cobranca: ['Pago', 'Endpoint gratuito', 'Modelo gratuito', 'Não identificado'],
};
