import type { MetadataRoute } from 'next';
import { agora, modelos, radar } from '@/lib/data';
import { caminho, HTML_LANG, IDIOMAS } from '@/lib/i18n';

const BASE = 'https://modelseason.com';

/**
 * A página inicial, o Radar com cada edição e a página de todo modelo com volume nos últimos 7 dias, em
 * cada idioma, com a alternância hreflang que diz ao buscador qual é a mesma
 * página no outro idioma.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const dia = agora().ultimo_dia;
  const url = (lang: (typeof IDIOMAS)[number], p: string) => BASE + caminho(lang, p);
  const entrada = (p: string, priority: number) => IDIOMAS.map(lang => ({
    url: url(lang, p), lastModified: dia, changeFrequency: 'daily' as const, priority,
    alternates: { languages: Object.fromEntries(IDIOMAS.map(l => [HTML_LANG[l], url(l, p)])) },
  }));
  const paginas = Object.values(modelos().modelos)
    .filter(m => (m.share_7d ?? 0) > 0)
    .sort((a, b) => (b.share_7d ?? 0) - (a.share_7d ?? 0))
    .flatMap(m => entrada('/m/' + m.slug, 0.6));
  const edicoes = radar().edicoes;
  const radarPaginas = edicoes.flatMap(ed => entrada('/radar/' + ed.dia, 0.5).map(e => ({ ...e, lastModified: ed.dia, changeFrequency: 'never' as const })));
  return [...entrada('/', 1), ...entrada('/radar', 0.8), ...radarPaginas, ...paginas];
}
