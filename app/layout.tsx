import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';

// Fontes hospedadas no próprio site (SIL Open Font License): o build não depende
// de rede externa e o leitor não faz requisição a terceiros.
const sans = localFont({ src: './fonts/dm-sans.woff2', variable: '--font-sans', display: 'swap', weight: '100 1000' });
const mono = localFont({ src: [{ path: './fonts/dm-mono-400.woff2', weight: '400' }, { path: './fonts/dm-mono-500.woff2', weight: '500' }], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL('https://modelseason.com'),
  title: { default: 'Model Season · para onde vai o tráfego dos modelos de linguagem', template: '%s · Model Season' },
  description: 'Quem lidera, quem subiu, quem estreou e para que os modelos de linguagem estão sendo usados. Dado diário, histórico desde janeiro de 2025.',
  openGraph: { type: 'website', siteName: 'Model Season', images: ['/og.png'], locale: 'pt_BR' },
  twitter: { card: 'summary_large_image', images: ['/og.png'] },
  alternates: { canonical: '/' },
};
export const viewport: Viewport = {
  themeColor: [{ media: '(prefers-color-scheme: light)', color: '#f4f5f7' }, { media: '(prefers-color-scheme: dark)', color: '#0e1013' }],
};

// Tema escolhido antes da primeira pintura, para não piscar.
const temaInicial = `try{var t=localStorage.getItem('ms-tema');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: temaInicial }} /></head>
      <body>
        <a href="#conteudo" className="pular">Pular para o conteúdo</a>
        {children}
      </body>
    </html>
  );
}
