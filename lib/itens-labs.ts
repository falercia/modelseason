/**
 * O que o cartão de cada laboratório em /labs lista: movimento oficial (notas de
 * versão) e notícia de lançamento ou de preço do Radar. Nem todo lançamento sai na
 * nota de versão (o Kimi K3.1 Pro só saiu no blog da Moonshot), então a notícia
 * completa o cartão; a que repete um movimento, ou outra notícia, fica de fora.
 *
 * Módulo puro, sem leitura de arquivo: lib/data.ts passa pautas e movimentos, e
 * tests/labs.test.ts roda as regras direto no Node.
 */
import type { AssuntoPauta, ItemLab, MovimentoLab, NoticiaLab, TipoMovimento } from './tipos';

/** Categorias da pauta que contam como novidade do laboratório. */
export const CATEGORIAS_NOTICIA_LAB = new Set(['lancamento', 'preco']);
/** Peso do tipo na ordem do mesmo dia: o mesmo de pipeline/movimentos.py (TIPOS). */
export const PESO_TIPO: Record<TipoMovimento, number> = { modelo: 5, preco: 4, desativacao: 4, api: 3, app: 2, outro: 0 };
const JANELA_MESMO_ASSUNTO = 7; // dias

const GENERICAS = new Set(('the and for with its new now api apis model models launch launches launched release releases '
  + 'introduces unveils announces debuts arrives arrive gets comes open weights available still without into than more '
  + 'from via cheaper faster price prices lower half same day ships brings adds hugging face '
  // laboratórios e famílias: "Claude Opus 5.5" e "Claude Sonnet 5.5" não são o mesmo lançamento
  + 'anthropic openai google deepseek tencent xiaomi minimax moonshot alibaba zai claude gpt gemini kimi qwen glm mimo hunyuan').split(' '));

const FAMILIAS = new Set('claude gpt gemini kimi qwen glm mimo hunyuan deepseek minimax'.split(' '));
/**
 * Termos do título em inglês (ASCII pela pauta), com versões inteiras: "gpt-6.1", "k3.1",
 * "deepseek-v4.1-flash-1017". Número solto depois de família vira versão: "Gemini 4" → "gemini-4".
 */
const termos = (s: string) => {
  const ws = s.toLowerCase().split(/[^a-z0-9.\-]+/).map(w => w.replace(/^[.\-]+|[.\-]+$/g, '')).filter(Boolean);
  return ws.map((w, i) => (/^\d+$/.test(w) && i > 0 && FAMILIAS.has(ws[i - 1]) ? `${ws[i - 1]}-${w}` : w));
};
/** Versão: tem algarismo e mais alguma coisa além de algarismo ("6.1", "k3", "gpt-6"); "2026" e "40" não contam. */
const versoes = (ws: string[]) => ws.filter(w => /\d/.test(w) && /[a-z.]/.test(w.replace(/\d/g, '')));
const palavras = (ws: string[]) => ws.filter(w => !/\d/.test(w) && w.length >= 3 && !GENERICAS.has(w));
const diaDe = (s: string) => Date.parse(s + 'T00:00:00Z') / 864e5;

/** Versão que já diz o modelo sozinha: tem um pedaço só de letras fora das famílias ("v4.1-flash-1017"). */
const forte = (v: string) => v.split(/[.\-]/).some(p => /^[a-z]{3,}$/.test(p) && !GENERICAS.has(p));

type Titulado = { data: string; titulo: string };
/**
 * Mesmo lançamento: títulos que dividem uma versão ("gpt-6.1") e mais uma palavra
 * própria ("terra"), ou uma versão que já diz o modelo ("deepseek-v4.1-flash-1017"),
 * a até sete dias um do outro. Data só com o mês não compara.
 */
export function mesmoAssunto(a: Titulado, b: Titulado) {
  if (a.data.length < 10 || b.data.length < 10 || Math.abs(diaDe(a.data) - diaDe(b.data)) > JANELA_MESMO_ASSUNTO) return false;
  const A = termos(a.titulo), B = termos(b.titulo);
  const va = new Set(versoes(A)), pa = new Set(palavras(A));
  const comuns = versoes(B).filter(v => va.has(v));
  return comuns.length > 0 && (comuns.some(forte) || palavras(B).some(w => pa.has(w)));
}

type Pauta = { dia: string; assuntos?: AssuntoPauta[] };
/** Uma notícia por laboratório acompanhado citado, sem repetir movimento de modelo ou preço nem notícia mais antiga. */
export function noticiasLabs(pautas: Pauta[], movimentos: MovimentoLab[], vendors: Set<string>): NoticiaLab[] {
  const ms = movimentos.filter(m => m.tipo === 'modelo' || m.tipo === 'preco');
  const todas: NoticiaLab[] = [];
  for (const p of pautas) for (const a of p.assuntos ?? []) {
    if (!CATEGORIAS_NOTICIA_LAB.has(a.categoria)) continue;
    const principal = a.fontes.find(x => !/news\.ycombinator\.com/.test(x.link)) ?? a.fontes[0];
    if (!principal) continue;
    const data = (a.publicado_em ?? p.dia).slice(0, 10);
    for (const lab of a.labs) {
      if (!vendors.has(lab)) continue;
      todas.push({ id: `${p.dia}-${a.id}-${lab}`, lab, tipo: 'noticia', categoria: a.categoria, data, edicao: p.dia,
        veiculo: principal.veiculo, link: principal.link, pt: a.pt, en: a.en });
    }
  }
  todas.sort((a, b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id));
  const out: NoticiaLab[] = [];
  for (const n of todas) {
    const x = { data: n.data, titulo: n.en.titulo };
    if (ms.some(m => m.lab === n.lab && mesmoAssunto(x, { data: m.data, titulo: m.en.titulo }))) continue;
    if (out.some(o => o.lab === n.lab && mesmoAssunto(x, { data: o.data, titulo: o.en.titulo }))) continue;
    out.push(n);
  }
  return out;
}

const peso = (x: ItemLab) => (x.tipo === 'noticia' ? PESO_TIPO.modelo : PESO_TIPO[x.tipo]);
/** Do mais novo para o mais velho; no mesmo dia, modelo e notícia antes de preço, API e app. */
export const ordenarItens = <T extends ItemLab>(xs: T[]): T[] =>
  [...xs].sort((a, b) => b.data.localeCompare(a.data) || peso(b) - peso(a) || a.id.localeCompare(b.id));

/** Índice da semana (início na segunda, "AAAA-MM-DD") que contém o dia; null fora das semanas. */
export function semanaDoDia(semanas: string[], dia: string): number | null {
  if (dia.length < 10 || !semanas.length) return null;
  const d = diaDe(dia);
  for (let i = semanas.length - 1; i >= 0; i--) {
    const s = diaDe(semanas[i]);
    if (d >= s) return d < s + 7 ? i : null;
  }
  return null;
}

/** Dias inteiros entre a data do item e o dia de referência; null para data só com o mês. */
export const diasDesde = (dia: string, ref: string) => (dia.length < 10 ? null : Math.max(0, Math.round(diaDe(ref) - diaDe(dia))));
