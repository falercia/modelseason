import type { NextConfig } from 'next';

/** Arquivos servidos na raiz que nunca podem ser reescritos para /pt. */
const RAIZ = ['sitemap\\.xml', 'robots\\.txt', 'icon\\.svg', 'favicon\\.ico', 'data\\.json', 'og\\.png', 'og-en\\.png'].join('|');

const config: NextConfig = {
  // Os JSON de data/ são lidos no servidor com fs; o rastreador de arquivos da
  // Vercel precisa saber que eles vão junto com as funções das rotas dinâmicas.
  outputFileTracingIncludes: {
    '/[lang]/m/[...slug]': ['./data/web/modelos.json', './data/web/agora.json', './data/web/mercado.json', './public/data.json'],
    '/[lang]/[...resto]': ['./data/web/modelos.json', './data/web/agora.json', './public/data.json'],
  },
  poweredByHeader: false,
  // Português na raiz, sem prefixo: toda URL que não começa com /en (nem é
  // arquivo, rota de metadado ou asset, que casam antes) é servida por /pt/...
  // sem mudar o endereço. Nenhuma URL publicada antes do inglês muda.
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [
        { source: '/', destination: '/pt' },
        // Primeiro segmento diferente de en, pt, _next e dos arquivos da raiz; o resto vai inteiro.
        // Os arquivos já casam antes (afterFiles), a exclusão é redundante de propósito.
        { source: `/:primeiro((?!(?:en|pt|_next)(?:/|$)|(?:${RAIZ})$)[^/]+)/:resto*`, destination: '/pt/:primeiro/:resto*' },
      ],
      fallback: [],
    };
  },
  // /pt/... é endereço interno: quem chegar nele vai para a raiz, para não haver duas URLs do mesmo conteúdo.
  async redirects() {
    return [
      { source: '/pt', destination: '/', permanent: true },
      { source: '/pt/:caminho*', destination: '/:caminho*', permanent: true },
    ];
  },
};
export default config;
