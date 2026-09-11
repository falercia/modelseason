'use client';
/**
 * Seção 14: sinais da temporada. Achados por regra e extrapolação condicional
 * vêm do motor (R.sinais) como tipo e números; a frase é montada aqui, em cada
 * idioma. Os dois respondem à janela, ao agrupamento e ao filtro. O cartão de
 * finalidade depende do arquivo diário de tarefas e mostra, sem número
 * inventado, quanto falta para a primeira comparação.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Mercado } from '@/lib/tipos';
import type { Achado, IdProjecao, Projecao } from '@/lib/engine';
import type { Texto } from '@/lib/i18n';
import { useHistorico } from '@/components/shell/Historico';
import { useIdioma } from '@/components/shell/Idioma';
import { Cartao, Secao } from '@/components/shell/Cartao';
import { nomeModelo } from './S12';
import s from './s14.module.css';

type Kit = ReturnType<typeof useIdioma>;

/** Rótulo, valor em destaque e frase de cada achado. O slug vira link com o nome legível. */
function achado(a: Achado, K: Kit, mes: boolean, link: ReactNode): { rot: string; val: string; txt: ReactNode } {
  const { t, f } = K;
  const b1 = (v: number) => f.dec(v.toFixed(1));
  const d = a.d;
  const per = (n: number) => (mes
    ? t({ pt: n === 1 ? 'mês' : 'meses', en: n === 1 ? 'month' : 'months' })
    : t({ pt: n === 1 ? 'semana' : 'semanas', en: n === 1 ? 'week' : 'weeks' }));
  switch (a.tipo) {
    case 'aceleracao': return {
      rot: t({ pt: 'Aceleração fora do padrão', en: 'Unusual acceleration' }),
      val: `+${b1(d.recente)}pp`,
      txt: t({
        pt: <>{link} subiu {b1(d.recente)} pontos em {d.jan} {per(d.jan)}, {b1(d.z)} desvios acima da própria oscilação típica. Chegou a {f.fmtP(d.agora)} do volume.</>,
        en: <>{link} rose {b1(d.recente)} points in {d.jan} {per(d.jan)}, {b1(d.z)} standard deviations above its own typical swing. It reached {f.fmtP(d.agora)} of volume.</>,
      }),
    };
    case 'caro': return {
      rot: t({ pt: 'Ganhou share sendo mais caro', en: 'Gained share while pricier' }),
      val: t({ pt: `${b1(d.mult)}× a mediana`, en: `${b1(d.mult)}× the median` }),
      txt: t({
        pt: <>{link} custa {f.fmtUSD(d.preco)} por 1M, {b1(d.mult)} vezes a mediana do mercado, e mesmo assim ganhou {b1(d.d)} pontos de share em {d.jan} {per(d.jan)}. Contraria a força dominante do dataset, que é preço.</>,
        en: <>{link} costs {f.fmtUSD(d.preco)} per 1M, {b1(d.mult)} times the market median, and still gained {b1(d.d)} points of share in {d.jan} {per(d.jan)}. It runs against the dominant force in this dataset, which is price.</>,
      }),
    };
    case 'resistindo': return {
      rot: t({ pt: 'Resistindo à temporada', en: 'Outlasting its season' }),
      val: t({ pt: `${d.sem} semanas`, en: `${d.sem} weeks` }),
      txt: t({
        pt: <>{link} foi lançado há {d.sem} semanas e continua no top 10, {b1(d.vezes)} vezes a idade mediana do topo. A tese diz que isso é raro, e é exatamente por isso que vale olhar o que ele faz de diferente.</>,
        en: <>{link} launched {d.sem} weeks ago and is still in the top 10, {b1(d.vezes)} times the median age of the leaders. The thesis says that is rare, which is exactly why it is worth looking at what it does differently.</>,
      }),
    };
    case 'concentrou':
    case 'desconcentrou': {
      const sobe = d.curta > 0, r = Math.round(d.curta);
      return {
        rot: sobe ? t({ pt: 'O mercado voltou a concentrar', en: 'The market is concentrating again' }) : t({ pt: 'A concentração voltou a cair', en: 'Concentration is falling again' }),
        val: `HHI ${sobe ? '+' : ''}${r}/${per(1)}`,
        txt: t({
          pt: <>O HHI vinha {d.longa < 0 ? 'caindo' : 'subindo'} ao longo da janela e inverteu: nas últimas {d.n} {per(d.n)} ele {sobe ? 'sobe' : 'cai'} {Math.abs(r)} pontos por {per(1)}. Reversão de concentração costuma anteceder a chegada de um modelo que domina, ou a saída de um que dominava.</>,
          en: <>The HHI had been {d.longa < 0 ? 'falling' : 'rising'} across the window and reversed: over the last {d.n} {per(d.n)} it {sobe ? 'rises' : 'falls'} {Math.abs(r)} points per {per(1)}. A reversal in concentration often comes before a dominant model arrives, or before a dominant one leaves.</>,
        }),
      };
    }
    case 'descolando': return {
      rot: t({ pt: 'Pesos abertos descolando da China', en: 'Open weights decoupling from China' }),
      val: t({ pt: `${b1(d.g1)}pp de distância`, en: `${b1(d.g1)}pp apart` }),
      txt: t({
        pt: <>As duas curvas costumam andar juntas, porque a maioria dos pesos abertos relevantes é chinesa. A distância entre elas passou de {b1(d.g0)} para {b1(d.g1)} pontos. Ou apareceu peso aberto fora da China, ou lab chinês fechando modelo.</>,
        en: <>The two curves usually move together, because most relevant open-weights models are Chinese. The gap between them went from {b1(d.g0)} to {b1(d.g1)} points. Either open weights appeared outside China, or a Chinese lab is closing its models.</>,
      }),
    };
  }
}

