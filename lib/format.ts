/**
 * Formatadores por idioma. formatadores('pt') reproduz exatamente as regras da
 * v1 (vírgula decimal, "US$ 3,00", "08 set 26"), travadas pelo teste
 * tests/format.test.ts contra tests/fixtures/format-pt.json. formatadores('en')
 * aplica as mesmas regras de arredondamento com convenção americana: ponto
 * decimal, "$3.00", "1.2M", "Sep 8, 2026". Data numérica nunca aparece em
 * inglês, porque 08/09 é agosto num lado do Atlântico e setembro no outro.
 *
 * Componente cliente pega o conjunto do idioma com useIdioma().f; componente de
 * servidor, com idioma(lang).f. Não há formatador solto: todo texto formatado
 * passa pelo idioma da página.
 */
import * as d3 from 'd3';
import type { Lang } from './i18n.ts';

const MESES: Record<Lang, string[]> = {
  pt: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};
const MODAL: Record<Lang, Record<string, string>> = {
  pt: { text: 'texto', image: 'imagem', file: 'arquivo', audio: 'áudio', video: 'vídeo' },
  en: { text: 'text', image: 'image', file: 'file', audio: 'audio', video: 'video' },
};
const AVALIACAO: Record<Lang, Record<string, string>> = {
  pt: { gpqa_diamond: 'GPQA Diamond', tau_bench_verified_airline: 'τ-bench verificado, aviação' },
  en: { gpqa_diamond: 'GPQA Diamond', tau_bench_verified_airline: 'τ-bench verified, airline' },
};

export const dataDe = (s: string) => new Date(s + 'T00:00:00');
const ok = (v: number | null | undefined): v is number => v != null && isFinite(v);
/** Corta zeros finais só depois do ponto: 30 continua 30. */
const semZeros = (s: string) => s.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');

/** Nome curto de um slug: sem laboratório e sem sufixo de data. Igual nos dois idiomas. */
export const curto = (slug: string) => {
  const [base, suf] = slug.split('/').pop()!.split(':');
  const nome = base.replace(/-20\d{6}$/, '').replace(/-20\d{2}-\d{2}-\d{2}$/, '');
  return suf ? `${nome} (${suf})` : nome;
};

