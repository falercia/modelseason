'use client';
/**
 * Seção 10: ciclo de vida dos modelos. Rotatividade e idade do top 10 respondem
 * à janela e ao agrupamento (são séries do motor); coortes e a forma de uma
 * temporada descrevem o histórico completo e dizem isso no subtítulo, como na v1.
 */
import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import * as d3 from 'd3';
import type { Mercado } from '@/lib/tipos';
import { Cartao, Secao } from '@/components/shell/Cartao';
import { useHistorico } from '@/components/shell/Historico';
import { useIdioma } from '@/components/shell/Idioma';
import { Legenda, TabelaSerie, Temporal, cor, useLargura } from '@/components/graficos/base';
import type { Recorte, Vida } from '@/lib/engine';
import { CartaoVida, rotTri, type Trajetoria } from './s10-trajetoria';
import { rotulador } from './s09-nomes';
import { usePeriodo } from './s02-comum';

type Kit = ReturnType<typeof useIdioma>;

const semFiltro = (R: Recorte, t: Kit['t']) => R.cobertura.filtrando
  ? <p className="nota">{t({
    pt: 'Este indicador é definido sobre o mercado inteiro e não responde aos filtros de modelo, só à janela e ao agrupamento.',
    en: 'This indicator is defined over the whole market and does not respond to the model filters, only to the window and the grouping.',
  })}</p>
  : null;

/** Primeira letra maiúscula, para frase que começa com "in the week of". */
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Índice e valor extremos de uma série com buracos. */
function extremos(s: (number | null)[]) {
  const ii = s.map((v, i) => [v, i] as [number | null, number]).filter((p): p is [number, number] => p[0] != null);
  if (!ii.length) return null;
  const min = ii.reduce((a, b) => (b[0] < a[0] ? b : a)), max = ii.reduce((a, b) => (b[0] > a[0] ? b : a));
  return { min, max, med: d3.median(ii, p => p[0])!, n: ii.length };
}

// ------------------------------------------------------------------ rotatividade

function CartaoChurn({ R }: { R: Recorte }) {
  const { t, f, modelo } = useIdioma();
  const { naQuando } = usePeriodo();
  const gran = R.estado.gran, ult = R.N - 1;
  const mes = gran === 'mes';
  const fmt = (v: number) => (mes ? f.fmtNum(v, 1) : String(Math.round(v)));
  const ex = extremos(R.churn);
  const v1 = R.churn[ult];
  const top10 = R.cobertura.filtrando ? [] : R.boards.last.slice(0, 10);
  const rot = rotulador(top10.map(r => r.model), f);
  const novos = new Set(!mes && !R.cobertura.filtrando ? R.mudancas.entraram : []);
  const rotSerie = t({ pt: 'Novos no top 10', en: 'New in the top 10' });
  return (
    <Cartao id="churn" subtitulo={t({
      pt: <>Quantos dos 10 mais usados não estavam no top 10 quatro semanas antes{mes ? '; média das semanas do mês' : ''}. De 0 (topo congelado) a 10 (topo trocado)</>,
      en: <>How many of the 10 most used models were not in the top 10 four weeks earlier{mes ? '; average of the weeks in the month' : ''}. From 0 (frozen top) to 10 (fully replaced top)</>,
    })}>
      {ex ? <>
        <Temporal eixo={R.eixo} gran={gran} series={[{ key: 'churn', label: rotSerie, values: R.churn, slot: '--s2' }]}
          modo="linhas" fmt={fmt} ymax={10} inteiro altura={220}
          rotuloAria={t({
            pt: `Rotatividade do top 10 de ${f.fPer(R.eixo[0], gran)} a ${f.fPer(R.eixo[ult], gran)}: mediana de ${f.fmtNum(ex.med, 1)} modelos novos a cada quatro semanas.`,
            en: `Top-10 turnover from ${f.fPer(R.eixo[0], gran)} to ${f.fPer(R.eixo[ult], gran)}: a median of ${f.fmtNum(ex.med, 1)} new models every four weeks.`,
          })} />
        <TabelaSerie eixo={R.eixo} gran={gran} series={[{ label: rotSerie, values: R.churn }]} fmt={fmt} />
        <p className="leitura">
          {t({
            pt: <>Na janela, em mediana <b>{f.fmtNum(ex.med, 1)}</b> dos 10 mais usados são novos em relação a quatro semanas antes.</>,
            en: <>In the window, a median of <b>{f.fmtNum(ex.med, 1)}</b> of the 10 most used models are new compared with four weeks earlier.</>,
          })}
          {v1 != null && (mes
            ? t({ pt: <> No último mês, a média foi {fmt(v1)}.</>, en: <> In the last month, the average was {fmt(v1)}.</> })
            : t({ pt: <> No último período, foram {fmt(v1)}.</>, en: <> In the last period, there were {fmt(v1)}.</> }))}
          {t({
            pt: <> O pico foi {fmt(ex.max[0])}, em {f.fPer(R.eixo[ex.max[1]], gran)}.</>,
            en: <> The peak was {fmt(ex.max[0])}, {naQuando(R, ex.max[1])}.</>,
          })}
          {top10.length > 0 && <>{t({
            pt: <> Os 10 de {f.fPer(R.eixo[ult], gran)}, em ordem de volume: </>,
            en: <> The top 10 {naQuando(R, ult)}, by volume: </>,
          })}{top10.map((r, i) => (
            <span key={r.model}><Link prefetch={false} href={modelo(r.model)} className="mono" style={{ color: 'var(--ink)', fontSize: 11.5 }}>{rot(r.model)}</Link>{novos.has(r.model) ? <span className="pill">{t({ pt: 'novo', en: 'new' })}</span> : null}{i < top10.length - 1 ? ', ' : '.'}</span>
          ))}</>}
        </p>
      </> : <p className="vazio">{t({
        pt: 'A série de rotatividade só começa quatro semanas depois do início dos dados, e esta janela inteira fica antes disso.',
        en: 'The turnover series only starts four weeks after the data begins, and this entire window falls before that.',
      })}</p>}
      {semFiltro(R, t)}
    </Cartao>
  );
}

