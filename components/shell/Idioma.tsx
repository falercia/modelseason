'use client';
/**
 * Idioma da página no cliente. O root layout (app/[lang]/layout.tsx) envolve
 * tudo com IdiomaProvider; qualquer componente cliente pega o kit com
 * useIdioma(). Componente de servidor não usa isto: recebe lang e chama idioma().
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { idioma, type Idioma } from '@/lib/idioma';
import { IDIOMAS, NOME_IDIOMA, SIGLA, HTML_LANG, trocarIdioma, type Lang } from '@/lib/i18n';

const Ctx = createContext<Lang>('pt');

export function IdiomaProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <Ctx.Provider value={lang}>{children}</Ctx.Provider>;
}

export const useIdioma = (): Idioma => idioma(useContext(Ctx));

/**
 * Seletor de idioma no topo: leva ao mesmo lugar no outro idioma, com a janela,
 * os filtros e a âncora da URL atual. Link comum, não <Link>: a troca recarrega
 * a página, e o <html lang> e o GA registram o idioma novo desde o início.
 */
export function SeletorIdioma() {
  const { lang, t } = useIdioma();
  const pathname = usePathname() || '/';
  const [extra, setExtra] = useState({ busca: '', ancora: '' });
  // Busca e âncora só existem no navegador; atualiza ao focar, para pegar o estado mais recente.
  const ler = () => setExtra({ busca: location.search, ancora: location.hash });
  useEffect(ler, [pathname]);
  return (
    <nav className="idiomas" aria-label={t({ pt: 'Idioma', en: 'Language' })}>
      {IDIOMAS.map(l => l === lang
        ? <span key={l} aria-current="true" title={NOME_IDIOMA[l]}>{SIGLA[l]}</span>
        : <a key={l} href={trocarIdioma(pathname, l, extra.busca, extra.ancora)} hrefLang={HTML_LANG[l]} lang={HTML_LANG[l]}
            title={NOME_IDIOMA[l]} aria-label={NOME_IDIOMA[l]} onFocus={ler} onPointerEnter={ler}
            onClick={e => {
              // O recorte muda a URL com history.replaceState, que o React não vê: o destino é
              // calculado no clique, com a busca e a âncora do momento. Ctrl/Cmd-clique segue o href.
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
              e.preventDefault();
              location.assign(trocarIdioma(pathname, l, location.search, location.hash));
            }}>{SIGLA[l]}</a>)}
    </nav>
  );
}
