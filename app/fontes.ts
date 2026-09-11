import localFont from 'next/font/local';

// Fontes hospedadas no próprio site (SIL Open Font License): o build não depende
// de rede externa e o leitor não faz requisição a terceiros.
export const sans = localFont({ src: './fonts/dm-sans.woff2', variable: '--font-sans', display: 'swap', weight: '100 1000' });
export const mono = localFont({ src: [{ path: './fonts/dm-mono-400.woff2', weight: '400' }, { path: './fonts/dm-mono-500.woff2', weight: '500' }], variable: '--font-mono', display: 'swap' });