// ------------------------------------------------------------------ idade

function CartaoIdade({ R }: { R: Recorte }) {
  const { t, f } = useIdioma();
  const { naQuando } = usePeriodo();
  const gran = R.estado.gran, ult = R.N - 1;
  const fmt = (v: number) => f.fmtNum(v, 1) + t({ pt: ' sem', en: ' wk' });
  const ex = extremos(R.age);
  const v1 = R.age[ult];
  return (
    <Cartao id="age">
      {ex ? <>
        <Temporal eixo={R.eixo} gran={gran} series={[{ key: 'age', label: t({ pt: 'Idade mediana', en: 'Median age' }), values: R.age, slot: '--s4' }]}
          modo="linhas" fmt={fmt} fmtEixo={v => String(Math.round(v))} altura={220}
          rotuloAria={t({
            pt: `Idade mediana do top 10 em semanas desde a estreia no ranking, de ${f.fPer(R.eixo[0], gran)} a ${f.fPer(R.eixo[ult], gran)}.`,
            en: `Median age of the top 10 in weeks since ranking debut, from ${f.fPer(R.eixo[0], gran)} to ${f.fPer(R.eixo[ult], gran)}.`,
          })} />
        <TabelaSerie eixo={R.eixo} gran={gran} series={[{ label: t({ pt: 'Idade mediana (semanas)', en: 'Median age (weeks)' }), values: R.age }]} fmt={fmt} />
        <p className="leitura">
          {v1 != null && t({
            pt: <>Em {f.fPer(R.eixo[ult], gran)}, a idade mediana dos 10 mais usados é de <b>{fmt(v1)}</b> desde a estreia no ranking. </>,
            en: <>{cap(naQuando(R, ult))}, the 10 most used models have a median age of <b>{fmt(v1)}</b> since their ranking debut. </>,
          })}
          {t({
            pt: <>Na janela, variou de {fmt(ex.min[0])} ({f.fPer(R.eixo[ex.min[1]], gran)}) a {fmt(ex.max[0])} ({f.fPer(R.eixo[ex.max[1]], gran)}).</>,
            en: <>In the window, it ranged from {fmt(ex.min[0])} ({f.fPer(R.eixo[ex.min[1]], gran)}) to {fmt(ex.max[0])} ({f.fPer(R.eixo[ex.max[1]], gran)}).</>,
          })}
          {ex.n < R.N && t({
            pt: <> Os primeiros períodos ficam de fora porque caem nas semanas censuradas do início da série.</>,
            en: <> The first periods are left out because they fall in the censored weeks at the start of the series.</>,
          })}
        </p>
      </> : <p className="vazio">{t({
        pt: 'A janela inteira cai nas primeiras semanas da série, que são censuradas: não se sabe quando os modelos presentes em janeiro de 2025 estrearam de fato.',
        en: 'The entire window falls in the first weeks of the series, which are censored: there is no way to know when the models present in January 2025 actually debuted.',
      })}</p>}
      {semFiltro(R, t)}
    </Cartao>
  );
}

