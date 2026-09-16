/**
 * Feed RSS do Radar, um por idioma: /radar/feed.xml e /en/radar/feed.xml.
 * Um item por edição, com os títulos de todas as mudanças do dia.
 */
import { radar } from '@/lib/data';
import { caminho, ehIdioma, HTML_LANG, IDIOMAS, type Lang } from '@/lib/i18n';
import { idioma } from '@/lib/idioma';
import { frase, tituloEdicao } from '@/lib/radar';

export const dynamic = 'force-static';
export const dynamicParams = false;
export const generateStaticParams = () => IDIOMAS.map(lang => ({ lang }));

const BASE = 'https://modelseason.com';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function GET(_: Request, { params }: { params: Promise<{ lang: string }> }) {
  const p = await params;
  const lang: Lang = ehIdioma(p.lang) ? p.lang : 'pt';
  const I = idioma(lang);
  const { t } = I;
  const E = radar().edicoes.slice(0, 60);
  const itens = E.map(ed => {
    const link = BASE + caminho(lang, '/radar/' + ed.dia);
    const corpo = ed.eventos.map(ev => { const F = frase(ev, ed.dia, I); return `<p><b>${esc(F.titulo)}</b>. ${esc(F.texto)}</p>`; }).join('');
    return `<item><title>${esc(tituloEdicao(ed, I))}</title><link>${link}</link><guid isPermaLink="true">${link}</guid>`
      + `<pubDate>${new Date(ed.dia + 'T12:00:00Z').toUTCString()}</pubDate><description>${esc(corpo)}</description></item>`;
  }).join('');
  const self = BASE + caminho(lang, '/radar') + '/feed.xml';
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>`
    + `<title>${esc(t({ pt: 'Model Season · Radar', en: 'Model Season · Radar' }))}</title>`
    + `<link>${BASE + caminho(lang, '/radar')}</link>`
    + `<atom:link href="${self}" rel="self" type="application/rss+xml"/>`
    + `<description>${esc(t({ pt: 'O que mudou nos modelos de linguagem, cruzado com o tráfego real de tokens.', en: 'What changed in language models, matched against real token traffic.' }))}</description>`
    + `<language>${HTML_LANG[lang]}</language>`
    + (E[0] ? `<lastBuildDate>${new Date(E[0].dia + 'T12:00:00Z').toUTCString()}</lastBuildDate>` : '')
    + itens + `</channel></rss>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