const ROT_PROJ: Record<IdProjecao, Texto> = {
  china: { pt: 'Share de laboratórios chineses', en: 'Chinese labs share' },
  abertos: { pt: 'Share de pesos abertos', en: 'Open-weights share' },
  anthropic: { pt: 'Share da Anthropic', en: 'Anthropic share' },
  openai: { pt: 'Share da OpenAI', en: 'OpenAI share' },
  google: { pt: 'Share do Google', en: 'Google share' },
  gratuito: { pt: 'Tráfego em endpoints gratuitos', en: 'Traffic on free endpoints' },
  top5: { pt: 'Concentração dos 5 maiores', en: 'Top-5 concentration' },
  preco: { pt: 'Preço efetivo do mercado', en: 'Effective market price' },
};

function Finalidade({ M }: { M: Mercado }) {
  const { t, f, tarefa } = useIdioma();
  const T = M.tarefas;
  if (!T) {
    return <Cartao id="sinais-finalidade" novo><p className="vazio">{t({
      pt: 'A fonte não publicou foto de tarefas nesta versão dos dados, então não há base para comparar.',
      en: 'The source did not publish a task snapshot in this version of the data, so there is no baseline to compare against.',
    })}</p></Cartao>;
  }
  // Cada foto cobre janela_dias dias. Duas fotos só medem períodos sem sobreposição
  // quando estão separadas pela própria janela: a de hoje e a de janela_dias atrás.
  const necessarias = T.janela_dias + 1;
  const fotos = T.fotos_arquivadas;
  const faltam = Math.max(0, necessarias - fotos);
  const quando = new Date(T.as_of + 'T00:00:00');
  quando.setDate(quando.getDate() + faltam);
  const lider = [...T.classificacoes].sort((a, b) => b.token_share - a.token_share)[0];
  return (
    <Cartao id="sinais-finalidade" novo subtitulo={t({
      pt: <>A tarefa que mais cresceu entre a foto de hoje e a de {T.janela_dias} dias antes, e o modelo que mais avançou nela. Não responde à janela nem ao filtro.</>,
      en: <>The task that grew most between today&apos;s snapshot and the one {T.janela_dias} days earlier, and the model that gained most within it. It does not respond to the window or the filters.</>,
    })}>
      <div className={'vazio ' + s.vz}>
        <span className={s.kick}>{t({ pt: 'Aguardando o arquivo', en: 'Waiting for the archive' })}</span>
        <div className={s.fotos} role="img" aria-label={t({
          pt: `${Math.min(fotos, necessarias)} de ${necessarias} fotos necessárias arquivadas`,
          en: `${Math.min(fotos, necessarias)} of ${necessarias} required snapshots archived`,
        })}>
          {Array.from({ length: necessarias }, (_, i) => <i key={i} className={i < fotos ? s.ok : undefined} />)}
          <span>{t({ pt: `${fotos} de ${necessarias} fotos`, en: `${fotos} of ${necessarias} snapshots` })}</span>
        </div>
        {faltam > 0 ? t({
          pt: <p>O arquivo tem <b>{fotos} {fotos === 1 ? 'foto diária' : 'fotos diárias'}</b> de tarefas, a mais recente de {f.fD(T.as_of)}. Cada foto cobre {T.janela_dias} dias, então a primeira comparação sem sobreposição precisa de <b>{necessarias} fotos</b>: faltam <b>{faltam}</b>. Se nenhum dia falhar, ela sai com a foto de {f.fD(quando)}.</p>,
          en: <p>The archive holds <b>{fotos} daily task {fotos === 1 ? 'snapshot' : 'snapshots'}</b>, the latest from {f.fD(T.as_of)}. Each snapshot covers {T.janela_dias} days, so the first non-overlapping comparison needs <b>{necessarias} snapshots</b>: <b>{faltam}</b> to go. If no day fails, it comes out with the snapshot of {f.fD(quando)}.</p>,
        }) : t({
          pt: <p>O arquivo já tem {fotos} fotos diárias, o bastante para comparar janelas de {T.janela_dias} dias sem sobreposição. A comparação ainda não foi publicada pelo pipeline, e este cartão não calcula nada por conta própria.</p>,
          en: <p>The archive already holds {fotos} daily snapshots, enough to compare non-overlapping {T.janela_dias}-day windows. The pipeline has not published the comparison yet, and this card calculates nothing on its own.</p>,
        })}
        <p>{t({
          pt: 'Quando houver, aparece aqui a tarefa que mais ganhou share de tokens entre as duas fotos, em pontos percentuais, o modelo que mais avançou dentro dela e a tarefa que mais perdeu, para contraste.',
          en: 'Once it exists, this card shows the task that gained the most token share between the two snapshots, in percentage points, the model that gained most within it and, for contrast, the task that lost the most.',
        })}</p>
        {lider && <p>{t({
          pt: <>A foto de hoje já está guardada: {T.classificacoes.length} tarefas classificadas, lideradas por <b>{tarefa(lider)}</b>, com {f.fmtP(lider.token_share)} dos tokens classificados.</>,
          en: <>Today&apos;s snapshot is already stored: {T.classificacoes.length} classified tasks, led by <b>{tarefa(lider)}</b>, with {f.fmtP(lider.token_share)} of classified tokens.</>,
        })}</p>}
        <p style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{t({
          pt: 'A fonte só publica a semana corrente e não guarda passado. Cada dia sem arquivar é um dia que não volta.',
          en: 'The source only publishes the current week and keeps no history. Every day not archived is a day that does not come back.',
        })}</p>
      </div>
    </Cartao>
  );
}

