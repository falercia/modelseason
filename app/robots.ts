import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: 'https://modelseason.com/sitemap.xml',
    host: 'https://modelseason.com',
  };
}
