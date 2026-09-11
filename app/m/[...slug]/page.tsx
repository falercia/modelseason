/**
 * Página de modelo: uma rota só para todos os modelos. Os 30 maiores da semana
 * saem prontos no build; o resto é renderizado no primeiro acesso e fica em
 * cache até o próximo deploy (cada commit do pipeline gera um deploy novo).
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { carregarConteudo } from '@/lib/content';
import { agora, dadosV1, indiceBusca, mercado, modelos } from '@/lib/data';
import type { Modelo } from '@/lib/tipos';
import { InfoProvider } from '@/components/shell/Info';
import { Topo } from '@/components/shell/Topo';
import { Rodape } from '@/components/shell/Rodape';
import { PaginaModelo } from '@/components/modelo/PaginaModelo';
import { fD, fmtUSD } from '@/lib/format';
import { fmtPesos, ord, pct } from '@/components/modelo/comum';

export const dynamicParams = true;
const PRONTOS_NO_BUILD = 30;

type Props = { params: Promise<{ slug: string[] }> };

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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const m = acharModelo((await params).slug);
  if (!m) return { title: 'Modelo não encontrado', robots: { index: false } };
  const partes: string[] = [];
  partes.push(m.share_7d && m.share_7d > 0 && m.rank_7d
    ? `${pct(m.share_7d)} do tráfego de tokens do roteador nos últimos 7 dias, ${ord(m.rank_7d)} lugar`
    : 'sem volume nos últimos 7 dias');
  if (m.pico_share != null && m.pico_semana) partes.push(`pico semanal de ${pct(m.pico_share)} em ${fD(m.pico_semana)}`);
  if (m.preco_entrada != null && m.preco_saida != null) partes.push(`${fmtUSD(m.preco_entrada)} de entrada e ${fmtUSD(m.preco_saida)} de saída por 1M de tokens`);
  const titulo = `${m.nome} (${m.lab})`;
  const descricao = `${m.nome}, ${m.lab}, ${fmtPesos(m.pesos).toLowerCase()}: ${partes.join('; ')}. Share semanal, finalidade de uso, provedores e avaliações.`;
  const url = '/m/' + m.slug;
  return {
    title: titulo,
    description: descricao,
    alternates: { canonical: url },
    openGraph: { type: 'website', siteName: 'Model Season', locale: 'pt_BR', url, title: `${titulo} · Model Season`, description: descricao, images: ['/og.png'] },
    twitter: { card: 'summary_large_image', title: `${titulo} · Model Season`, description: descricao, images: ['/og.png'] },
  };
}

export default async function Page({ params }: Props) {
  const m = acharModelo((await params).slug);
  if (!m) notFound();
  const A = agora(), D = dadosV1();
  const vendorFiltravel = (D.matriz?.dic?.vendor ?? []).includes(m.vendor);
  return (
    <InfoProvider conteudo={carregarConteudo()}>
      <Topo itens={indiceBusca()} />
      <main id="conteudo" className="mp">
        <PaginaModelo m={m} MS={modelos()} A={A} Mc={mercado()} vendorFiltravel={vendorFiltravel} />
      </main>
      <Rodape asOf={D.as_of} ultimoDia={A.ultimo_dia} />
    </InfoProvider>
  );
}
