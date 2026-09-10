// Sitemap gerado no build, com a home e as 403 paginas por modelo. Antes era um
// arquivo estatico com uma URL so, escrito na mao, que envelhecia calado.
import { carregar } from '../lib/dados.js';

export function GET() {
  const d = carregar();
  const hoje = d.as_of;
  const urls = [
    { loc: 'https://modelseason.com/', prio: '1.0', freq: 'daily' },
    ...d.matriz.modelos.map((m) => ({
      loc: 'https://modelseason.com/m/' + m.s.split('/').map(encodeURIComponent).join('/') + '/',
      prio: '0.6', freq: 'weekly',
    })),
  ];
  const corpo = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${hoje}</lastmod><changefreq>${u.freq}</changefreq><priority>${u.prio}</priority></url>`).join('\n')}
</urlset>
`;
  return new Response(corpo, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
