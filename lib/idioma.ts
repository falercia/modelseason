/**
 * O kit de idioma de uma página: formatação, texto de interface, rotas e
 * rótulos do dado, tudo amarrado a um idioma. Componente de servidor chama
 * idioma(lang); componente cliente usa useIdioma(), que devolve o mesmo objeto.
 *
 *   const { t, f, modelo } = idioma(lang);
 *   t({ pt: 'Agora', en: 'Now' });  f.fmtP(12.3);  modelo('openai/gpt-5');
 */
import { formatadores } from './format';
import { caminho, HTML_LANG, tx, urlModelo, type Lang, type Texto } from './i18n';
import {
  GRUPO_FILTRO, nomeLab, rotuloCategoriaApp, rotuloFamilia, rotuloLab, rotuloMacro, rotuloPais, rotuloPesos,
  rotuloTarefa, rotuloTurnos, rotuloValor,
} from './rotulos';

function criar(lang: Lang) {
  return {
    lang,
    pt: lang === 'pt',
    htmlLang: HTML_LANG[lang],
    /** Formatadores do idioma (número, moeda, data, eixo). */
    f: formatadores(lang),
    /** Texto de interface: t({ pt, en }). */
    t: <V,>(v: Texto<V>): V => tx(lang, v),
    /** Caminho interno no idioma: url('/') = '/en' em inglês. */
    url: (p: string) => caminho(lang, p),
    /** Página de um modelo. */
    modelo: (slug: string) => urlModelo(slug, lang),
    lab: (k: string) => rotuloLab(k, lang),
    nomeLab: (nome: string) => nomeLab(nome, lang),
    valor: (v: string) => rotuloValor(v, lang),
    pesos: (p: string) => rotuloPesos(p, lang),
    familia: (f: string) => rotuloFamilia(f, lang),
    macro: (k: string) => rotuloMacro(k, lang),
    tarefa: (x: { tag: string; nome: string; nome_fonte?: string }) => rotuloTarefa(x, lang),
    categoriaApp: (c: { key: string; nome: string }) => rotuloCategoriaApp(c, lang),
    turnos: (r: { turnos: string; turnos_nome?: string }) => rotuloTurnos(r, lang),
    pais: (p: string) => rotuloPais(p, lang),
    grupoFiltro: (dim: string) => GRUPO_FILTRO[lang][dim] ?? dim,
  };
}
export type Idioma = ReturnType<typeof criar>;

const cache = new Map<Lang, Idioma>();
export const idioma = (lang: Lang): Idioma => {
  let k = cache.get(lang);
  if (!k) cache.set(lang, (k = criar(lang)));
  return k;
};