export default function S14({ M }: { M: Mercado }) {
  const { D, R } = useHistorico();
  const K = useIdioma();
  const { t, f, modelo } = K;
  const S = R.sinais;
  const mes = R.estado.gran === 'mes';
  const nomes = new Map(D.matriz.modelos.map(m => [m.s, m.n]));
  const nome = (slug: string) => nomeModelo(slug, nomes.get(slug));
  const per = (n: number) => (mes
    ? t({ pt: n === 1 ? 'mês' : 'meses', en: n === 1 ? 'month' : 'months' })
    : t({ pt: n === 1 ? 'semana' : 'semanas', en: n === 1 ? 'week' : 'weeks' }));
  const n = S.achados.length;
  // Valor de uma série projetada: share em %, preço com duas casas ("US$ 1,07" / "$1.07").
  const val = (p: Projecao, v: number) => (p.unidade === 'usd' ? t({ pt: 'US$ ', en: '$' }) + f.dec(v.toFixed(2)) : f.fmtP(v));
  const taxa = (p: Projecao) => (p.unidade === 'usd' ? val(p, p.taxa) : f.dec(p.taxa.toFixed(1)) + 'pp');

  return (
    <Secao id="s14" n="14" titulo={t({ pt: 'Sinais da temporada', en: 'Season signals' })}
      sub={t({
        pt: <>O que está fora do padrão nesta janela, detectado automaticamente, e para onde os números vão <b>se a taxa atual se mantiver</b>. A segunda parte não é previsão, e a página inteira existe para mostrar que essas taxas mudam.</>,
        en: <>What is out of pattern in this window, detected automatically, and where the numbers go <b>if the current rate holds</b>. The second part is not a forecast, and the whole page exists to show that these rates change.</>,
      })}>
      <Cartao id="sinais" subtitulo={n
        ? t({ pt: `${n} ${n === 1 ? 'padrão quebrado' : 'padrões quebrados'} nesta janela, detectados por regra, não por curadoria.`,
              en: `${n} broken ${n === 1 ? 'pattern' : 'patterns'} in this window, detected by rule, not by curation.` })
        : t({ pt: 'Nada fora do padrão nesta janela.', en: 'Nothing out of pattern in this window.' })}>
        {n ? (
          <div className={s.sin} style={{ ['--cols' as string]: n === 5 ? 3 : Math.min(n, 4) }}>
            {S.achados.map(a => {
              const link = a.slug ? <Link href={modelo(a.slug)} title={a.slug}>{nome(a.slug)}</Link> : null;
              const x = achado(a, K, mes, link);
              return (
                <div className={s.s} key={a.tipo}>
                  <span className={s.rot}>{x.rot}</span>
                  <span className={s.val}>{x.val}</span>
                  <p className={s.txt}>{x.txt}</p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="vazio">{t({
            pt: 'Nenhuma das regras disparou nesta janela. Isso também é informação: o mercado está se movendo dentro do padrão dele. Janelas mais longas dão mais chance a regras que dependem de tendência.',
            en: 'None of the rules fired in this window. That is information too: the market is moving within its own pattern. Longer windows give trend-based rules more room to fire.',
          })}</p>
        )}
      </Cartao>

      <div className={s.cols}>
        <Cartao id="projecao" subtitulo={t({
          pt: `Reta ajustada às últimas ${S.base} ${per(S.base)}, estendida por mais ${S.horiz} ${per(S.horiz)}.`,
          en: `Straight line fitted to the last ${S.base} ${per(S.base)}, extended ${S.horiz} more ${per(S.horiz)}.`,
        })}>
          {S.projs.length ? (
            <>
              <div className="tabwrap">
                <table className={'t ' + s.prj}>
                  <thead><tr>
                    <th>{t({ pt: 'Indicador', en: 'Indicator' })}</th><th>{t({ pt: 'Agora', en: 'Now' })}</th>
                    <th>{t({ pt: `Ritmo por ${per(1)}`, en: `Pace per ${per(1)}` })}</th><th>{t({ pt: `Em ${S.horiz} ${per(S.horiz)}`, en: `In ${S.horiz} ${per(S.horiz)}` })}</th>
                  </tr></thead>
                  <tbody>{S.projs.map(p => (
                    <tr key={p.id}>
                      <td>{t(ROT_PROJ[p.id])}</td>
                      <td data-rot={t({ pt: 'agora', en: 'now' })}>{val(p, p.atual)}</td>
                      <td data-rot={t({ pt: `ritmo por ${per(1)}`, en: `pace per ${per(1)}` })}>
                        <span className={s.seta} aria-hidden="true">{p.dir === 'sobe' ? '↗' : '↘'}</span>{p.dir === 'sobe' ? '+' : '−'}{taxa(p)}
                        <span className="sr"> {p.dir === 'sobe' ? t({ pt: 'subindo', en: 'rising' }) : t({ pt: 'caindo', en: 'falling' })}</span></td>
                      <td data-rot={t({ pt: `em ${S.horiz} ${per(S.horiz)}`, en: `in ${S.horiz} ${per(S.horiz)}` })}>{p.rompe
                        ? <span className={s.rompe}>{t({ pt: `bate em ${val(p, p.rompe.lim)} em ${p.rompe.n} ${per(p.rompe.n)}`, en: `hits ${val(p, p.rompe.lim)} in ${p.rompe.n} ${per(p.rompe.n)}` })}</span>
                        : <span className={s.alvo}>{p.alvo == null ? '—' : val(p, p.alvo)}</span>}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              {S.projs.some(p => p.rompe) && (
                <p className="nota">{t({
                  pt: <>Em <span className={s.rompe}>vermelho</span>, as séries cuja reta bate no piso ou no teto antes de uma vez e meia o horizonte. Ali o valor de chegada não é publicado: não é previsão de que vão zerar ou saturar, é a prova de que a taxa atual não se mantém por tanto tempo.</>,
                  en: <>In <span className={s.rompe}>red</span>, the series whose line hits the floor or the ceiling before one and a half times the horizon. The end value is not published there: it is not a forecast that they will hit zero or saturate, it is proof that the current rate cannot hold that long.</>,
                })}</p>
              )}
            </>
          ) : <p className="vazio">{t({ pt: 'Nenhuma série com movimento consistente o bastante nesta janela para projetar.', en: 'No series moved consistently enough in this window to project.' })}</p>}
          <p className="nao">{t({
            pt: <><b>Isto não é previsão.</b> É a taxa observada nas últimas {S.base} {per(S.base)} estendida em linha reta. A tese desta página é justamente que essas taxas mudam, então o número serve para dimensionar ordem de grandeza e provocar a pergunta certa, não para planejar.</>,
            en: <><b>This is not a forecast.</b> It is the rate observed over the last {S.base} {per(S.base)}, extended in a straight line. This page&apos;s thesis is precisely that these rates change, so the number is for sizing orders of magnitude and prompting the right question, not for planning.</>,
          })}</p>
        </Cartao>
        <Finalidade M={M} />
      </div>
    </Secao>
  );
}
