/**
 * Root layout único, com o idioma vindo da URL. O português mora na raiz sem
 * prefixo: next.config.ts reescreve "/..." para "/pt/..." sem mudar a URL, e
 * "/pt/..." redireciona para a raiz. O inglês mora em "/en/...".
 */
import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import '../globals.css';
import { sans, mono } from '../fontes';
import { Analytics } from '@/components/shell/Analytics';
import { IdiomaProvider } from '@/components/shell/Idioma';
import { ehIdioma, HTML_LANG, IDIOMAS, OG_LOCALE, tx, type Lang } from '@/lib/i18n';
import { DESCRICAO, OG_IMAGEM, TITULO } from '@/lib/meta';

// Sem dynamicParams = false aqui: no root layout ele vale para a árvore inteira
// e derruba em 404 (NoFallbackError) toda página de modelo gerada sob demanda.
// O idioma inválido não chega até aqui: o rewrite só produz /pt e /en, e
// langDe() ainda responde 404 para qualquer outro.
export const generateStaticParams = () => IDIOMAS.map(lang => ({ lang }));

type Props = { params: Promise<{ lang: string }> };
const langDe = async (params: Props['params']): Promise<Lang> => {
  const { lang } = await params;
  if (!ehIdioma(lang)) notFound();
  return lang;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const lang = await langDe(params);
  return {
    metadataBase: new URL('https://modelseason.com'),
    title: { default: TITULO[lang], template: '%s · Model Season' },
    description: DESCRICAO[lang],
    openGraph: { type: 'website', siteName: 'Model Season', images: [OG_IMAGEM[lang]], locale: OG_LOCALE[lang],
      alternateLocale: IDIOMAS.filter(l => l !== lang).map(l => OG_LOCALE[l]) },
    twitter: { card: 'summary_large_image', images: [OG_IMAGEM[lang]] },
  };
}
export const viewport: Viewport = {
  themeColor: [{ media: '(prefers-color-scheme: light)', color: '#f4f5f7' }, { media: '(prefers-color-scheme: dark)', color: '#0e1013' }],
};

// Tema escolhido antes da primeira pintura, para não piscar.
const temaInicial = `try{var t=localStorage.getItem('ms-tema');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch(e){}`;

export default async function RootLayout({ children, params }: Props & { children: React.ReactNode }) {
  const lang = await langDe(params);
  return (
    <html lang={HTML_LANG[lang]} className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: temaInicial }} /></head>
      <body>
        <a href="#conteudo" className="pular">{tx(lang, { pt: 'Pular para o conteúdo', en: 'Skip to content' })}</a>
        <IdiomaProvider lang={lang}>{children}</IdiomaProvider>
        <Analytics />
      </body>
    </html>
  );
}