export function formatadores(lang: Lang) {
  const pt = lang === 'pt';
  const MES = MESES[lang];
  /** Troca o primeiro ponto decimal por vírgula em português; em inglês não mexe. */
  const dec = (s: string | number) => (pt ? String(s).replace('.', ',') : String(s));
  const USD = pt ? 'US$ ' : '$';
  const MI = pt ? ' mi' : 'M', MIL = pt ? ' mil' : 'K';

  const fmtT = (v: number | null | undefined) => {
    if (!ok(v)) return '—';
    return dec(v >= 10 ? d3.format('.0f')(v) + 'T' : v >= 1 ? d3.format('.1f')(v) + 'T' : d3.format('.2f')(v) + 'T');
  };
  const fmtNum = (v: number | null | undefined, c = 1) =>
    !ok(v) ? '—' : dec(c > 0 ? semZeros((+v).toFixed(c)) : (+v).toFixed(0));
  const fmtP = (v: number | null | undefined, casas = 1) => (!ok(v) ? '—' : dec(d3.format(`.${casas}f`)(v)) + '%');
  const fmtPP = (v: number | null | undefined) =>
    !ok(v) ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + dec(Math.abs(v).toFixed(1)) + ' pp';
  const fmtUSD = (v: number | null | undefined) => {
    if (!ok(v)) return '—';
    const s = v >= 100 ? d3.format('.0f')(v) : v >= 1 ? v.toFixed(2) : semZeros(v.toFixed(3));
    return USD + dec(s);
  };
  /** Milhões de dólares: "US$ 1,2 mi" / "$1.2M". */
  const fmtUSDm = (v: number | null | undefined) => (!ok(v) ? '—' : USD + dec(v >= 10 ? v.toFixed(0) : v.toFixed(1)) + MI);
  const fmtCtx = (v: number | null | undefined) => {
    if (!v) return '—';
    if (v >= 1e6) return v / 1048576 >= 0.98 && v / 1048576 <= 1.02 ? '1M' : dec(d3.format('.2~f')(v / 1e6)) + 'M';
    if (v >= 1000) return Math.round(v / 1024) + 'k';
    return String(v);
  };
  /** Razão sem o sinal de vezes, para frases: "2,6" / "2.6". */
  const fmtVez = (r: number) => (!isFinite(r) || r <= 0 ? null : r >= 10 ? String(Math.round(r)) : dec(r.toFixed(1)));

  // ---- datas
  /** "08 set 26" / "Sep 8, 2026". */
  const fD = (s: string | Date) => {
    const d = typeof s === 'string' ? dataDe(s) : s;
    return pt
      ? `${String(d.getDate()).padStart(2, '0')} ${MES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`
      : `${MES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  };
  /** "set 26" / "Sep 2026". */
  const fMes = (s: string | Date) => {
    const d = typeof s === 'string' ? dataDe(s) : s;
    return pt ? `${MES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}` : `${MES[d.getMonth()]} ${d.getFullYear()}`;
  };
  const fPer = (s: string, gran: 'semana' | 'mes') => (gran === 'mes' ? fMes(s) : fD(s));
  /** Data completa: "08/09/2026" / "Sep 8, 2026". */
  const fBR = (s: string) => (pt ? s.split('-').reverse().join('/') : fD(s));
  /** Marca de eixo com dia: "08 set" / "Sep 8". */
  const marcaDia = (d: Date) => (pt ? `${String(d.getDate()).padStart(2, '0')} ${MES[d.getMonth()]}` : `${MES[d.getMonth()]} ${d.getDate()}`);
  /** Marca de eixo com mês, e o ano quando pedido: "set 26" / "Sep '26". */
  const marcaMes = (d: Date, comAno: boolean) =>
    MES[d.getMonth()] + (comAno ? (pt ? ' ' : " '") + String(d.getFullYear()).slice(2) : '');

  // ---- peças da página de modelo e das seções 01, 06 e 08
  /** Share com uma casa, ou duas abaixo de 1%, para não virar "0,0%". */
  const pct = (v: number | null | undefined) => (!ok(v) ? '—' : dec(v >= 1 || v === 0 ? v.toFixed(1) : v.toFixed(2)) + '%');
  /** Custo em dólar: duas casas a partir de 1 dólar, dois algarismos significativos abaixo. */
  const fmtCusto = (v: number | null | undefined) => {
    if (!ok(v)) return '—';
    if (v >= 1) return USD + dec(v.toFixed(2));
    if (v === 0) return USD + '0';
    return USD + dec(String(+v.toPrecision(2)));
  };
  const fmtCustoCurto = (v: number) => fmtCusto(v).replace(USD, '');
  /** Requisições: "16,0 mi", "820 mil" / "16.0M", "820K". */
  const fmtReq = (n: number | null | undefined) => {
    if (!ok(n)) return '—';
    if (n >= 1e6) return dec((n / 1e6).toFixed(n >= 1e8 ? 0 : 1)) + MI;
    if (n >= 1e3) return Math.round(n / 1e3) + MIL;
    return String(n);
  };
  const fmtTokReq = (v: number | null) => {
    if (!ok(v)) return '—';
    if (v >= 1e6) return dec((v / 1e6).toFixed(1)) + MI;
    if (v >= 1e4) return Math.round(v / 1e3) + MIL;
    if (v >= 1e3) return dec((v / 1e3).toFixed(1)) + MIL;
    return String(Math.round(v));
  };
  /** Trilhões com três casas abaixo de 1T, para não virar "0,00T". */
  const fmtTrilhao = (v: number | null | undefined) => {
    if (!ok(v)) return '—';
    if (v >= 10) return dec(v.toFixed(0)) + 'T';
    if (v >= 1) return dec(v.toFixed(2)) + 'T';
    if (v >= 0.001) return dec(v.toFixed(3)) + 'T';
    return v > 0 ? '<' + dec('0.001') + 'T' : '0T';
  };
  /** Razão "2,6×" / "2.6×". */
  const fmtVezes = (r: number | null | undefined) => (!ok(r) || r <= 0 ? '—' : dec(r >= 10 ? r.toFixed(0) : r.toFixed(1)) + '×');
  /** Ordinal: "15º" / "15th". */
  const ord = (n: number) => {
    if (pt) return `${n}º`;
    const m100 = n % 100, m10 = n % 10;
    return n + (m100 >= 11 && m100 <= 13 ? 'th' : m10 === 1 ? 'st' : m10 === 2 ? 'nd' : m10 === 3 ? 'rd' : 'th');
  };
  const nomeAvaliacao = (t: string) => AVALIACAO[lang][t] ?? t.replace(/_/g, ' ');
  /** "text+image->text" → "texto e imagem → texto" / "text and image → text". */
  const fmtModalidade = (s: string | null | undefined) => {
    if (!s) return null;
    const [ent, sai] = s.split('->');
    const lista = (x: string) => {
      const p = x.split('+').map(k => MODAL[lang][k] ?? k);
      return p.length > 1 ? p.slice(0, -1).join(', ') + (pt ? ' e ' : ' and ') + p.at(-1) : p[0];
    };
    return sai ? `${lista(ent)} → ${lista(sai)}` : lista(ent);
  };
  /** Lista com vírgula e conjunção final: "a, b e c" / "a, b and c" (sem vírgula de Oxford). */
  const lista = (itens: string[]) =>
    itens.length > 1 ? itens.slice(0, -1).join(', ') + (pt ? ' e ' : ' and ') + itens.at(-1) : (itens[0] ?? '');

  return {
    lang, dec, br: dec, fmtT, fmtNum, fmtP, fmtPP, fmtUSD, fmtUSDm, fmtCtx, fmtVez,
    fD, fMes, fPer, fBR, marcaDia, marcaMes, mes: (i: number) => MES[i], dataDe, curto,
    pct, fmtCusto, fmtCustoCurto, fmtReq, fmtTokReq, fmtTrilhao, fmtVezes, ord, nomeAvaliacao, fmtModalidade, lista,
  };
}
export type Fmt = ReturnType<typeof formatadores>;

/** Tokens por requisição a partir de trilhões e contagem. Número, não texto: igual nos dois idiomas. */
export const tokPorReq = (T: number, req: number | null) => (req && req > 0 ? (T * 1e12) / req : null);
