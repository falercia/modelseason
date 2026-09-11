'use client';
/**
 * Seção 07: para onde vai o dinheiro.
 *
 * Gasto é estimativa a preço de tabela, não medição. A fonte soma prompt e
 * completion sem separar, por isso a linha vem sempre com a banda piso/teto
 * (porte do spendChart() da v1). Volume contra dinheiro põe as duas medidas no
 * mesmo eixo percentual, nunca em dois eixos (porte do vsMoney() da v1). O
 * share do gasto por laboratório é novo na v2.
 */
import { useState } from 'react';
import * as d3 from 'd3';
import type { Mercado } from '@/lib/tipos';
import type { Recorte, Series } from '@/lib/engine';
import type { Fmt } from '@/lib/format';
import { Cartao, Secao } from '@/components/shell/Cartao';
import { useHistorico } from '@/components/shell/Historico';
import { useIdioma } from '@/components/shell/Idioma';
import { usePeriodo } from './s02-comum';
import { Legenda, TabelaSerie, Temporal, cor, useLargura, type ItemSerie, type LinhaTip } from '@/components/graficos/base';
import { LAB_SLOT } from '@/lib/cores';

type Kit = ReturnType<typeof useIdioma>;

/**
 * Formatadores de dinheiro da seção, no idioma de f. Milhões de dólares:
 * "US$ 120 mi", "US$ 1,2 bi", "US$ 0,06 mi" / "$120M", "$1.2B", "$0.06M".
 * Não usa f.fmtUSDm porque aqui há bilhões e duas casas abaixo de um milhão.
 */
function dinheiro(f: Fmt) {
  const pt = f.lang === 'pt';
  const USD = pt ? 'US$ ' : '$', MI = pt ? ' mi' : 'M', BI = pt ? ' bi' : 'B';
  const fmtMi = (v: number) => {
    if (v == null || !isFinite(v)) return '—';
    if (v >= 1000) return USD + f.dec((v / 1000).toFixed(1)) + BI;
    return USD + f.dec(v >= 10 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v.toFixed(2)) + MI;
  };
  const fmtEixoMi = (v: number) => (v >= 1000 ? f.dec(+(v / 1000).toFixed(1)) + BI : f.dec(+v.toFixed(1)) + MI);
  const fmtPreco = (v: number) => USD + f.dec(d3.format('.2f')(v));
  return { fmtMi, fmtEixoMi, fmtPreco };
}

const perDe = (R: Recorte, t: Kit['t']) => (R.estado.gran === 'mes'
  ? t({
      pt: { ult: 'no último mês', ini: 'no primeiro mês', semanal: 'por semana, na média de cada mês' },
      en: { ult: 'in the last month', ini: 'in the first month', semanal: 'per week, averaged over each month' },
    })
  : t({
      pt: { ult: 'na última semana', ini: 'na primeira semana', semanal: 'por semana' },
      en: { ult: 'in the last week', ini: 'in the first week', semanal: 'per week' },
    }));

const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Pill() {
  const { t } = useIdioma();
  return <span className="pill" style={{ marginLeft: 0, marginRight: 6 }}>{t({ pt: 'recorte', en: 'filtered' })}</span>;
}

// ------------------------------------------------------------------ gasto estimado

