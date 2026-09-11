/** Título, descrição e alternâncias de idioma para o metadata das páginas. */
import { caminho, HTML_LANG, IDIOMAS, type Lang } from './i18n';

export const TITULO: Record<Lang, string> = {
  pt: 'Model Season · para onde vai o tráfego dos modelos de linguagem',
  en: 'Model Season · where language model traffic goes',
};
export const DESCRICAO: Record<Lang, string> = {
  pt: 'Quem lidera, quem subiu, quem estreou e para que os modelos de linguagem estão sendo usados. Dado diário, histórico desde janeiro de 2025.',
  en: 'Who leads, who is rising, who just debuted and what language models are being used for. Daily data, with history since January 2025.',
};

/** Card social de cada idioma, gerado por pipeline/make_og.py. */
export const OG_IMAGEM: Record<Lang, string> = { pt: '/og.png', en: '/og-en.png' };

/** canonical + hreflang de um caminho sem prefixo ('/' ou '/m/x'). O x-default é o português. */
export const alternancias = (lang: Lang, p: string) => ({
  canonical: caminho(lang, p),
  languages: { ...Object.fromEntries(IDIOMAS.map(l => [HTML_LANG[l], caminho(l, p)])), 'x-default': caminho('pt', p) },
});
