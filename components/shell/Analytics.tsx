import Script from 'next/script';

/**
 * Google Analytics 4. Inerte até existir NEXT_PUBLIC_GA_ID (formato G-XXXXXXX)
 * nas variáveis de ambiente da Vercel, só em Production: preview e CI não
 * mandam visita falsa para a propriedade.
 *
 * O ID não é segredo (vai no HTML de qualquer site com GA), mas mora na Vercel
 * e não no código para trocar de propriedade sem commit.
 *
 * Consent Mode: tudo que é publicidade fica negado por padrão. A página não tem
 * anúncio e não compartilha dado para isso.
 */
export const GA_ID = (process.env.NEXT_PUBLIC_GA_ID || '').trim();
export const gaAtivo = /^G-[A-Z0-9]{4,}$/.test(GA_ID);

export function Analytics() {
  if (!gaAtivo) return null;
  const init = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}
gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'granted'});
gtag('js',new Date());gtag('config','${GA_ID}');`;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">{init}</Script>
    </>
  );
}