function Gasto() {
  const { D, R } = useHistorico();
  const { t, f } = useIdioma();
  const { fmtMi, fmtEixoMi, fmtPreco } = dinheiro(f);
  const v = R.spend_total_musd, lo = R.spend_band.piso, hi = R.spend_band.teto, pe = R.preco_efetivo;
  const g = R.estado.gran, u = R.N - 1, p = perDe(R, t);
  const bl = D.blend ?? { prompt: 0.75, completion: 0.25 };
  const semPreco = R.faixa_preco_share['Não identificado'] ?? new Array(R.N).fill(0);
  const sub = t({
    pt: `Milhões de dólares ${p.semanal}, a preço de tabela. A faixa vai de "tudo prompt" a "tudo completion"; a linha usa ${Math.round(bl.prompt * 100)}% prompt.`,
    en: `Millions of dollars ${p.semanal}, at list prices. The band runs from "all prompt" to "all completion"; the line assumes ${Math.round(bl.prompt * 100)}% prompt.`,
  });
  const temGasto = (d3.max(v) ?? 0) > 0;
  const estimativa = t({ pt: 'Estimativa', en: 'Estimate' });
  const serie: ItemSerie[] = [{ key: 'e', label: estimativa, values: v, slot: '--ink-2', destaque: true }];
  const tip = (i: number): LinhaTip[] => [
    { rot: t({ pt: 'Preço efetivo por 1M', en: 'Effective price per 1M' }), val: fmtPreco(pe[i]) },
    { rot: t({ pt: 'Volume sem preço no catálogo', en: 'Volume with no catalog price' }), val: f.fmtP(semPreco[i]) },
    { rot: t({ pt: 'Volume em endpoint gratuito', en: 'Volume on free endpoints' }), val: f.fmtP(R.free_share[i]) },
  ];
  const d0 = f.fPer(R.eixo[0], g), dU = f.fPer(R.eixo[u], g);
  return (
    <Cartao id="spend" titulo={t({
      pt: `Gasto ${g === 'mes' ? 'semanal médio' : 'semanal'} estimado`,
      en: g === 'mes' ? 'Estimated average weekly spend' : 'Estimated weekly spend',
    })} subtitulo={sub}>
      {!temGasto ? <p className="vazio">{t({
        pt: 'Sem gasto estimável no recorte atual: os modelos selecionados não têm preço no catálogo ou só têm tráfego gratuito.',
        en: 'No estimable spend in the current view: the selected models have no catalog price or carry only free traffic.',
      })}</p> : (
        <>
          <Legenda itens={[{ key: 'e', label: estimativa, slot: '--ink-2' }, { key: 'b', label: t({ pt: 'Faixa de piso a teto', en: 'Floor-to-ceiling range' }), slot: 'color-mix(in srgb, var(--ink-2) 22%, transparent)' }]} />
          <Temporal eixo={R.eixo} gran={g} series={serie} fmt={fmtMi} fmtEixo={fmtEixoMi} altura={260}
            banda={{ piso: lo, teto: hi, slot: '--ink-2' }} tipExtra={tip} m={{ t: 12, r: 14, b: 26, l: 52 }}
            rotuloAria={t({
              pt: `Gasto estimado ${p.semanal}, de ${fmtMi(v[0])} em ${d0} a ${fmtMi(v[u])} em ${dU}, com faixa de ${fmtMi(lo[u])} a ${fmtMi(hi[u])} no último período.`,
              en: `Estimated spend ${p.semanal}, from ${fmtMi(v[0])} (${d0}) to ${fmtMi(v[u])} (${dU}), with a range of ${fmtMi(lo[u])} to ${fmtMi(hi[u])} in the last period.`,
            })} />
          <div className="leitura">
            {R.cobertura.filtrando && <Pill />}
            {t({
              pt: <>A preço de tabela, o tráfego {p.ult} da janela ({dU}) equivale a <b>{fmtMi(v[u])}</b> por semana, numa faixa de {fmtMi(lo[u])} a {fmtMi(hi[u])}.
                {' '}{maiuscula(p.ini)} ({d0}) eram {fmtMi(v[0])}. O preço efetivo foi de {fmtPreco(pe[0])} para <b>{fmtPreco(pe[u])}</b> por milhão de tokens.</>,
              en: <>At list prices, traffic {p.ult} of the window ({dU}) comes to <b>{fmtMi(v[u])}</b> per week, within a range of {fmtMi(lo[u])} to {fmtMi(hi[u])}.
                {' '}{maiuscula(p.ini)} ({d0}) it was {fmtMi(v[0])}. The effective price went from {fmtPreco(pe[0])} to <b>{fmtPreco(pe[u])}</b> per million tokens.</>,
            })}
            {' '}{semPreco[0] - semPreco[u] >= 10
              ? t({
                  pt: <>Boa parte da subida no começo da série é cobertura, não gasto: {f.fmtP(semPreco[0])} do volume inicial vinha de modelos sem preço no catálogo, que entram como zero, contra {f.fmtP(semPreco[u])} no fim.</>,
                  en: <>Much of the rise at the start of the series is coverage, not spend: {f.fmtP(semPreco[0])} of the initial volume came from models with no catalog price, which count as zero, versus {f.fmtP(semPreco[u])} at the end.</>,
                })
              : t({
                  pt: <>Volume sem preço no catálogo, que entra como zero: {f.fmtP(semPreco[u])} no fim da janela.</>,
                  en: <>Volume with no catalog price, which counts as zero: {f.fmtP(semPreco[u])} at the end of the window.</>,
                })}
            {' '}{t({
              pt: <>Tráfego em endpoint gratuito ({f.fmtP(R.free_share[u])} no fim) também custa zero.</>,
              en: <>Traffic on free endpoints ({f.fmtP(R.free_share[u])} at the end) also costs zero.</>,
            })}
          </div>
          <div className="nao">{t({
            pt: <><b>Preço de hoje aplicado ao passado.</b> O catálogo guarda só o preço vigente, então todo o histórico é recalculado com a tabela de hoje. Modelo que ficou mais barato tem o gasto passado superestimado, e o que encareceu, subestimado. A correção depende do histórico de preços, que ainda não existe.</>,
            en: <><b>Today&apos;s prices applied to the past.</b> The catalog keeps only the current price, so the whole history is recalculated with today&apos;s price list. A model that got cheaper has its past spend overstated, and one that got pricier, understated. Correcting this requires a price history, which does not exist yet.</>,
          })}</div>
          <TabelaSerie eixo={R.eixo} gran={g} fmt={x => f.dec(x.toFixed(2))}
            series={[
              { label: t({ pt: 'Estimativa (US$ mi)', en: 'Estimate ($M)' }), values: v },
              { label: t({ pt: 'Piso (US$ mi)', en: 'Floor ($M)' }), values: lo },
              { label: t({ pt: 'Teto (US$ mi)', en: 'Ceiling ($M)' }), values: hi },
              { label: t({ pt: 'US$ por 1M tokens', en: '$ per 1M tokens' }), values: pe },
            ]} />
        </>
      )}
    </Cartao>
  );
}