// ------------------------------------------------------------------ coortes

interface Coorte { q: string; n: number; ttp: number; half: number | null; nHalf: number; vivos: number }

/** Chave do trimestre ('2025 Q1'), igual nos dois idiomas; o rótulo sai por rotTri. */
function trimestre(iso: string) { const d = new Date(iso + 'T00:00:00'); return `${d.getFullYear()} Q${Math.floor(d.getMonth() / 3) + 1}`; }

function BarrasCoorte({ linhas }: { linhas: Coorte[] }) {
  const { t, f } = useIdioma();
  const [ref, w] = useLargura<HTMLDivElement>();
  const [hi, setHi] = useState<number | null>(null);
  const altura = 270, m = { t: 20, r: 10, b: 42, l: 34 };
  const x0 = d3.scaleBand().domain(linhas.map(r => r.q)).range([m.l, w - m.r]).paddingInner(0.28).paddingOuter(0.1);
  const chaves = [['ttp', '--s1'], ['half', '--s2']] as const;
  const x1 = d3.scaleBand().domain(chaves.map(k => k[0])).range([0, x0.bandwidth()]).paddingInner(0.12);
  const topo = d3.max(linhas, r => Math.max(r.ttp, r.half ?? 0)) ?? 1;
  const y = d3.scaleLinear().domain([0, topo * 1.15 || 1]).nice(4).range([altura - m.b, m.t]);
  const yt = y.ticks(4);
  const estreito = x1.bandwidth() < 22;
  return (
    <div className="plot" ref={ref} onPointerLeave={() => setHi(null)}>
      <svg viewBox={`0 0 ${w} ${altura}`} role="img" style={{ height: altura }}
        aria-label={t({
          pt: `Mediana de semanas até o pico e de meia-vida por trimestre de lançamento: ${linhas.map(r => `${rotTri(r.q, f)}, ${f.fmtNum(r.ttp, 1)} e ${r.half == null ? 'sem meia-vida' : f.fmtNum(r.half, 1)}`).join('; ')}.`,
          en: `Median weeks to peak and half-life by debut quarter: ${linhas.map(r => `${rotTri(r.q, f)}, ${f.fmtNum(r.ttp, 1)} and ${r.half == null ? 'no half-life' : f.fmtNum(r.half, 1)}`).join('; ')}.`,
        })}>
        <g className="grid">{yt.map(v => <line key={v} x1={m.l} x2={w - m.r} y1={y(v)} y2={y(v)} />)}</g>
        <g className="ax">
          {yt.map(v => <text key={v} x={m.l - 7} y={y(v) + 3.5} textAnchor="end">{String(Math.round(v))}</text>)}
          {linhas.map(r => (
            <g key={r.q}>
              <text x={x0(r.q)! + x0.bandwidth() / 2} y={altura - m.b + 16} textAnchor="middle" style={{ fill: 'var(--ink-2)' }}>{rotTri(r.q, f)}</text>
              <text x={x0(r.q)! + x0.bandwidth() / 2} y={altura - m.b + 30} textAnchor="middle">n={r.n}</text>
            </g>
          ))}
        </g>
        {linhas.map((r, i) => {
          const censurada = r.vivos >= 0.5;
          return (
            <g key={r.q} transform={`translate(${x0(r.q)},0)`} opacity={hi == null || hi === i ? 1 : 0.45}>
              {chaves.map(([k, slot]) => {
                const v = r[k];
                if (v == null) return <text key={k} className="ax" x={x1(k)! + x1.bandwidth() / 2} y={y(0) - 5} textAnchor="middle">—</text>;
                const aberta = k === 'half' && censurada;
                return (
                  <g key={k}>
                    <rect x={x1(k)} y={y(v)} width={x1.bandwidth()} height={Math.max(0, y(0) - y(v))} rx={3}
                      fill={cor(slot)} fillOpacity={aberta ? 0.16 : 1} stroke={aberta ? cor(slot) : 'none'} strokeWidth={aberta ? 1.5 : 0} strokeDasharray={aberta ? '3 2' : undefined} />
                    {!estreito && <text className="ax" x={x1(k)! + x1.bandwidth() / 2} y={y(v) - 5} textAnchor="middle" style={{ fill: 'var(--ink-2)' }}>{f.fmtNum(v, 1)}{aberta ? '*' : ''}</text>}
                  </g>
                );
              })}
            </g>
          );
        })}
        <line x1={m.l} x2={w - m.r} y1={y(0)} y2={y(0)} stroke="var(--axis)" />
        {linhas.map((r, i) => (
          <rect key={r.q} x={x0(r.q)! - x0.step() * x0.paddingInner() / 2} y={m.t} width={x0.step()} height={altura - m.t - m.b} fill="transparent"
            onPointerEnter={() => setHi(i)} onPointerDown={() => setHi(i)} />
        ))}
      </svg>
      {hi != null && linhas[hi] && (() => {
        const r = linhas[hi];
        return (
          <div className="tip" style={{ left: Math.min(Math.max(0, x0(r.q)! + x0.bandwidth() + 6), Math.max(0, w - 240)), top: 4 }}>
            <div className="t">{t({ pt: `Lançados em ${rotTri(r.q, f)} · ${r.n} modelos`, en: `Debuted in ${rotTri(r.q, f)} · ${r.n} ${r.n === 1 ? 'model' : 'models'}` })}</div>
            <div className="r"><span><i style={{ background: cor('--s1') }} />{t({ pt: 'Semanas até o pico', en: 'Weeks to peak' })}</span><b>{f.fmtNum(r.ttp, 1)}</b></div>
            <div className="r"><span><i style={{ background: cor('--s2') }} />{t({ pt: 'Meia-vida após o pico', en: 'Half-life after peak' })}</span><b>{r.half == null
              ? t({ pt: 'nenhum caiu à metade', en: 'none down to half yet' })
              : t({ pt: `${f.fmtNum(r.half, 1)} (${r.nHalf} de ${r.n})`, en: `${f.fmtNum(r.half, 1)} (${r.nHalf} of ${r.n})` })}</b></div>
            <div className="r"><span>{t({ pt: 'Ainda acima de metade do pico', en: 'Still above half their peak' })}</span><b>{Math.round(100 * r.vivos)}%</b></div>
          </div>
        );
      })()}
    </div>
  );
}

