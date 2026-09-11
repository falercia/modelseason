/**
 * Conteúdo editorial compilado por scripts/conteudo.mjs a partir de
 * content/graficos/<idioma> e content/indicadores/<idioma>. Importado como
 * JSON: vai no bundle do servidor, sem leitura de disco em tempo de requisição,
 * e só o idioma da página é serializado para o cliente.
 */
import dados from '@/content/conteudo.json';
import type { Lang } from './i18n';

export interface Grafico {
  id: string; titulo: string; subtitulo: string; tipo: string; modos: string[]; indicadores: string[];
  comoLer: string; perguntaQueResponde: string; oQueNaoMostra: string;
}
export interface Indicador { slug: string; titulo: string; oQueE: string; comoECalculado: string; oQueNaoConclui: string }
export interface Conteudo { graficos: Record<string, Grafico>; indicadores: Indicador[] }

export const carregarConteudo = (lang: Lang): Conteudo => (dados as unknown as Record<Lang, Conteudo>)[lang];