// ------------------------------------------------------------------ volume contra dinheiro

const MIN_TOK = 0.5; // share de tokens mínimo para entrar nas barras, como na v1
const MAX_LABS = 10;

type LinhaVD = Recorte['volume_vs_dinheiro'][number];

function VolumeDinheiro() {
  const { R } = useHistorico();
  const { t, f } = useIdioma();
  const g = R.estado.gran, u = R.N - 1, p = perDe(R, t);
  const rows = R.volume_vs_dinheiro.filter(r => r.share_tokens >= MIN_TOK).slice(0, MAX_LABS);
  const sub = t({
    pt: `Share de tokens e share do gasto estimado ${p.ult} da janela (${f.fPer(R.eixo[u], g)}), laboratórios com pelo menos ${f.fmtP(MIN_TOK)} dos tokens. Barras iguais significam preço médio do mercado.`,
    en: `Token share and estimated spend share ${p.ult} of the window (${f.fPer(R.eixo[u], g)}), for labs with at least ${f.fmtP(MIN_TOK)} of tokens. Equal bars mean the market's average price.`,
  });
  if (!rows.length) return <Cartao id="vsmoney" subtitulo={sub}><p className="vazio">{t({ pt: 'Sem laboratórios com volume suficiente no recorte atual.', en: 'No lab has enough volume in the current view.' })}</p></Cartao>;
  return <BarrasPareadas rows={rows} sub={sub} R={R} />;
}

