import type { Metadata } from 'next';
import { carregarConteudo } from '@/lib/content';
import { agora, dadosV1, indiceBusca, mercado } from '@/lib/data';
import { ehIdioma, type Lang } from '@/lib/i18n';
import { idioma } from '@/lib/idioma';
import { alternancias } from '@/lib/meta';
import { InfoProvider } from '@/components/shell/Info';
import { Indice, Topo } from '@/components/shell/Topo';
import { Rodape } from '@/components/shell/Rodape';
import { Agora } from '@/components/agora/Agora';
import { Historico } from '@/components/secoes/Historico';

export const dynamic = 'force-static';

type Props = { params: Promise<{ lang: string }> };
const langDe = async (p: Props['params']): Promise<Lang> => { const { lang } = await p; return ehIdioma(lang) ? lang : 'pt'; };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { alternates: alternancias(await langDe(params), '/') };
}

function indice(lang: Lang) {
  const { t } = idioma(lang);
  const h = (href: string, n: string, pt: string, en: string) => ({ href, n, t: t({ pt, en }) });
  return [
    { lbl: t({ pt: 'Agora', en: 'Now' }), itens: [h('#agora', '—', 'Retrato do dia', "Today's snapshot"), h('#lideres', '—', 'Líderes por critério', 'Leaders by criterion')] },
    { lbl: t({ pt: 'Histórico', en: 'History' }), itens: [
      h('#s01', '01', 'Para que usam', 'What it is used for'),
      h('#s02', '02', 'Tamanho e concentração', 'Size and concentration'),
      h('#s03', '03', 'Share por laboratório', 'Share by lab'),
      h('#s04', '04', 'Origem e pesos', 'Origin and weights'),
      h('#s05', '05', 'Que carga exige', 'What the workload needs'),
      h('#s06', '06', 'Onde é usado', 'Where it is used'),
      h('#s07', '07', 'Dinheiro', 'Money'),
      h('#s08', '08', 'Qualidade × adoção', 'Quality vs. adoption'),
      h('#s09', '09', 'Os três grandes', 'The Big Three'),
      h('#s10', '10', 'Ciclo de vida', 'Lifecycle'),
      h('#s11', '11', 'O que mudou', 'What changed'),
      h('#s12', '12', 'Comparador', 'Compare'),
      h('#s13', '13', 'Mapa da temporada', 'Season map'),
      h('#s14', '14', 'Sinais', 'Signals'),
    ] },
    { lbl: t({ pt: 'Referência', en: 'Reference' }), itens: [h('#s15', '15', 'Como ler cada indicador', 'How to read each indicator')] },
  ];
}

export default async function Home({ params }: Props) {
  const lang = await langDe(params);
  const { t, f } = idioma(lang);
  const D = dadosV1(), A = agora(), M = mercado(), C = carregarConteudo(lang);
  return (
    <InfoProvider conteudo={C}>
      <Topo itens={indiceBusca()} />
      <div className="shell">
        <Indice grupos={indice(lang)} />
        <main id="conteudo">
          <header className="hd">
            <div>
              <div className="eyebrow">{t({ pt: 'Inteligência de mercado · Modelos de linguagem', en: 'Market intelligence · Language models' })}</div>
              <h1>{t({ pt: 'O que importa em IA hoje', en: 'What matters in AI today' })}</h1>
              <p className="sub">{t({
                pt: 'Quem lidera, o que mudou e para que os modelos de linguagem estão sendo usados, medido no tráfego real de tokens.',
                en: 'Who leads, what changed and what language models are being used for, measured on real token traffic.',
              })}</p>
            </div>
            <div className="meta">
              {t({ pt: 'Dado diário até', en: 'Daily data through' })} <b>{f.fD(A.ultimo_dia)}</b><br />
              {t({ pt: 'Histórico', en: 'History' })}: <b>{f.fBR(D.daily_first)}</b> {t({ pt: 'a', en: 'to' })} <b>{f.fBR(D.daily_last)}</b><br />
              {t({ pt: 'Semanas completas', en: 'Full weeks' })}: <b>{D.weeks.length}</b> · {t({ pt: 'Modelos', en: 'Models' })}: <b>{D.n_models}</b><br />
              {t({ pt: 'Licença dos dados', en: 'Data license' })}: CC BY 4.0
            </div>
          </header>
          <Agora A={A} lang={lang} />
          <Historico D={D} M={M} />
        </main>
      </div>
      <Rodape asOf={D.as_of} ultimoDia={A.ultimo_dia} />
    </InfoProvider>
  );
}