function CartaoCoorte({ life, desde }: { life: Vida[]; desde: string }) {
  const { t, f } = useIdioma();
  const linhas: Coorte[] = d3.rollups(life, v => ({
    n: v.length,
    ttp: d3.median(v, m => m.weeks_to_peak) ?? 0,
    half: d3.median(v.filter(m => m.half_life_weeks != null), m => m.half_life_weeks as number) ?? null,
    nHalf: v.filter(m => m.half_life_weeks != null).length,
    vivos: d3.mean(v, m => (m.still_alive ? 1 : 0)) ?? 0,
  }), m => trimestre(m.first)).sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([q, o]) => ({ q, ...o }));
  const ttpG = d3.median(life, m => m.weeks_to_peak);
  const halfG = d3.median(life.filter(m => m.half_life_weeks != null), m => m.half_life_weeks as number);
  const primeira = linhas[0];
  // A comparação honesta é com a coorte mais recente em que a maioria já caiu à metade.
  const fechada = [...linhas].reverse().find(r => r.vivos < 0.5 && r.half != null && r !== primeira);
  const abertas = linhas.filter(r => r.vivos >= 0.5);
  /** "week" ou "weeks" pelo número já formatado: 1 semana não vira "1 weeks". */
  const wk = (v: number | undefined) => (f.fmtNum(v, 1) === '1' ? 'week' : 'weeks');
  return (
    <Cartao id="cohort" subtitulo={t({
      pt: <>Mediana em semanas, modelos que chegaram a 2% do volume semanal, por trimestre de estreia no ranking. Histórico completo desde {desde}: não responde à janela nem ao agrupamento</>,
      en: <>Median in weeks, models that reached 2% of weekly volume, by quarter of ranking debut. Full history since {desde}: does not respond to the window or the grouping</>,
    })}>
      <Legenda itens={[
        { key: 'ttp', label: t({ pt: 'Semanas até o pico', en: 'Weeks to peak' }), slot: '--s1' },
        { key: 'half', label: t({ pt: 'Meia-vida após o pico', en: 'Half-life after peak' }), slot: '--s2' },
      ]} />
      <BarrasCoorte linhas={linhas} />
      {abertas.length > 0 && <p className="nota" style={{ marginTop: 4 }}>{t({
        pt: <>* Barra tracejada: {abertas.length === 1 ? 'na coorte' : 'nas coortes'} {abertas.map(r => rotTri(r.q, f)).join(', ')}, metade ou mais dos modelos ainda está acima de metade do pico. A meia-vida delas só conta quem já caiu, então tende a subir.</>,
        en: <>* Dashed bar: in the {f.lista(abertas.map(r => rotTri(r.q, f)))} {abertas.length === 1 ? 'cohort' : 'cohorts'}, half or more of the models are still above half their peak. Their half-life only counts models that have already fallen, so it tends to rise.</>,
      })}</p>}
      <details className="tab">
        <summary>{t({ pt: 'Ver os números', en: 'See the numbers' })}</summary>
        <div className="tabwrap">
          <table className="t">
            <thead><tr>
              <th>{t({ pt: 'Trimestre', en: 'Quarter' })}</th><th className="num">n</th><th className="num">{t({ pt: 'Sem. até o pico', en: 'Wks to peak' })}</th>
              <th className="num">{t({ pt: 'Meia-vida', en: 'Half-life' })}</th><th className="num">{t({ pt: 'Com meia-vida', en: 'With half-life' })}</th>
              <th className="num">{t({ pt: 'Acima de metade do pico', en: 'Above half of peak' })}</th>
            </tr></thead>
            <tbody>{linhas.map(r => (
              <tr key={r.q}><td>{rotTri(r.q, f)}</td><td className="num">{r.n}</td><td className="num">{f.fmtNum(r.ttp, 1)}</td><td className="num">{r.half == null ? '—' : f.fmtNum(r.half, 1)}</td><td className="num">{r.nHalf}</td><td className="num">{Math.round(100 * r.vivos)}%</td></tr>
            ))}</tbody>
          </table>
        </div>
      </details>
      <p className="leitura">{t({
        pt: <>
          Nos {life.length} modelos, a mediana é de <b>{f.fmtNum(ttpG, 1)} semanas</b> até o pico e <b>{f.fmtNum(halfG, 1)} semanas</b> do pico até perder metade dele.
          {primeira && fechada && primeira.half != null && <> A coorte {rotTri(primeira.q, f)} levou {f.fmtNum(primeira.ttp, 1)} semanas até o pico e {f.fmtNum(primeira.half, 1)} de meia-vida; a de {rotTri(fechada.q, f)}, a mais recente em que a maioria já caiu, {f.fmtNum(fechada.ttp, 1)} e {f.fmtNum(fechada.half, 1)}.</>}
          {primeira && <> A coorte {rotTri(primeira.q, f)} inclui os modelos que já existiam quando a série começa, em {desde}: para eles, a contagem até o pico parte dessa data, não do lançamento.</>}
        </>,
        en: <>
          Across the {life.length} models, the median is <b>{f.fmtNum(ttpG, 1)} {wk(ttpG)}</b> to peak and <b>{f.fmtNum(halfG, 1)} {wk(halfG)}</b> from peak to losing half of it.
          {primeira && fechada && primeira.half != null && <> The {rotTri(primeira.q, f)} cohort took {f.fmtNum(primeira.ttp, 1)} {wk(primeira.ttp)} to peak and had a half-life of {f.fmtNum(primeira.half, 1)}; the {rotTri(fechada.q, f)} cohort, the most recent in which most models have already fallen, {f.fmtNum(fechada.ttp, 1)} and {f.fmtNum(fechada.half, 1)}.</>}
          {primeira && <> The {rotTri(primeira.q, f)} cohort includes the models that already existed when the series begins, in {desde}: for them, the count to peak starts from that date, not from launch.</>}
        </>,
      })}</p>
    </Cartao>
  );
}

// ------------------------------------------------------------------ seção

export default function S10(_: { M: Mercado }) {
  const { D, R } = useHistorico();
  const { t, f } = useIdioma();
  const desde = f.fMes(D.weeks[0]);
  const sub: ReactNode = t({
    pt: <>Com que velocidade um modelo sobe, chega ao pico e perde espaço. Rotatividade e idade do topo respondem à janela e ao agrupamento; as coortes e a forma de uma temporada usam o histórico completo desde {desde}.</>,
    en: <>How fast a model rises, peaks and loses ground. Turnover and the age of the leaders respond to the window and the grouping; the cohorts and the shape of a season use the full history since {desde}.</>,
  });
  return (
    <Secao id="s10" n="10" titulo={t({ pt: 'Ciclo de vida dos modelos', en: 'Model lifecycle' })} sub={sub}>
      <div className="grid2">
        <CartaoChurn R={R} />
        <CartaoIdade R={R} />
      </div>
      <div style={{ marginTop: 14 }}><CartaoCoorte life={D.life} desde={desde} /></div>
      <div style={{ marginTop: 14 }}><CartaoVida T={D.trajetoria as Trajetoria} /></div>
    </Secao>
  );
}
