import type { Metadata } from 'next';
import Link from 'next/link';
import { carregarConteudo } from '@/lib/content';
import { agora, dadosV1, diaReferencia, indiceBusca, itensLabs, labs, modelos, movimentos } from '@/lib/data';
import { ehIdioma, OG_LOCALE, type Lang } from '@/lib/i18n';
import { idioma } from '@/lib/idioma';
import { alternancias, OG_IMAGEM } from '@/lib/meta';
import { InfoProvider } from '@/components/shell/Info';
import { Topo } from '@/components/shell/Topo';
import { Rodape } from '@/components/shell/Rodape';
import { CSS_LABS, PaginaLabs } from '@/components/labs/Labs';

export const dynamic = 'force-static';

type Props = { params: Promise<{ lang: string }> };
const langDe = async (p: Props['params']): Promise<Lang> => { const { lang } = await p; return ehIdioma(lang) ? lang : 'pt'; };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const lang = await langDe(params);
  const { t } = idioma(lang);
  const alt = alternancias(lang, '/labs');
  const titulo = t({ pt: 'Laboratórios: o placar e os movimentos dos grandes', en: 'Labs: the scoreboard and the moves of the big players' });
  const descricao = t({
    pt: 'Anthropic, OpenAI, Google e os sete chineses que mais pesam no tráfego: share de tokens e de gasto por semana e tudo o que cada um registrou nas próprias notas de versão.',
    en: 'Anthropic, OpenAI, Google and the seven Chinese labs that weigh most in traffic: weekly token and spend share, and everything each one logged in its own release notes.',
  });
  return {
    title: titulo, description: descricao, alternates: alt,
    openGraph: { type: 'website', siteName: 'Model Season', locale: OG_LOCALE[lang], url: alt.canonical, title: `${titulo} · Model Season`, description: descricao, images: [OG_IMAGEM[lang]] },
  };
}

export default async function Page({ params }: Props) {
  const lang = await langDe(params);
  const I = idioma(lang);
  const { t, f, url } = I;
  const L = labs(), A = agora(), D = dadosV1();
  const paginas = new Set(Object.keys(modelos().modelos));
  const ref = diaReferencia();
  return (
    <InfoProvider conteudo={carregarConteudo(lang)}>
      <style href="lb-css" precedence="medium">{CSS_LABS}</style>
      <Topo itens={indiceBusca()} />
      <main id="conteudo" className="lb">
        <span className="kicker">Model Season</span>
        <h1>{t({ pt: 'Laboratórios', en: 'Labs' })}</h1>
        <p className="sub">{t({
          pt: 'O placar dos três pagos dos EUA e dos sete chineses que mais pesam no tráfego, e o que cada um registrou nas próprias notas de versão: modelo novo, preço, desativação e recurso de API. O número vem do tráfego real de tokens; o movimento, da página oficial do laboratório.',
          en: 'The scoreboard of the three paid US labs and the seven Chinese labs that weigh most in traffic, and what each one logged in its own release notes: new models, pricing, deprecations and API features. The numbers come from real token traffic; the moves, from the lab’s own official page.',
        })}</p>
        <div className="lb-meta">
          <a href="#eua">{t({ pt: 'EUA', en: 'US' })}</a>
          <a href="#china">China</a>
          <a href="#linha-do-tempo">{t({ pt: 'Linha do tempo', en: 'Timeline' })}</a>
          <a href={url('/labs') + '/movimentos.json'}>JSON</a>
          <Link href={url('/radar')}>Radar</Link>
        </div>
        <PaginaLabs L={L} ms={movimentos()} itens={itensLabs()} I={I} paginas={paginas} refDia={ref} />
        <p className="nota">{t({
          pt: 'Share de tokens e de gasto estimado entre os modelos identificados, por semana completa, de segunda a domingo, a mesma conta da faixa “O dado” do Radar. Gasto é tokens vezes o preço misto do catálogo (75% entrada, 25% saída), endpoint gratuito conta zero. Os movimentos são resumos escritos por IA só com o que a nota oficial diz, com todo número conferido contra ela; a pauta coleta segunda, quarta e sexta. As release notes do ChatGPT recusam leitura automática, então a OpenAI aparece pelo changelog da API. Nos cartões, a notícia de lançamento ou de preço do Radar completa o que a nota de versão não traz, e a que repete um movimento fica de fora. Estreias são os modelos que entraram no ranking diário de tokens (top 50) nas últimas semanas, com a posição de estreia, a do último dia do dado e a melhor; o traço no gráfico marca a semana de cada lançamento. A contagem de dias vai até a última coleta, em ' + f.fD(ref) + '.',
          en: 'Token and estimated spend share among identified models, per full week, Monday to Sunday, the same math as the “The data” strip in the Radar. Spend is tokens times the catalog blended price (75% input, 25% output), and free endpoints count as zero. Moves are AI-written summaries using only what the official note says, with every number checked against it; collection runs Monday, Wednesday and Friday. ChatGPT release notes refuse automated reading, so OpenAI is covered through its API changelog. In the cards, launch and pricing stories from the Radar fill in what the release notes miss, and a story that repeats a move is left out. Debuts are the models that entered the daily token ranking (top 50) in recent weeks, with their debut position, their position on the latest data day and their best; the tick on the chart marks the week of each launch. Day counts run to the latest collection, on ' + f.fD(ref) + '.',
        })}</p>
      </main>
      <Rodape asOf={D.as_of} ultimoDia={A.ultimo_dia} />
    </InfoProvider>
  );
}
