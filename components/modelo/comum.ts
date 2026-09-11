/**
 * Peças comuns à seção 01 (finalidade), à seção 06 (apps e sessões) e à página
 * de modelo. Sem 'use client': serve ao servidor e ao cliente.
 */
import { br } from '@/lib/format';

/** Macro categoria de tarefa → slot de cor. Cor segue a entidade, em todo o site. */
export const MACRO_SLOT: Record<string, string> = { code: '--s1', agent: '--s2', data: '--s3', general: '--s4' };
export const slotMacro = (k: string) => MACRO_SLOT[k] ?? '--s0';
export const NOME_MACRO: Record<string, string> = { code: 'Código', agent: 'Agentes', data: 'Dados', general: 'Uso geral' };

/** Share com uma casa, ou duas abaixo de 1%, para não virar "0,0%". */
export const pct = (v: number | null | undefined) =>
  v == null || !isFinite(v) ? '—' : br(v >= 1 || v === 0 ? v.toFixed(1) : v.toFixed(2)) + '%';

/** Custo em dólar: duas casas a partir de 1 dólar, dois algarismos significativos abaixo. */
export const fmtCusto = (v: number | null | undefined) => {
  if (v == null || !isFinite(v)) return '—';
  if (v >= 1) return 'US$ ' + br(v.toFixed(2));
  if (v === 0) return 'US$ 0';
  return 'US$ ' + br(String(+v.toPrecision(2)));
};
/** Idem, sem o prefixo, para eixo e rótulo compacto. */
export const fmtCustoCurto = (v: number) => fmtCusto(v).replace('US$ ', '');

/** Quantidade de requisições: "16,0 mi", "820 mil". */
export const fmtReq = (n: number | null | undefined) => {
  if (n == null || !isFinite(n)) return '—';
  if (n >= 1e6) return br((n / 1e6).toFixed(n >= 1e8 ? 0 : 1)) + ' mi';
  if (n >= 1e3) return Math.round(n / 1e3) + ' mil';
  return String(n);
};
/** Tokens por requisição a partir de trilhões e contagem: "132 mil". */
export const tokPorReq = (T: number, req: number | null) => (req && req > 0 ? (T * 1e12) / req : null);
export const fmtTokReq = (v: number | null) => {
  if (v == null || !isFinite(v)) return '—';
  if (v >= 1e6) return br((v / 1e6).toFixed(1)) + ' mi';
  if (v >= 1e4) return Math.round(v / 1e3) + ' mil';
  if (v >= 1e3) return br((v / 1e3).toFixed(1)) + ' mil';
  return String(Math.round(v));
};
/** Trilhões de tokens com três casas abaixo de 1T, para não virar "0,00T". */
export const fmtTrilhao = (v: number | null | undefined) => {
  if (v == null || !isFinite(v)) return '—';
  if (v >= 10) return br(v.toFixed(0)) + 'T';
  if (v >= 1) return br(v.toFixed(2)) + 'T';
  if (v >= 0.001) return br(v.toFixed(3)) + 'T';
  return v > 0 ? '<0,001T' : '0T';
};
/** Razão "2,6×". */
export const fmtVezes = (r: number | null | undefined) =>
  r == null || !isFinite(r) || r <= 0 ? '—' : br(r >= 10 ? r.toFixed(0) : r.toFixed(1)) + '×';

/** Rótulo em português das avaliações publicadas pela fonte. */
export const NOME_AVALIACAO: Record<string, string> = {
  gpqa_diamond: 'GPQA Diamond',
  tau_bench_verified_airline: 'τ-bench verificado, aviação',
};
export const nomeAvaliacao = (t: string) => NOME_AVALIACAO[t] ?? t.replace(/_/g, ' ');

/** "text+image->text" → "texto e imagem → texto". */
const MODAL: Record<string, string> = { text: 'texto', image: 'imagem', file: 'arquivo', audio: 'áudio', video: 'vídeo' };
export const fmtModalidade = (s: string | null | undefined) => {
  if (!s) return null;
  const [ent, sai] = s.split('->');
  const lista = (x: string) => {
    const p = x.split('+').map(k => MODAL[k] ?? k);
    return p.length > 1 ? p.slice(0, -1).join(', ') + ' e ' + p.at(-1) : p[0];
  };
  return sai ? `${lista(ent)} → ${lista(sai)}` : lista(ent);
};
export const fmtPesos = (p: string) => (p === 'Open-weights' ? 'Pesos abertos' : p === 'Proprietário' ? 'Proprietário' : 'Não identificado');

/** Ordinal masculino: "15º". */
export const ord = (n: number) => `${n}º`;
