'use client';
/**
 * Seção 04: origem, licença e cobrança. Porte dos stackedShare('origin') e
 * ('weights') e do lineChart('free') da v1, com a leitura de read-weights. O
 * cartão de provedores é novo: é a sede de quem SERVE o modelo, uma foto do
 * dia, e por isso não responde à janela nem aos filtros.
 */
import type { ReactNode } from 'react';
import type { Mercado } from '@/lib/tipos';
import type { Recorte, Series } from '@/lib/engine';
import { Cartao, Secao } from '@/components/shell/Cartao';
import { useHistorico } from '@/components/shell/Historico';
import { useIdioma } from '@/components/shell/Idioma';
import { BarrasH, Legenda, Temporal, TabelaSerie, useOcultos, type ItemSerie } from '@/components/graficos/base';
import { ORIGEM_SLOT, PESOS_SLOT } from '@/lib/cores';
import { indiceBase, indiceFim, Leitura, P, usePeriodo } from './s02-comum';

type Kit = ReturnType<typeof useIdioma>;

/**
 * Duas faixas de "resto" dividem o mesmo cinza. A de não identificado sai num
 * tom mais claro do próprio --s0, para as duas não se fundirem: continua sendo
 * o neutro da paleta, não uma quinta cor.
 */
const CINZA_CLARO = 'color-mix(in srgb, var(--s0) 45%, var(--surface))';

/** Ordem de empilhamento: as duas maiores nas bordas, para ler cada uma direto do eixo. */
const ORDEM_ORIGEM = ['China', 'Europa', 'Coreia', 'Outros', 'Não identificado', 'EUA/Canadá'];
const ORDEM_PESOS = ['Open-weights', 'Não identificado', 'Proprietário'];

function Empilhada({ R, dados, ordem, slot, rotulo, aria }: {
  R: Recorte; dados: Series; ordem: string[]; slot: (k: string) => string; rotulo: (k: string) => string; aria: string;
}) {
  const { t, f } = useIdioma();
  const { fmtP, fPer } = f;
  const { tipSemanas } = usePeriodo();
  const { ocultos, alternar } = useOcultos();
  const u = R.N - 1, tot = R.weekly_total_T, gran = R.estado.gran;
  const chaves = [...ordem.filter(k => dados[k]), ...Object.keys(dados).filter(k => !ordem.includes(k))]
    .filter(k => dados[k].some(v => v >= 0.05)); // faixa que nunca chega a 0,05% seria invisível: fica fora do gráfico e da legenda
  const todas: ItemSerie[] = chaves.map(k => ({ key: k, label: rotulo(k), values: dados[k].map((v, i) => (tot[i] > 0 ? v : null)), slot: slot(k) }));
  const vis = todas.filter(s => !ocultos.has(s.key));
  const legenda = todas.slice().sort((x, y) => (dados[y.key][u] ?? 0) - (dados[x.key][u] ?? 0))
    .map(s => ({ key: s.key, label: `${s.label} ${fmtP(dados[s.key][u])}`, slot: s.slot }));
  // Filtro que deixa uma categoria só (origem=China, por exemplo) vira um bloco de 100% que não diz nada.
  if (todas.length <= 1) {
    return <p className="vazio">{t({
      pt: <>Todo o recorte está em uma categoria só{todas[0] ? <> ({todas[0].label})</> : null}, então não há o que repartir. Tire o filtro correspondente para ver a divisão.</>,
      en: <>The whole filtered view falls in a single category{todas[0] ? <> ({todas[0].label})</> : null}, so there is nothing to split. Remove the matching filter to see the breakdown.</>,
    })}</p>;
  }
  return (
    <>
      <Legenda itens={legenda} ocultos={ocultos} alternar={alternar} />
      <Temporal eixo={R.eixo} gran={gran} modo="empilhada" series={vis.length ? vis : todas} fmt={v => fmtP(v)} fmtEixo={v => v + '%'} ymax={100} altura={250}
        tipExtra={tipSemanas(R)} rotuloAria={t({
          pt: `${aria}, de ${fPer(R.eixo[0], gran)} a ${fPer(R.eixo[u], gran)}. No último período: ${legenda.map(l => l.label).join(', ')}.`,
          en: `${aria}, from ${fPer(R.eixo[0], gran)} to ${fPer(R.eixo[u], gran)}. Latest period: ${legenda.map(l => l.label).join(', ')}.`,
        })} />
      <TabelaSerie eixo={R.eixo} gran={gran} fmt={v => fmtP(v)} series={todas.map(s => ({ label: s.label, values: s.values }))} />
    </>
  );
}

