/**
 * Peças comuns à seção 01 (finalidade), à seção 06 (apps e sessões) e à página
 * de modelo. Sem 'use client': serve ao servidor e ao cliente.
 *
 * Os formatadores que moravam aqui (pct, fmtCusto, fmtReq, fmtTokReq,
 * fmtTrilhao, fmtVezes, ord, nomeAvaliacao, fmtModalidade) passaram para
 * formatadores(lang) em lib/format.ts, e fmtPesos e NOME_MACRO para
 * lib/rotulos.ts. Use useIdioma().f / idioma(lang).f.
 */
export { tokPorReq } from '@/lib/format';

/** Macro categoria de tarefa → slot de cor. Cor segue a entidade, em todo o site. */
export const MACRO_SLOT: Record<string, string> = { code: '--s1', agent: '--s2', data: '--s3', general: '--s4' };
export const slotMacro = (k: string) => MACRO_SLOT[k] ?? '--s0';