function BarrasPareadas({ rows, sub, R }: { rows: LinhaVD[]; sub: string; R: Recorte }) {
  const { t, f, lab } = useIdioma();
  const [ref, w] = useLargura<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const p = perDe(R, t);
  const estreito = w < 480;
  const m = { t: 18, r: estreito ? 50 : 64, b: 24, l: estreito ? 84 : 112 };
  const faixa = 34, h = m.t + m.b + rows.length * faixa;
  const max = (d3.max(rows, r => Math.max(r.share_tokens, r.share_gasto)) ?? 1) * 1.08;
  const x = d3.scaleLinear().domain([0, max]).nice(4).range([m.l, w - m.r]);
  const y = d3.scaleBand().domain(rows.map(r => r.lab)).range([m.t, h - m.b]).paddingInner(0.3).paddingOuter(0.1);
  const bh = Math.max(4, y.bandwidth() / 2 - 1);
  const fmtR = (r: number | null) => (r == null ? '—' : f.dec(r.toFixed(2)) + '×');
  const TOK = '--s0', USD = '--ink-2';
  const shareTok = t({ pt: 'Share de tokens', en: 'Token share' });
  const shareGasto = t({ pt: 'Share do gasto', en: 'Spend share' });

  // leitura, como no readings() da v1, sem a frase fixa sobre origem
  const vd = R.volume_vs_dinheiro.filter(r => r.razao != null && r.share_tokens >= 1);
  const comPreco = vd.filter(r => (r.razao as number) > 0);
  const caro = [...comPreco].sort((a, b) => (b.razao as number) - (a.razao as number))[0];
  const barato = [...comPreco].sort((a, b) => (a.razao as number) - (b.razao as number))[0];
  const zerados = vd.filter(r => r.razao === 0);
  const tr = hover != null ? rows[hover] : null;

  return (
    <Cartao id="vsmoney" subtitulo={sub}>
      <Legenda itens={[{ key: 't', label: shareTok, slot: TOK }, { key: 'g', label: t({ pt: 'Share do gasto estimado', en: 'Estimated spend share' }), slot: USD }]} />
      <div className="plot" ref={ref} onPointerLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${w} ${h}`} style={{ height: h }} role="img"
          aria-label={t({
            pt: `Barras pareadas por laboratório: share de tokens e share do gasto ${p.ult}. ${rows.map(r => `${lab(r.lab)}: ${f.fmtP(r.share_tokens)} dos tokens, ${f.fmtP(r.share_gasto)} do gasto`).join('; ')}.`,
            en: `Paired bars by lab: token share and spend share ${p.ult}. ${rows.map(r => `${lab(r.lab)}: ${f.fmtP(r.share_tokens)} of tokens, ${f.fmtP(r.share_gasto)} of spend`).join('; ')}.`,
          })}>
          <g className="grid">{x.ticks(4).map(v => <line key={v} x1={x(v)} x2={x(v)} y1={m.t} y2={h - m.b} />)}</g>
          <g className="ax">{x.ticks(4).map(v => <text key={v} x={x(v)} y={h - m.b + 15} textAnchor="middle">{v}%</text>)}</g>
          <text className="ax" x={w - m.r + 8} y={m.t - 6} style={{ fill: 'var(--ink-3)' }}>{t({ pt: 'razão', en: 'ratio' })}</text>
          {rows.map((r, i) => {
            const y0 = y(r.lab)!, forte = r.razao != null && r.razao >= 1.3;
            return (
              <g key={r.lab} opacity={hover != null && hover !== i ? 0.55 : 1}>
                <text x={m.l - 8} y={y0 + y.bandwidth() / 2 + 4} textAnchor="end" style={{ fill: 'var(--ink-2)', fontSize: 12 }}>{lab(r.lab)}</text>
                <rect x={m.l} y={y0} width={Math.max(1.5, x(r.share_tokens) - m.l)} height={bh} rx={2} fill={cor(TOK)} />
                <rect x={m.l} y={y0 + bh + 2} width={Math.max(1.5, x(r.share_gasto) - m.l)} height={bh} rx={2} fill={cor(USD)} />
                <text x={w - m.r + 8} y={y0 + y.bandwidth() / 2 + 4} className="mono"
                  style={{ fill: forte ? 'var(--ink)' : 'var(--ink-3)', fontWeight: forte ? 700 : 500, fontSize: 11.5 }}>{fmtR(r.razao)}</text>
                <rect x={0} y={y0 - 3} width={w} height={y.bandwidth() + 6} fill="transparent"
                  onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)} />
              </g>
            );
          })}
        </svg>
        {tr && hover != null && (
          <div className="tip" style={{ left: Math.min(m.l + 10, Math.max(0, w - 240)), top: (y(tr.lab) ?? 0) + y.bandwidth() + 4 }}>
            <div className="t">{lab(tr.lab)}</div>
            <div className="r"><span><i style={{ background: cor(TOK) }} />{shareTok}</span><b>{f.fmtP(tr.share_tokens)}</b></div>
            <div className="r"><span><i style={{ background: cor(USD) }} />{shareGasto}</span><b>{f.fmtP(tr.share_gasto)}</b></div>
            <div className="r"><span>{t({ pt: 'Razão gasto/tokens', en: 'Spend/token ratio' })}</span><b>{fmtR(tr.razao)}</b></div>
          </div>
        )}
      </div>
      <div className="leitura">
        {R.cobertura.filtrando && <Pill />}
        {caro && barato && caro.lab !== barato.lab ? t({
          pt: <>
            <b>{lab(caro.lab)}</b> tem {f.fmtP(caro.share_tokens)} dos tokens e <b>{f.fmtP(caro.share_gasto)}</b> do dinheiro, razão de <b>{fmtR(caro.razao)}</b>.
            {' '}No outro extremo, <b>{lab(barato.lab)}</b> tem {f.fmtP(barato.share_tokens)} dos tokens e {f.fmtP(barato.share_gasto)} do dinheiro, razão de {fmtR(barato.razao)}.
          </>,
          en: <>
            <b>{lab(caro.lab)}</b> has {f.fmtP(caro.share_tokens)} of tokens and <b>{f.fmtP(caro.share_gasto)}</b> of the money, a ratio of <b>{fmtR(caro.razao)}</b>.
            {' '}At the other end, <b>{lab(barato.lab)}</b> has {f.fmtP(barato.share_tokens)} of tokens and {f.fmtP(barato.share_gasto)} of the money, a ratio of {fmtR(barato.razao)}.
          </>,
        }) : t({
          pt: <>Poucos laboratórios com preço no recorte para comparar extremos.</>,
          en: <>Too few labs with a price in this view to compare extremes.</>,
        })}
        {zerados.length > 0 && t({
          pt: <> {f.lista(zerados.map(r => lab(r.lab)))} {zerados.length === 1 ? 'aparece' : 'aparecem'} com gasto zero apesar do volume: todo o tráfego está em endpoint gratuito ou em modelo sem preço no catálogo.</>,
          en: <> {f.lista(zerados.map(r => lab(r.lab)))} {zerados.length === 1 ? 'shows' : 'show'} zero spend despite the volume: all of the traffic is on free endpoints or on models with no catalog price.</>,
        })}
        {' '}{t({
          pt: 'Share de tokens favorece quem cobra menos; para decisão de contrato, a razão diz mais, porque aproxima o posicionamento de preço de cada laboratório dentro do uso real.',
          en: 'Token share favors whoever charges less; for a contract decision the ratio says more, because it approximates where each lab is priced within real usage.',
        })}
      </div>
      <details className="tab">
        <summary>{t({ pt: 'Ver os números', en: 'See the numbers' })}</summary>
        <div className="tabwrap">
          <table className="t">
            <thead><tr><th>{t({ pt: 'Laboratório', en: 'Lab' })}</th><th className="num">{shareTok}</th><th className="num">{shareGasto}</th><th className="num">{t({ pt: 'Razão', en: 'Ratio' })}</th></tr></thead>
            <tbody>{rows.map(r => (
              <tr key={r.lab}><td>{lab(r.lab)}</td><td className="num">{f.fmtP(r.share_tokens)}</td><td className="num">{f.fmtP(r.share_gasto)}</td><td className="num">{fmtR(r.razao)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </details>
    </Cartao>
  );
}

// ------------------------------------------------------------------ gasto por laboratório

/** Quatro laboratórios com cor fixa (LAB_SLOT); todo o resto dobra em Outros. */
const NOMEADOS = Object.keys(LAB_SLOT).filter(k => k !== 'Outros');

function dobrar(S: Series, N: number, lab: Kit['lab']) {
  const nomeados = NOMEADOS.filter(k => S[k]?.some(v => v > 0));
  const resto = Object.keys(S).filter(k => !nomeados.includes(k));
  const outros = Array.from({ length: N }, (_, i) => +resto.reduce((s, k) => s + (S[k][i] ?? 0), 0).toFixed(2));
  const series: ItemSerie[] = nomeados.map(k => ({ key: k, label: lab(k), values: S[k], slot: LAB_SLOT[k] }));
  if (outros.some(v => v > 0)) series.push({ key: 'Outros', label: lab('Outros'), values: outros, slot: '--s0' });
  // Quem está dentro de Outros, por período (o motor já dobrou além do 8º em "Outros").
  const dentro = (i: number) => resto.filter(k => k !== 'Outros').map(k => ({ k, v: S[k][i] ?? 0 })).filter(o => o.v > 0).sort((a, b) => b.v - a.v);
  return { series, dentro, resto };
}

function GastoLab() {
  const { R } = useHistorico();
  const { t, f, lab } = useIdioma();
  const { naQuando } = usePeriodo();
  const g = R.estado.gran, u = R.N - 1;
  const S = R.spend_share;
  const temGasto = (d3.max(R.spend_total_musd) ?? 0) > 0;
  const { series, dentro } = dobrar(S, R.N, lab);
  const tip = (i: number): LinhaTip[] => {
    const d = dentro(i);
    if (!d.length) return [];
    return [{ rot: t({ pt: 'dentro de Outros', en: 'inside Other' }), val: '' }, ...d.slice(0, 4).map(o => ({ rot: '↳ ' + lab(o.k), val: f.fmtP(o.v) }))];
  };
  // leitura: maior fatia individual no início e no fim, inclusive a que está em Outros
  const individuais = Object.keys(S).filter(k => k !== 'Outros');
  const maior = (i: number) => [...individuais].sort((a, b) => (S[b][i] ?? 0) - (S[a][i] ?? 0))[0];
  const m0 = maior(0), mU = maior(u);
  const emOutros = mU && !NOMEADOS.includes(mU);
  const tokMU = R.volume_vs_dinheiro.find(r => r.lab === mU);
  const outrosU = series.find(s => s.key === 'Outros')?.values[u] ?? 0;
  const d0 = f.fPer(R.eixo[0], g), dU = f.fPer(R.eixo[u], g);
  return (
    <Cartao id="gasto-lab" novo>
      {!temGasto || !series.length ? <p className="vazio">{t({ pt: 'Sem gasto estimável no recorte atual.', en: 'No estimable spend in the current view.' })}</p> : (
        <>
          <Legenda itens={series} />
          <Temporal eixo={R.eixo} gran={g} series={series} modo="empilhada" ymax={100} altura={300} fmt={v => f.fmtP(v)} fmtEixo={v => v + '%'}
            tipExtra={tip} m={{ t: 10, r: 10, b: 26, l: 38 }}
            rotuloAria={t({
              pt: `Área empilhada 100%: share do gasto estimado por laboratório, de ${d0} a ${dU}. ${series.map(s => `${s.label} ${f.fmtP(s.values[u] ?? 0)}`).join(', ')} no último período.`,
              en: `100% stacked area: estimated spend share by lab, from ${d0} to ${dU}. ${series.map(s => `${s.label} ${f.fmtP(s.values[u] ?? 0)}`).join(', ')} in the last period.`,
            })} />
          <div className="leitura">
            {R.cobertura.filtrando && <Pill />}
            {m0 && t({
              pt: <>Em {d0}, a maior fatia do gasto era de <b>{lab(m0)}</b> ({f.fmtP(S[m0][0])}). </>,
              en: <>{maiuscula(naQuando(R, 0))}, the largest share of spend belonged to <b>{lab(m0)}</b> ({f.fmtP(S[m0][0])}). </>,
            })}
            {mU && t({
              pt: <>Em {dU}, é de <b>{lab(mU)}</b>, com <b>{f.fmtP(S[mU][u])}</b>{tokMU ? <> do dinheiro e {f.fmtP(tokMU.share_tokens)} dos tokens</> : null}. </>,
              en: <>{maiuscula(naQuando(R, u))}, it belongs to <b>{lab(mU)}</b>, with <b>{f.fmtP(S[mU][u])}</b>{tokMU ? <> of the money and {f.fmtP(tokMU.share_tokens)} of tokens</> : null}. </>,
            })}
            {emOutros && t({
              pt: <>{lab(mU)} não tem cor própria: as quatro cores fixas são dos laboratórios de maior volume acumulado ({f.lista(NOMEADOS.map(k => lab(k)))}), e o resto dobra em Outros, que soma {f.fmtP(outrosU)} no fim. Passe o cursor para ver quem está dentro.</>,
              en: <>{lab(mU)} has no color of its own: the four fixed colors belong to the labs with the largest cumulative volume ({f.lista(NOMEADOS.map(k => lab(k)))}), and the rest folds into Other, which adds up to {f.fmtP(outrosU)} at the end. Hover to see who is inside.</>,
            })}
          </div>
          <TabelaSerie eixo={R.eixo} gran={g} fmt={v => f.fmtP(v)}
            series={[...series.map(s => ({ label: s.label, values: s.values })), ...individuais.filter(k => !NOMEADOS.includes(k)).map(k => ({ label: '↳ ' + lab(k), values: S[k] }))]} />
        </>
      )}
    </Cartao>
  );
}

export default function S07(_: { M: Mercado }) {
  const { t } = useIdioma();
  return (
    <Secao id="s07" n="07" titulo={t({ pt: 'Para onde vai o dinheiro', en: 'Where the money goes' })}
      sub={t({
        pt: 'Tokens multiplicados pelo preço de tabela de cada modelo. Estimativa, não medição: a fonte não separa prompt de completion, e o preço é o de hoje.',
        en: "Tokens multiplied by each model's list price. An estimate, not a measurement: the source does not split prompt from completion, and the price is today's.",
      })}>
      <Gasto />
      <div className="grid2" style={{ marginTop: 14 }}>
        <VolumeDinheiro />
        <GastoLab />
      </div>
    </Secao>
  );
}