const slotOrigem = (k: string) => (k === 'Não identificado' ? CINZA_CLARO : ORIGEM_SLOT[k] ?? '--s0');
const slotPesos = (k: string) => PESOS_SLOT[k] ?? '--s0';

/** "de 12,0% para 61,0%" / "from 12.0% to 61.0%" */
const dePara = ({ t, f }: Kit, s: number[], b: number, u: number): ReactNode => t({
  pt: <>de <b>{f.fmtP(s[b])}</b> para <b>{f.fmtP(s[u])}</b></>,
  en: <>from <b>{f.fmtP(s[b])}</b> to <b>{f.fmtP(s[u])}</b></>,
});

function LeituraOrigem({ R, b }: { R: Recorte; b: number }) {
  const K = useIdioma();
  const { t, f, valor } = K;
  const { entre } = usePeriodo();
  const u = indiceFim(R.weekly_total_T), o = R.origin_share;
  // Uma origem só na janela inteira: o próprio gráfico já diz isso no lugar da área.
  if (Object.keys(o).filter(k => o[k].some(v => v >= 0.05)).length <= 1) return null;
  const presentes = Object.keys(o).filter(k => o[k][u] > 0);
  if (presentes.length <= 1) {
    return <Leitura R={R}><p>{t({
      pt: <>Todo o recorte vem de uma origem só{presentes[0] ? <> ({presentes[0]})</> : null}, então não há o que repartir aqui. Tire o filtro de origem para ver a divisão.</>,
      en: <>The whole filtered view comes from a single origin{presentes[0] ? <> ({valor(presentes[0])})</> : null}, so there is nothing to split here. Remove the origin filter to see the breakdown.</>,
    })}</p></Leitura>;
  }
  const cn = o['China'], us = o['EUA/Canadá'];
  const outras = Object.keys(o).filter(k => k !== 'China' && k !== 'EUA/Canadá' && k !== 'Não identificado')
    .map(k => ({ k, d: o[k][u] - o[k][b], v: o[k][u] })).sort((x, y) => y.v - x.v)[0];
  const dif = cn && us ? f.dec(Math.abs(cn[u] - us[u]).toFixed(1)) : '';
  return (
    <Leitura R={R}>
      <p>{t({
        pt: <>{cn && <>Laboratórios chineses foram {dePara(K, cn, b, u)} do volume</>}
          {cn && us && '; '}
          {us && <>{cn ? 'e' : 'Laboratórios de'} EUA e Canadá, {dePara(K, us, b, u)}</>}, {entre(R, b, u)}.
          {cn && us && <> Hoje a diferença entre os dois é de <b>{dif} pontos</b>, a favor {cn[u] >= us[u] ? 'da China' : 'de EUA e Canadá'}.</>}</>,
        en: <>{cn && <>Chinese labs went {dePara(K, cn, b, u)} of volume</>}
          {cn && us && '; '}
          {us && <>{cn ? 'US and Canadian labs, ' : 'US and Canadian labs went '}{dePara(K, us, b, u)}{cn ? null : ' of volume'}</>}, {entre(R, b, u)}.
          {cn && us && <> The gap between the two is now <b>{dif} points</b>, in favor of {cn[u] >= us[u] ? 'China' : 'the US and Canada'}.</>}</>,
      })}</p>
      {outras && outras.v >= 0.5 && <P>{t({
        pt: <>Fora dos dois polos, a maior fatia é de {outras.k === 'Outros' ? 'outras origens' : outras.k}, com {f.fmtP(outras.v)} ({f.fmtPP(outras.d)} na janela).</>,
        en: <>Outside the two poles, the largest slice is {outras.k === 'Outros' ? 'other origins' : valor(outras.k)}, with {f.fmtP(outras.v)} ({f.fmtPP(outras.d)} over the window).</>,
      })}</P>}
      <P>{t({
        pt: <>Esta é a sede de quem <b>treinou</b> o modelo. Onde fica quem o serve está no cartão de provedores, mais abaixo.</>,
        en: <>This is the headquarters of whoever <b>trained</b> the model. Where the providers serving it are based is in the providers card, further down.</>,
      })}</P>
    </Leitura>
  );
}

