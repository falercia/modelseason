// @ts-check
import { defineConfig } from 'astro/config';

// Saida estatica, sem adaptador de servidor. Isso e o que mantem a saida de
// emergencia: o build produz HTML, CSS e JS comuns, servidos por qualquer host.
// Se o Astro azedar, ficamos com os arquivos e jogamos a ferramenta fora.
export default defineConfig({
  site: 'https://modelseason.com',
  output: 'static',
  trailingSlash: 'ignore',
  // Formato de diretorio: cada pagina vira pasta com index.html, entao a URL
  // limpa funciona em QUALQUER host estatico, e nao so na Vercel com cleanUrls.
  build: { format: 'directory' },
  devToolbar: { enabled: false },
});
