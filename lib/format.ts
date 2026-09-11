/**
 * Formatadores em português. Mesmas regras da v1: vírgula decimal, preço com
 * duas casas acima de 1 dólar, contexto em unidade redonda, nada de "0.00T".
 */
import * as d3 from 'd3';

export const br = (s: string | number) => String(s).replace('.', ',');
export const fmtT = (v: number | null | undefined) => {
  if (v == null || !isFinite(v)) return '—';
  return br(v >= 10 ? d3.format('.0f')(v) + 'T' : v >= 1 ? d3.format('.1f')(v) + 'T' : d3.format('.2f')(v) + 'T');
};
// Zeros finais só são cortados depois da vírgula: fmtNum(30, 0) é "30", não "3".
export const fmtNum = (v: number | null | undefined, c = 1) =>
  v == null || !isFinite(v) ? '—' : br(c > 0 ? (+v).toFixed(c).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '') : (+v).toFixed(0));
export const fmtP = (v: number | null | undefined, casas = 1) =>
  v == null || !isFinite(v) ? '—' : d3.format(`.${casas}f`)(v).replace('.', ',') + '%';
export const fmtPP = (v: number | null | undefined) =>
  v == null || !isFinite(v) ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + br(Math.abs(v).toFixed(1)) + ' pp';
export const fmtUSD = (v: number | null | undefined) => {
  if (v == null || !isFinite(v)) return '—';
  const s = v >= 100 ? d3.format('.0f')(v) : v >= 1 ? v.toFixed(2) : v.toFixed(3).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  return 'US$ ' + br(s);
};
export const fmtUSDm = (v: number | null | undefined) => (v == null || !isFinite(v) ? '—' : 'US$ ' + br(v >= 10 ? v.toFixed(0) : v.toFixed(1)) + ' mi');
export const fmtCtx = (v: number | null | undefined) => {
  if (!v) return '—';
  if (v >= 1e6) return v / 1048576 >= 0.98 && v / 1048576 <= 1.02 ? '1M' : d3.format('.2~f')(v / 1e6).replace('.', ',') + 'M';
  if (v >= 1000) return Math.round(v / 1024) + 'k';
  return String(v);
};
export const fmtVez = (r: number) => (!isFinite(r) || r <= 0 ? null : r >= 10 ? String(Math.round(r)) : r.toFixed(1).replace('.', ','));

const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const dataDe = (s: string) => new Date(s + 'T00:00:00');
/** "08 set 26" */
export const fD = (s: string | Date) => {
  const d = typeof s === 'string' ? dataDe(s) : s;
  return `${String(d.getDate()).padStart(2, '0')} ${MES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
};
/** "set 26" */
export const fMes = (s: string | Date) => {
  const d = typeof s === 'string' ? dataDe(s) : s;
  return `${MES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
};
export const fPer = (s: string, gran: 'semana' | 'mes') => (gran === 'mes' ? fMes(s) : fD(s));
/** "08/09/2026" */
export const fBR = (s: string) => s.split('-').reverse().join('/');

/** Nome curto de um slug: sem laboratório e sem sufixo de data. */
export const curto = (slug: string) => {
  const [base, suf] = slug.split('/').pop()!.split(':');
  const nome = base.replace(/-20\d{6}$/, '').replace(/-20\d{2}-\d{2}-\d{2}$/, '');
  return suf ? `${nome} (${suf})` : nome;
};
/** URL da página de modelo a partir do slug (sufixo de endpoint é somado ao modelo base). */
export const urlModelo = (slug: string) => '/m/' + slug.split(':')[0];