function LeituraPesos({ R, b }: { R: Recorte; b: number }) {
  const K = useIdioma();
  const { t, f } = K;
  if (Object.keys(R.weights_share).filter(k => R.weights_share[k].some(v => v >= 0.05)).length <= 1) return null;
  const u = indiceFim(R.weekly_total_T), ow = R.weights_share['Open-weights'], pr = R.weights_share['Proprietário'], ni = R.weights_share['Não identificado'];
  const cn = R.origin_share['China'];
  // Com filtro de origem ou de licença, uma das duas curvas vira constante e a comparação perde sentido.
  const comparavel = !R.estado.filtros.origin?.length && !R.estado.filtros.pesos?.length && ow && cn;
  const g0 = comparavel ? Math.abs(ow[b] - cn[b]) : 0, g1 = comparavel ? Math.abs(ow[u] - cn[u]) : 0;
  return (
    <Leitura R={R}>
      <p>{t({
        pt: <>{ow ? <>Pesos abertos foram {dePara(K, ow, b, u)} do volume</> : <>Nenhum modelo de pesos abertos no recorte</>}
          {pr ? <>; proprietários, {dePara(K, pr, b, u)}</> : null}.
          {ni && ni[u] >= 1 && <> <b>{f.fmtP(ni[u])}</b> do último período não tem licença identificada, e ignorar essa faixa inflaria as outras duas.</>}</>,
        en: <>{ow ? <>Open-weights models went {dePara(K, ow, b, u)} of volume</> : <>No open-weights model in the filtered view</>}
          {pr ? <>; proprietary models, {dePara(K, pr, b, u)}</> : null}.
          {ni && ni[u] >= 1 && <> <b>{f.fmtP(ni[u])}</b> of the latest period has no identified license, and ignoring that band would inflate the other two.</>}</>,
      })}</p>
      {comparavel && (
        <P>
          {t({
            pt: <>No fim da janela, pesos abertos e laboratórios chineses estão a <b>{f.dec(g1.toFixed(1))} pontos</b> um do outro ({f.fmtP(ow[u])} contra {f.fmtP(cn[u])}); no início, a distância era de {f.dec(g0.toFixed(1))}.</>,
            en: <>At the end of the window, open weights and Chinese labs are <b>{f.dec(g1.toFixed(1))} points</b> apart ({f.fmtP(ow[u])} vs. {f.fmtP(cn[u])}); at the start, the gap was {f.dec(g0.toFixed(1))}.</>,
          })}
          {' '}{g1 <= 8
            ? (g0 - g1 >= 4
              ? t({ pt: 'As curvas convergiram ao longo da janela e hoje andam quase juntas', en: 'The curves converged over the window and now move almost together' })
              : t({ pt: 'As duas curvas andam quase juntas', en: 'The two curves move almost together' }))
              + t({
                pt: ', porque a maioria dos pesos abertos relevantes é chinesa: é o mesmo fenômeno visto de dois ângulos, não duas tendências independentes.',
                en: ', because most relevant open-weights models are Chinese: it is the same phenomenon seen from two angles, not two independent trends.',
              })
            : g1 - g0 >= 4
              ? t({
                pt: 'As curvas descolaram: ou apareceu peso aberto relevante fora da China, ou laboratório chinês passou a fechar modelo.',
                en: 'The curves have decoupled: either a relevant open-weights model appeared outside China, or a Chinese lab started closing its models.',
              })
              : g0 - g1 >= 4
                ? t({
                  pt: 'As curvas estão se aproximando, mas a distância ainda é grande demais para tratar uma como a outra.',
                  en: 'The curves are converging, but the gap is still too wide to treat one as the other.',
                })
                : t({
                  pt: 'A distância é grande e estável, então as duas medidas não são intercambiáveis neste recorte.',
                  en: 'The gap is wide and stable, so the two measures are not interchangeable in this filtered view.',
                })}
        </P>
      )}
    </Leitura>
  );
}

function LeituraFree({ R, b }: { R: Recorte; b: number }) {
  const K = useIdioma();
  const { t, f } = K;
  const { naQuando } = usePeriodo();
  const u = indiceFim(R.weekly_total_T), fr = R.free_share;
  let pico = b; for (let i = b; i <= u; i++) if (fr[i] > fr[pico]) pico = i;
  return (
    <Leitura R={R}>
      <p>{t({
        pt: <>Tráfego em endpoints gratuitos foi {dePara(K, fr, b, u)} do volume na janela
          {pico !== u ? <>, com pico de <b>{f.fmtP(fr[pico])}</b> {naQuando(R, pico)}</> : <>, e o último período é o pico</>}.</>,
        en: <>Traffic on free endpoints went {dePara(K, fr, b, u)} of volume over the window
          {pico !== u ? <>, peaking at <b>{f.fmtP(fr[pico])}</b> {naQuando(R, pico)}</> : <>, and the latest period is the peak</>}.</>,
      })}</p>
      <P>{t({
        pt: 'Volume gratuito infla adoção sem indicar disposição a pagar. Todo share desta página inclui essa demanda subsidiada, que ainda não foi testada contra preço.',
        en: 'Free volume inflates adoption without signaling willingness to pay. Every share on this page includes that subsidized demand, which has not yet been tested against price.',
      })}</P>
    </Leitura>
  );
}

