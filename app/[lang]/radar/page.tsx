import type { Metadata } from 'next';
import Link from 'next/link';
import { carregarConteudo } from '@/lib/content';
import { agora, dadosV1, indiceBusca, modelos, radar } from '@/lib/data';
import { ehIdioma, OG_LOCALE, type Lang } from '@/lib/i18n';
import { idioma } from '@/lib/idioma';
import { alternancias, OG_IMAGEM } from '@/lib/meta';
import { tituloEdicao, totalItens } from '@/lib/radar';
import { InfoProvider } from '@/components/shell/Info';
import { Topo } from '@/components/shell/Topo';
import { Rodape } from '@/components/shell/Rodape';
import { CSS_RADAR, Edicao, Fontes } from '@/components/radar/Radar';

export const dynamic = 'force-static';

type Props = { params: Promise<{ lang: string }> };
const langDe = async (p: Props['params']): Promise<Lang> => { const { lang } = await p; return ehIdioma(lang) ? lang : 'pt'; };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const lang = await langDe(params);
  const { t } = idioma(lang);
  const alt = alternancias(lang, '/radar');
  const titulo = t({ pt: 'Radar: o que mudou nos modelos de linguagem', en: 'Radar: what changed in language models' });
  const descricao = t({
    pt: 'Uma edição por dia com as notícias de IA que importam para quem escolhe modelo, modelos novos, preços, desativações e mudanças de liderança, cada fato cruzado com o tráfego real de tokens.',
    en: 'One edition a day with the AI news that matters to whoever picks a model, new models, prices, deprecations and leadership changes, each fact matched against real token traffic.',
  });
  return {
    title: titulo, description: descricao,
    alternates: { ...alt, types: { 'application/rss+xml': alt.canonical + '/feed.xml' } },
    openGraph: { type: 'website', siteName: 'Model Season', locale: OG_LOCALE[lang], url: alt.canonical, title: `${titulo} · Model Season`, description: descricao, images: [OG_IMAGEM[lang]] },
  };
}

export default async function Page({ params }: Props) {
  const lang = await langDe(params);
  const I = idioma(lang);
  const { t, f, url } = I;
  const R = radar(), A = agora(), D = dadosV1();
  const paginas = new Set(Object.keys(modelos().modelos));
  const [hoje, ...antes] = R.edicoes;
  return (
    <InfoProvider conteudo={carregarConteudo(lang)}>
      <style href="rd-css" precedence="medium">{CSS_RADAR}</style>
      <Topo itens={indiceBusca()} />
      <main id="conteudo" className="rd">
        <span className="kicker">Model Season</span>
        <h1>Radar</h1>
        <p className="sub">{t({
          pt: 'O que mudou nos modelos de linguagem, um dia por vez: o que está em pauta lá fora, quem entrou e saiu do catálogo, quem mudou de preço, quem vai ser desativado e quem mexeu no tráfego. Cada fato vem com o que o histórico de uso diz sobre ele.',
          en: 'What changed in language models, one day at a time: what is in the news, what entered and left the catalog, what changed price, what is being deprecated and what moved in traffic. Each fact comes with what the usage history says about it.',
        })}</p>
        <div className="rd-meta">
          {hoje && <span>{t({ pt: 'Edição de', en: 'Edition of' })} {f.fD(hoje.dia)}</span>}
          <span>{R.edicoes.length} {t({ pt: R.edicoes.length === 1 ? 'edição' : 'edições', en: R.edicoes.length === 1 ? 'edition' : 'editions' })}</span>
          <a href={url('/radar') + '/feed.xml'}>RSS</a>
        </div>
        {hoje ? (
          <>
            <Edicao ed={hoje} I={I} paginas={paginas} />
            <Fontes ed={hoje} I={I} />
            <p className="nota"><Link href={url('/radar/' + hoje.dia)}>{t({ pt: 'Link permanente desta edição', en: 'Permanent link to this edition' })}</Link></p>
          </>
        ) : <p className="rd-vazio">{t({ pt: 'A primeira edição ainda não saiu.', en: 'The first edition is not out yet.' })}</p>}
        {antes.length > 0 && (
          <section style={{ marginTop: 30 }} aria-labelledby="rd-arq">
            <h2 id="rd-arq" style={{ fontSize: 15, marginBottom: 6 }}>{t({ pt: 'Edições anteriores', en: 'Previous editions' })}</h2>
            <ul className="rd-arq" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {antes.map(ed => (
                <li key={ed.dia}>
                  <span className="d">{f.fD(ed.dia)}</span>
                  <Link href={url('/radar/' + ed.dia)}>{tituloEdicao(ed, I)}</Link>
                  <span className="n">{totalItens(ed)} {t({ pt: totalItens(ed) === 1 ? 'item' : 'itens', en: totalItens(ed) === 1 ? 'item' : 'items' })}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <Rodape asOf={D.as_of} ultimoDia={A.ultimo_dia} />
    </InfoProvider>
  );
}
