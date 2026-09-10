// Estado da pagina, num objeto so, com todas as mutacoes visiveis.
//
// Antes eram 17 variaveis soltas dentro de init(), e nenhum modulo conseguiria
// ler nem escrever nelas sem estar no mesmo arquivo. Modulo ES exporta ligacao
// viva SOMENTE LEITURA para quem importa, entao copiar essas variaveis para
// cada modulo criaria duas versoes da mesma verdade. Um objeto resolve isso, e
// de quebra torna auditavel quem muda o que.
//
// Regra: nenhum modulo escreve aqui fora de um mutador nomeado.
export const ST = {
  /** @type {Date[]}   eixo do tempo ja recortado pela janela */      W: [],
  /** @type {number}   tamanho do eixo apos o recorte */              N: 0,
  /** @type {'semana'|'mes'} */                                       GRAN: 'semana',
  /** @type {string}   chave da janela: all, ytd, 52, 26, 13, 4 */    JANELA: 'all',
  /** @type {number[][]} series por modelo, ja na granularidade */    SERIES: [],
  SEMANAS_ISO: [], MAPA_BUCKET: [], SEMANAS_POR_BUCKET: [],
  range: [0, 0], JANELA_INI: 0, JANELA_TOTAL: 0, NW: 0,
  HBAR_ORDEM: 'valor', TRAJ_VIEW: 'forma', QX: 'aa', MAPA_MODO: 'recursos',
  /** @type {[string|null,string|null]} */                            CMP: [null, null],
};

export const definirJanela = (v) => { ST.JANELA = v; };
export const definirGran = (v) => { ST.GRAN = v; };
export const definirOrdemBarras = (v) => { ST.HBAR_ORDEM = v; };
export const definirTrajetoria = (v) => { ST.TRAJ_VIEW = v; };
export const definirEixoQualidade = (v) => { ST.QX = v; };
export const definirModoMapa = (v) => { ST.MAPA_MODO = v; };
export const definirComparados = (a, b) => { ST.CMP = [a, b]; };