// ------------------------------------------------------------ provedores

const EUROPA = new Set(['GB', 'UK', 'IE', 'FR', 'DE', 'NL', 'BE', 'LU', 'ES', 'PT', 'IT', 'CH', 'AT', 'SE', 'NO', 'DK', 'FI', 'PL', 'CZ', 'EE', 'LT', 'LV', 'RO', 'UA']);
/** Mesma cor por região do gráfico de origem: o país é a entidade, então a cor o acompanha. */
const slotPais = (p: string) => (p === 'US' || p === 'CA' ? ORIGEM_SLOT['EUA/Canadá'] : p === 'CN' || p === 'HK' ? ORIGEM_SLOT['China']
  : EUROPA.has(p) ? ORIGEM_SLOT['Europa'] : p === 'KR' ? ORIGEM_SLOT['Coreia'] : '--s0');
/** Chave do dado para sede não declarada. Nunca é exibida como veio. */
const NAO_INFORMADO = 'Não informado';

function ProvedoresSede({ M }: { M: Mercado }) {
  const { t, f, pais, htmlLang } = useIdioma();
  const { fmtP, fD } = f;
  const P0 = M.provedores, Z = M.zdr;
  const dia = P0?.dia ?? Z?.dia;
  const sub = dia
    ? t({ pt: `Foto de ${fD(dia)}. Não responde à janela nem aos filtros`, en: `Snapshot from ${fD(dia)}. Does not respond to the window or filters` })
    : t({ pt: 'Foto do dia. Não responde à janela nem aos filtros', en: "Today's snapshot. Does not respond to the window or filters" });
  if (!P0 && !Z) {
    return <Cartao id="provedores-sede" subtitulo={sub} novo><p className="vazio">{t({
      pt: 'A coleta de provedores ainda não chegou a esta publicação. O cartão aparece quando o pipeline gravar a primeira foto.',
      en: 'Provider collection has not reached this data release yet. The card appears once the pipeline records its first snapshot.',
    })}</p></Cartao>;
  }
  let barras: { key: string; rot: string; v: number; slot: string; extra: string }[] = [];
  let naoInf = 0, us = 0;
  if (P0) {
    const pct = (n: number) => '· ' + fmtP((100 * n) / (P0.total || 1), 0);
    naoInf = P0.por_sede.find(x => x.pais === NAO_INFORMADO)?.n ?? 0;
    us = P0.por_sede.find(x => x.pais === 'US')?.n ?? 0;
    const paises = P0.por_sede.filter(x => x.pais !== NAO_INFORMADO).sort((a, b) => b.n - a.n || a.pais.localeCompare(b.pais));
    // Até seis países com nome. Um empate que atravessaria o corte vai inteiro para "outros",
    // em vez de a ordem alfabética decidir quem aparece.
    let corte = Math.min(6, paises.length);
    if (corte < paises.length && paises[corte - 1].n === paises[corte].n) {
      const n = paises[corte - 1].n; while (corte > 0 && paises[corte - 1].n === n) corte--;
    }
    const top = paises.slice(0, corte), resto = paises.slice(corte);
    barras = top.map(x => ({ key: x.pais, rot: pais(x.pais), v: x.n, slot: slotPais(x.pais), extra: pct(x.n) }));
    const nResto = resto.reduce((s, x) => s + x.n, 0);
    if (nResto) {
      barras.push({ key: '_resto', rot: t({
        pt: `Outros ${resto.length} ${resto.length === 1 ? 'país' : 'países'}`,
        en: `${resto.length} other ${resto.length === 1 ? 'country' : 'countries'}`,
      }), v: nResto, slot: '--s0', extra: pct(nResto) });
    }
    if (naoInf) barras.push({ key: '_ni', rot: t({ pt: 'Sede não informada', en: 'Headquarters not reported' }), v: naoInf, slot: CINZA_CLARO, extra: pct(naoInf) });
  }
  const mesmoDia = P0 && Z && P0.dia === Z.dia && Z.provedores <= P0.total;
  const Num = ({ v, rot }: { v: number; rot: string }) => (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '-.01em' }}>{v.toLocaleString(htmlLang)}</div>
      <div style={{ fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.35 }}>{rot}</div>
    </div>
  );
  return (
    <Cartao id="provedores-sede" subtitulo={sub} novo>
      {P0 ? (
        <>
          <p className="cap" style={{ marginBottom: 8 }}>{t({
            pt: `${P0.total} provedores de inferência listados, por país-sede declarado`,
            en: `${P0.total} inference providers listed, by declared headquarters country`,
          })}</p>
          <BarrasH linhas={barras} fmt={v => String(v)} larguraRotulo={140}
            rotuloAria={t({
              pt: `Provedores de inferência por país-sede em ${fD(P0.dia)}: ${barras.map(b => `${b.rot} ${b.v}`).join(', ')}, de ${P0.total} no total.`,
              en: `Inference providers by headquarters country on ${fD(P0.dia)}: ${barras.map(b => `${b.rot} ${b.v}`).join(', ')}, out of ${P0.total} in total.`,
            })} />
        </>
      ) : <p className="vazio">{t({ pt: 'Sem a lista de provedores nesta publicação.', en: 'No provider list in this data release.' })}</p>}
      <div style={{ borderTop: '1px solid var(--grid)', marginTop: 12, paddingTop: 10 }}>
        <p style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>{t({ pt: 'Retenção zero de dados (ZDR)', en: 'Zero data retention (ZDR)' })}</p>
        {Z ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
            <Num v={Z.endpoints} rot={t({ pt: 'endpoints com retenção zero', en: 'endpoints with zero retention' })} />
            <Num v={Z.modelos} rot={t({ pt: 'modelos com ao menos um desses endpoints', en: 'models with at least one of those endpoints' })} />
            <Num v={Z.provedores} rot={mesmoDia
              ? t({ pt: `de ${P0!.total} provedores oferecem a opção`, en: `of ${P0!.total} providers offer the option` })
              : t({ pt: 'provedores oferecem a opção', en: 'providers offer the option' })} />
          </div>
        ) : <p className="vazio">{t({ pt: 'Sem a lista de endpoints com retenção zero nesta publicação.', en: 'No list of zero-retention endpoints in this data release.' })}</p>}
      </div>
      <Leitura R={null}>
        <p>{t({
          pt: <>Isto é a sede de quem <b>serve</b> o modelo, o provedor de inferência que recebe a requisição. É outra coisa que o gráfico de origem, que mostra a sede de quem <b>treinou</b>: um modelo chinês servido por provedor americano conta como China lá e como Estados Unidos aqui.</>,
          en: <>This is the headquarters of whoever <b>serves</b> the model, the inference provider that receives the request. That is a different thing from the origin chart, which shows the headquarters of whoever <b>trained</b> it: a Chinese model served by a US provider counts as China there and as the United States here.</>,
        })}</p>
        {P0 && (
          <P>{t({
            pt: <>{us > 0 && <><b>{us}</b> dos {P0.total} provedores ({fmtP((100 * us) / P0.total, 0)}) declaram sede nos Estados Unidos. </>}
              {naoInf > 0 && <><b>{naoInf}</b> não {naoInf === 1 ? 'declara' : 'declaram'} sede nenhuma, e para quem tem restrição de jurisdição esse é o grupo que exige verificação caso a caso.</>}</>,
            en: <>{us > 0 && <><b>{us}</b> of the {P0.total} providers ({fmtP((100 * us) / P0.total, 0)}) declare headquarters in the United States. </>}
              {naoInf > 0 && <><b>{naoInf}</b> {naoInf === 1 ? 'declares' : 'declare'} no headquarters at all, and for anyone with jurisdiction constraints this is the group that needs case-by-case checking.</>}</>,
          })}</P>
        )}
        {Z && mesmoDia && (
          <P>{t({
            pt: <>Retenção zero é uma política por endpoint, não por modelo: {Z.provedores} dos {P0!.total} provedores a oferecem em pelo menos um endpoint, e o mesmo modelo pode ter endpoint com e sem ela.</>,
            en: <>Zero retention is a per-endpoint policy, not a per-model one: {Z.provedores} of the {P0!.total} providers offer it on at least one endpoint, and the same model can have endpoints with and without it.</>,
          })}</P>
        )}
      </Leitura>
    </Cartao>
  );
}

