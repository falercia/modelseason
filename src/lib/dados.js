// Leitura do data.json no build. As paginas por modelo sao geradas ESTATICAMENTE
// a partir daqui, entao o numero que aparece nelas e o mesmo do painel: uma
// fonte, um arquivo, nenhuma copia manual.
// Import direto: o empacotador resolve no build e o caminho continua valido
// depois que o modulo e movido para dentro de dist/. Ler com fs a partir de
// import.meta.url quebrava exatamente ai.
import data from '../../public/data.json';

/** @returns {any} */
export function carregar() { return data; }

/** Reconstroi a serie semanal de um modelo a partir da matriz esparsa. */
export function serieDoModelo(matriz, i) {
  const t0 = matriz.t0[i], v = matriz.v[i] || [];
  const n = matriz.semanas.length;
  const s = new Array(n).fill(0);
  for (let k = 0; k < v.length && t0 + k < n; k++) s[t0 + k] = v[k];
  return s;
}

/** Slug de URL: o slug do modelo ja e vendor/nome, e vira caminho direto. */
export const caminhoModelo = (slug) => '/m/' + slug;

export const fmtT = (v) => {
  const s = v >= 10 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v.toFixed(2);
  return s.replace('.', ',') + 'T';
};
export const fmtP = (v) => (v == null ? '—' : v.toFixed(1).replace('.', ',') + '%');
export const fmtUSD = (v) => {
  if (v == null) return '—';
  const s = v >= 100 ? v.toFixed(0) : v >= 1 ? v.toFixed(2)
    : v.toFixed(3).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  return 'US$ ' + s.replace('.', ',');
};
export const fmtCtx = (v) => {
  if (!v) return '—';
  if (v >= 1e6) return (v / 1e6).toFixed(v % 1e6 ? 1 : 0).replace('.', ',') + 'M';
  return Math.round(v / 1000) + 'k';
};
const MES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
export const fD = (iso) => {
  if (!iso) return '—';
  const [a, m, d] = iso.split('-');
  return `${d} ${MES[+m - 1]} ${a.slice(2)}`;
};
