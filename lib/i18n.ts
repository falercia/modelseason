/**
 * Idiomas do site. Português na raiz, inglês em /en (decisão de 11/09/2026).
 *
 * Regra: todo texto visível tem uma versão por idioma, e o tipo Texto<V> é um
 * Record<Lang, V>. Acrescentar um idioma a IDIOMAS faz o TypeScript apontar
 * cada texto que ficou sem tradução, em vez de o site sair meio traduzido.
 *
 * Sem dependência de Next nem de React: roda no servidor, no cliente e nos
 * testes com node --experimental-strip-types.
 */
export const IDIOMAS = ['pt', 'en'] as const;
export type Lang = (typeof IDIOMAS)[number];
export const PADRAO: Lang = 'pt';
export const ehIdioma = (s: unknown): s is Lang => (IDIOMAS as readonly unknown[]).includes(s);

/** Atributo lang do <html> e código hreflang. */
export const HTML_LANG: Record<Lang, string> = { pt: 'pt-BR', en: 'en' };
/** Locale do Open Graph. */
export const OG_LOCALE: Record<Lang, string> = { pt: 'pt_BR', en: 'en_US' };
export const NOME_IDIOMA: Record<Lang, string> = { pt: 'Português', en: 'English' };
export const SIGLA: Record<Lang, string> = { pt: 'PT', en: 'EN' };
/** Prefixo de rota. O português não tem prefixo, para nenhuma URL publicada mudar. */
export const PREFIXO: Record<Lang, string> = { pt: '', en: '/en' };

export type Texto<V = string> = Record<Lang, V>;
export const tx = <V,>(lang: Lang, v: Texto<V>): V => v[lang];

/**
 * Caminho interno no idioma. caminho('en', '/m/x') = '/en/m/x';
 * caminho('en', '/') = '/en'; caminho('en', '/#s03') = '/en#s03'.
 */
export function caminho(lang: Lang, p: string): string {
  const i = p.search(/[?#]/);
  const rota = i < 0 ? p : p.slice(0, i), resto = i < 0 ? '' : p.slice(i);
  const pre = PREFIXO[lang];
  const base = rota === '/' || rota === '' ? pre || '/' : pre + (rota.startsWith('/') ? rota : '/' + rota);
  return base + resto;
}

/** Página de modelo. O sufixo de endpoint (":free") é somado ao modelo base. */
export const urlModelo = (slug: string, lang: Lang) => caminho(lang, '/m/' + slug.split(':')[0]);

/** Tira o prefixo de idioma de um pathname (aceita também /pt, que redireciona para a raiz). */
export function semPrefixo(pathname: string): string {
  const m = pathname.match(/^\/(en|pt)(?=\/|$)/);
  const r = m ? pathname.slice(m[0].length) : pathname;
  return r || '/';
}

/** O mesmo lugar no outro idioma, preservando busca e âncora. */
export const trocarIdioma = (pathname: string, para: Lang, busca = '', ancora = '') =>
  caminho(para, semPrefixo(pathname)) + busca + ancora;