export default function S04({ M }: { M: Mercado }) {
  const { R } = useHistorico();
  const { t, f, valor, pesos } = useIdioma();
  const { fmtP, fPer } = f;
  const { per, tipSemanas } = usePeriodo();
  const b = indiceBase(R.weekly_total_T);
  const gran = R.estado.gran, u = R.N - 1;
  const semVolume = b < 0;
  const vazio = <p className="vazio">{t({ pt: 'Nenhum volume no recorte atual.', en: 'No volume in the current filtered view.' })}</p>;
  const maxFree = Math.max(0, ...R.free_share);
  const adj = per(R).adj;
  return (
    <Secao id="s04" n="04" titulo={t({ pt: 'Origem, licença e cobrança', en: 'Origin, license and billing' })}
      sub={t({
        pt: 'De onde vem o modelo, se os pesos são abertos, quanto do tráfego é gratuito e onde ficam os provedores que servem a inferência.',
        en: 'Where the model comes from, whether its weights are open, how much of the traffic is free and where the providers serving inference are based.',
      })}>
      <div className="grid2">
        <Cartao id="origin" subtitulo={t({
          pt: `% do volume ${adj} por país-sede do laboratório que treinou o modelo`,
          en: `% of ${adj} volume by headquarters of the lab that trained the model`,
        })}>
          {semVolume ? vazio : (
            <>
              <Empilhada R={R} dados={R.origin_share} ordem={ORDEM_ORIGEM} slot={slotOrigem} rotulo={valor}
                aria={t({ pt: 'Área empilhada do share de tokens por origem do laboratório', en: 'Stacked area of token share by lab origin' })} />
              <LeituraOrigem R={R} b={b} />
            </>
          )}
        </Cartao>
        <Cartao id="weights" subtitulo={t({
          pt: `% do volume ${adj} em modelos de pesos abertos, proprietários e não identificados`,
          en: `% of ${adj} volume in open-weights, proprietary and unknown models`,
        })}>
          {semVolume ? vazio : (
            <>
              <Empilhada R={R} dados={R.weights_share} ordem={ORDEM_PESOS} slot={slotPesos} rotulo={k => (ORDEM_PESOS.includes(k) ? pesos(k) : valor(k))}
                aria={t({ pt: 'Área empilhada do share de tokens por licença dos pesos', en: 'Stacked area of token share by weights license' })} />
              <LeituraPesos R={R} b={b} />
            </>
          )}
        </Cartao>
      </div>
      <div className="grid2" style={{ marginTop: 14 }}>
        <Cartao id="free">
          {semVolume ? vazio : maxFree <= 0 ? <p className="vazio">{t({
            pt: `Nenhum tráfego em endpoint gratuito no recorte atual.${R.estado.filtros.cobranca?.length ? ' Com o filtro de cobrança sem “Endpoint gratuito”, esta curva fica vazia por definição.' : ''}`,
            en: `No traffic on free endpoints in the current filtered view.${R.estado.filtros.cobranca?.length ? ` With the billing filter excluding “${valor('Endpoint gratuito')}”, this curve is empty by definition.` : ''}`,
          })}</p> : (
            <>
              <Temporal eixo={R.eixo} gran={gran} modo="area" fmt={v => fmtP(v)} fmtEixo={v => v + '%'} altura={230}
                series={[{ key: 'free', label: t({ pt: 'Share em endpoint gratuito', en: 'Share on free endpoints' }), values: R.free_share.map((v, i) => (R.weekly_total_T[i] > 0 ? v : null)), slot: '--s3', destaque: true }]}
                tipExtra={tipSemanas(R)}
                rotuloAria={t({
                  pt: `Share do volume em endpoints gratuitos, de ${fmtP(R.free_share[b])} em ${fPer(R.eixo[b], gran)} a ${fmtP(R.free_share[u])} em ${fPer(R.eixo[u], gran)}.`,
                  en: `Share of volume on free endpoints, from ${fmtP(R.free_share[b])} (${fPer(R.eixo[b], gran)}) to ${fmtP(R.free_share[u])} (${fPer(R.eixo[u], gran)}).`,
                })} />
              <TabelaSerie eixo={R.eixo} gran={gran} fmt={v => fmtP(v)} series={[{ label: t({ pt: 'Share gratuito', en: 'Free share' }), values: R.free_share }]} />
              <LeituraFree R={R} b={b} />
            </>
          )}
        </Cartao>
        <ProvedoresSede M={M} />
      </div>
    </Secao>
  );
}
