import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { carregarConteudo } from '@/lib/content';
import { agora, dadosV1, indiceBusca, modelos, radar } from '@/lib/data';
import { ehIdioma, IDIOMAS, OG_LOCALE, type Lang } from '@/lib/i18n';
import { idioma } from '@/lib/idioma';
import { alternancias, OG_IMAGEM } from '@/lib/meta';
import { frase, textoAssunto, tituloEdicao, totalItens } from '@/lib/radar';
import { InfoProvider } from '@/components/shell/Info';
import { Topo } from '@/components/shell/Topo';
import { Rodape } from '@/components/shell/Rodape';
import { CSS_RADAR, Edicao, Fontes } from '@/components/radar/Radar';

// Só as edições que existem: dia fora da lista é 404 sem executar função.
export const dynamicParams = false;

type Props = { params: Promise<{ lang: string; dia: string }> };

export function generateStaticParams() {
  return IDIOMAS.flatMap(lang => radar().edicoes.map(ed => ({ lang, dia: ed.dia })));
}

const ler = async (params: Props['params']) => {
  const p = await params;
  const lang: Lang = ehIdioma(p.lang) ? p.lang : 'pt';
  const E = radar().edicoes;
  const i = E.findIndex(ed => ed.dia === p.dia);
  return { lang, ed: i >= 0 ? E[i] : null, mais_nova: i > 0 ? E[i - 1] : null, mais_antiga: i >= 0 ? E[i + 1] ?? null : null };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, ed } = await ler(params);
  const I = idioma(lang);
  if (!ed) return { title: 'Radar', robots: { index: false } };
  const titulo = `${I.t({ pt: 'Radar de', en: 'Radar,' })} ${I.f.fD(ed.dia)}: ${tituloEdicao(ed, I)}`;
  const titulos = [...(ed.assuntos ?? []).map(a => textoAssunto(a, I).titulo), ...ed.eventos.map(ev => frase(ev, ed.dia, I).titulo)];
  const descricao = titulos.slice(0, 3).join('. ') + (titulos.length ? '.' : '');
  const alt = alternancias(lang, '/radar/' + ed.dia);
  return {
    title: titulo, description: descricao || titulo, alternates: alt,
    openGraph: { type: 'article', siteName: 'Model Season', locale: OG_LOCALE[lang], url: alt.canonical, title: titulo, description: descricao || titulo, publishedTime: ed.dia, images: [OG_IMAGEM[lang]] },
  };
}

export default async function Page({ params }: Props) {
  const { lang, ed, mais_nova, mais_antiga } = await ler(params);
  if (!ed) notFound();
  const I = idioma(lang);
  const { t, f, url } = I;
  const A = agora(), D = dadosV1();
  const paginas = new Set(Object.keys(modelos().modelos));
  return (
    <InfoProvider conteudo={carregarConteudo(lang)}>
      <style href="rd-css" precedence="medium">{CSS_RADAR}</style>
      <Topo itens={indiceBusca()} />
      <main id="conteudo" className="rd">
        <span className="kicker"><Link href={url('/radar')}>Radar</Link> · {f.fD(ed.dia)}</span>
        <h1>{tituloEdicao(ed, I)}</h1>
        <div className="rd-meta">
          <span>{totalItens(ed)} {t({ pt: totalItens(ed) === 1 ? 'item' : 'itens', en: totalItens(ed) === 1 ? 'item' : 'items' })}</span>
          <a href={url('/radar') + '/feed.xml'}>RSS</a>
        </div>
        <Edicao ed={ed} I={I} paginas={paginas} />
        <Fontes ed={ed} I={I} />
        <nav className="rd-nav" aria-label={t({ pt: 'Outras edições', en: 'Other editions' })}>
          <span>{mais_antiga && <Link href={url('/radar/' + mais_antiga.dia)}>← {f.fD(mais_antiga.dia)}</Link>}</span>
          <span>{mais_nova && <Link href={url('/radar/' + mais_nova.dia)}>{f.fD(mais_nova.dia)} →</Link>}</span>
        </nav>
      </main>
      <Rodape asOf={D.as_of} ultimoDia={A.ultimo_dia} />
    </InfoProvider>
  );
}
