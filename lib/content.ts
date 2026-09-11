/**
 * Conteúdo editorial compilado por scripts/conteudo.mjs a partir de
 * content/graficos e content/indicadores. Importado como JSON: vai no bundle,
 * sem leitura de disco em tempo de requisição.
 */
import dados from '@/content/conteudo.json';

export interface Grafico {
  id: string; titulo: string; subtitulo: string; tipo: string; modos: string[]; indicadores: string[];
  comoLer: string; perguntaQueResponde: string; oQueNaoMostra: string;
}
export interface Indicador { slug: string; titulo: string; oQueE: string; comoECalculado: string; oQueNaoConclui: string }
export interface Conteudo { graficos: Record<string, Grafico>; indicadores: Indicador[] }

export const carregarConteudo = (): Conteudo => dados as Conteudo;
