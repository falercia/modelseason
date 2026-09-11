/**
 * Página de modelo: uma rota só para todos os modelos, nos dois idiomas. Os 30
 * maiores da semana saem prontos no build (por idioma); o resto é renderizado
 * no primeiro acesso e fica em cache até o próximo deploy (cada commit do
 * pipeline gera um deploy novo).
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { carregarConteudo } from '@/lib/content';
import { agora, dadosV1, indiceBusca, mercado, modelos } from '@/lib/data';
import { ehIdioma, OG_LOCALE, type Lang } from '@/lib/i18n';
import { idioma } from '@/lib/idioma';
import { alternancias, OG_IMAGEM } from '@/lib/meta';
import type { Modelo } from '@/lib/tipos';
import { InfoProvider } from '@/components/shell/Info';
import { Topo } from '@/components/shell/Topo';
import { Rodape } from '@/components/shell/Rodape';
import { PaginaModelo } from '@/components/modelo/PaginaModelo';

export const dynamicParams = true;
const PRONTOS_NO_BUILD = 30;

type Props = { params: Promise<{ lang: string; slug: string[] }> };

export function generateStaticParams() {
  return Object.values(modelos().modelos)
    .filter(m => (m.share_7d ?? 0) > 0)
    .sort((a, b) => (b.share_7d ?? 0) - (a.share_7d ?? 0))
    .slice(0, PRONTOS_NO_BUILD)
    .map(m => ({ slug: m.slug.split('/') }));
}

/** Slug da URL → modelo. Aceita segmento codificado e sufixo de endpoint (":free"), que é somado ao modelo base. */
function acharModelo(partes: string[] | undefined): Modelo | null {
  if (!partes?.length) return null;
  let slug: string;
  try { slug = partes.map(decodeURIComponent).join('/'); } catch { return null; }
  const M = modelos().modelos;
  return M[slug] ?? M[slug.split(':')[0]] ?? null;
}

const ler = async (params: Props['params']): Promise<{ lang: Lang; m: Modelo | null }> => {
  const p = await params;
  return { lang: ehIdioma(p.lang) ? p.lang : 'pt', m: acharModelo(p.slug) };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, m } = await ler(params);
  const { t, f, pesos, nomeLab } = idioma(lang);
  if (!m) return { title: t({ pt: 'Modelo não encontrado', en: 'Model not found' }), robots: { index: false } };
  const lab = nomeLab(m.lab);
  const partes: string[] = [];
  partes.push(m.share_7d && m.share_7d > 0 && m.rank_7d
    ? t({ pt: `${f.pct(m.share_7d)} do tráfego de tokens do roteador nos últimos 7 dias, ${f.ord(m.rank_7d)} lugar`,
        en: `${f.pct(m.share_7d)} of the router's token traffic over the last 7 days, ranked ${f.ord(m.rank_7d)}` })
    : t({ pt: 'sem volume nos últimos 7 dias', en: 'no volume in the last 7 days' }));
  if (m.pico_share != null && m.pico_semana)
    partes.push(t({ pt: `pico semanal de ${f.pct(m.pico_share)} em ${f.fD(m.pico_semana)}`, en: `weekly peak of ${f.pct(m.pico_share)} on ${f.fD(m.pico_semana)}` }));
  if (m.preco_entrada != null && m.preco_saida != null)
    partes.push(t({ pt: `${f.fmtUSD(m.preco_entrada)} de entrada e ${f.fmtUSD(m.preco_saida)} de saída por 1M de tokens`,
      en: `${f.fmtUSD(m.preco_entrada)} input and ${f.fmtUSD(m.preco_saida)} output per 1M tokens` }));
  const titulo = `${m.nome} (${lab})`;
  const descricao = t({
    pt: `${m.nome}, ${lab}, ${pesos(m.pesos).toLowerCase()}: ${partes.join('; ')}. Share semanal, finalidade de uso, provedores e avaliações.`,
    en: `${m.nome}, ${lab}, ${pesos(m.pesos).toLowerCase()}: ${partes.join('; ')}. Weekly share, use cases, providers and benchmarks.`,
  });
  const alt = alternancias(lang, '/m/' + m.slug);
  return {
    title: titulo,
    description: descricao,
    alternates: alt,
    openGraph: { type: 'website', siteName: 'Model Season', locale: OG_LOCALE[lang], url: alt.canonical, title: `${titulo} · Model Season`, description: descricao, images: [OG_IMAGEM[lang]] },
    twitter: { card: 'summary_large_image', title: `${titulo} · Model Season`, description: descricao, images: [OG_IMAGEM[lang]] },
  };
}

export default async function Page({ params }: Props) {
  const { lang, m } = await ler(params);
  if (!m) notFound();
  const A = agora(), D = dadosV1();
  const vendorFiltravel = (D.matriz?.dic?.vendor ?? []).includes(m.vendor);
  return (
    <InfoProvider conteudo={carregarConteudo(lang)}>
      <Topo itens={indiceBusca()} />
      <main id="conteudo" className="mp">
        <PaginaModelo m={m} MS={modelos()} A={A} Mc={mercado()} vendorFiltravel={vendorFiltravel} lang={lang} />
      </main>
      <Rodape asOf={D.as_of} ultimoDia={A.ultimo_dia} />
    </InfoProvider>
  );
}
