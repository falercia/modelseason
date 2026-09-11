import type { NextConfig } from 'next';

const config: NextConfig = {
  // Os JSON de data/ são lidos no servidor com fs; o rastreador de arquivos da
  // Vercel precisa saber que eles vão junto com as funções da rota de modelo.
  outputFileTracingIncludes: {
    '/m/[...slug]': ['./data/web/modelos.json', './data/web/agora.json', './data/web/mercado.json'],
  },
  poweredByHeader: false,
};
export default config;
