import type { MetadataRoute } from 'next';
import { agora, modelos } from '@/lib/data';

const BASE = 'https://modelseason.com';

/** A página inicial e a página de todo modelo com volume nos últimos 7 dias. */
export default function sitemap(): MetadataRoute.Sitemap {
  const dia = agora().ultimo_dia;
  const paginas = Object.values(modelos().modelos)
    .filter(m => (m.share_7d ?? 0) > 0)
    .sort((a, b) => (b.share_7d ?? 0) - (a.share_7d ?? 0))
    .map(m => ({ url: `${BASE}/m/${m.slug}`, lastModified: dia, changeFrequency: 'daily' as const, priority: 0.6 }));
  return [{ url: `${BASE}/`, lastModified: dia, changeFrequency: 'daily', priority: 1 }, ...paginas];
}
