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
import { Legenda, TabelaSerie, Temporal, cor, useLargura } from '@/components/graficos/base';
import type { Recorte, Vida } from '@/lib/engine';
import { curto, fMes, fPer, fmtNum, urlModelo } from '@/lib/format';
import { CartaoVida, rotTri, type Trajetoria } from './s10-trajetoria';
import { rotulador } from './s09-nomes';


const semFiltro = (R: Recorte) => R.cobertura.filtrando
  ? <p className="nota">Este indicador é definido sobre o mercado inteiro e não responde aos filtros de modelo, só à janela e ao agrupamento.</p>
  : null;

/** Índice e valor extremos de uma série com buracos. */
function extremos(s: (number | null)[]) {
  const ii = s.map((v, i) => [v, i] as [number | null, number]).filter((p): p is [number, number] => p[0] != null);
  if (!ii.length) return null;
  const min = ii.reduce((a, b) => (b[0] < a[0] ? b : a)), max = ii.reduce((a, b) => (b[0] > a[0] ? b : a));
  return { min, max, med: d3.median(ii, p => p[0])!, n: ii.length };
}

// ------------------------------------------------------------------ rotatividade

function CartaoChurn({ R }: { R: Recorte }) {
  const gran = R.estado.gran, ult = R.N - 1;
  const mes = gran === 'mes';
  const fmt = (v: number) => (mes ? fmtNum(v, 1) : String(Math.round(v)));
  const ex = extremos(R.churn);
  const v1 = R.churn[ult];
  const top10 = R.cobertura.filtrando ? [] : R.boards.last.slice(0, 10);
  const rot = rotulador(top10.map(r => r.model));
  const novos = new Set(!mes && !R.cobertura.filtrando ? R.mudancas.entraram : []);
  return (
    <Cartao id="churn" subtitulo={<>Quantos dos 10 mais usados não estavam no top 10 quatro semanas antes{mes ? '; média das semanas do mês' : ''}. De 0 (topo congelado) a 10 (topo trocado)</>}>
      {ex ? <>
        <Temporal eixo={R.eixo} gran={gran} series={[{ key: 'churn', label: 'Novos no top 10', values: R.churn, slot: '--s2' }]}
          modo="linhas" fmt={fmt} ymax={10} inteiro altura={220}
          rotuloAria={`Rotatividade do top 10 de ${fPer(R.eixo[0], gran)} a ${fPer(R.eixo[ult], gran)}: mediana de ${fmtNum(ex.med, 1)} modelos novos a cada quatro semanas.`} />
        <TabelaSerie eixo={R.eixo} gran={gran} series={[{ label: 'Novos no top 10', values: R.churn }]} fmt={fmt} />
        <p className="leitura">
          Na janela, em mediana <b>{fmtNum(ex.med, 1)}</b> dos 10 mais usados são novos em relação a quatro semanas antes.
          {v1 != null && (mes ? <> No último mês, a média foi {fmt(v1)}.</> : <> No último período, foram {fmt(v1)}.</>)} O pico foi {fmt(ex.max[0])}, em {fPer(R.eixo[ex.max[1]], gran)}.
          {top10.length > 0 && <> Os 10 de {fPer(R.eixo[ult], gran)}, em ordem de volume: {top10.map((r, i) => (
            <span key={r.model}><Link prefetch={false} href={urlModelo(r.model)} className="mono" style={{ color: 'var(--ink)', fontSize: 11.5 }}>{rot(r.model)}</Link>{novos.has(r.model) ? <span className="pill">novo</span> : null}{i < top10.length - 1 ? ', ' : '.'}</span>
          ))}</>}
        </p>
      </> : <p className="vazio">A série de rotatividade só começa quatro semanas depois do início dos dados, e esta janela inteira fica antes disso.</p>}
      {semFiltro(R)}
    </Cartao>
  );
}

// ------------------------------------------------------------------ idade

function CartaoIdade({ R }: { R: Recorte }) {
  const gran = R.estado.gran, ult = R.N - 1;
  const fmt = (v: number) => fmtNum(v, 1) + ' sem';
  const ex = extremos(R.age);
  const v1 = R.age[ult];
  return (
    <Cartao id="age">
      {ex ? <>
        <Temporal eixo={R.eixo} gran={gran} series={[{ key: 'age', label: 'Idade mediana', values: R.age, slot: '--s4' }]}
          modo="linhas" fmt={fmt} fmtEixo={v => String(Math.round(v))} altura={220}
          rotuloAria={`Idade mediana do top 10 em semanas desde a estreia no ranking, de ${fPer(R.eixo[0], gran)} a ${fPer(R.eixo[ult], gran)}.`} />
        <TabelaSerie eixo={R.eixo} gran={gran} series={[{ label: 'Idade mediana (semanas)', values: R.age }]} fmt={fmt} />
        <p className="leitura">
          {v1 != null && <>Em {fPer(R.eixo[ult], gran)}, a idade mediana dos 10 mais usados é de <b>{fmt(v1)}</b> desde a estreia no ranking. </>}
          Na janela, variou de {fmt(ex.min[0])} ({fPer(R.eixo[ex.min[1]], gran)}) a {fmt(ex.max[0])} ({fPer(R.eixo[ex.max[1]], gran)}).
          {ex.n < R.N && <> Os primeiros períodos ficam de fora porque caem nas semanas censuradas do início da série.</>}
        </p>
      </> : <p className="vazio">A janela inteira cai nas primeiras semanas da série, que são censuradas: não se sabe quando os modelos presentes em janeiro de 2025 estrearam de fato.</p>}
      {semFiltro(R)}
    </Cartao>
  );
}

// ------------------------------------------------------------------ coortes

interface Coorte { q: string; n: number; ttp: number; half: number | null; nHalf: number; vivos: number }

function trimestre(iso: string) { const d = new Date(iso + 'T00:00:00'); return `${d.getFullYear()} Q${Math.floor(d.getMonth() / 3) + 1}`; }

function BarrasCoorte({ linhas }: { linhas: Coorte[] }) {
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
        aria-label={`Mediana de semanas até o pico e de meia-vida por trimestre de lançamento: ${linhas.map(r => `${rotTri(r.q)}, ${fmtNum(r.ttp, 1)} e ${r.half == null ? 'sem meia-vida' : fmtNum(r.half, 1)}`).join('; ')}.`}>
        <g className="grid">{yt.map(t => <line key={t} x1={m.l} x2={w - m.r} y1={y(t)} y2={y(t)} />)}</g>
        <g className="ax">
          {yt.map(t => <text key={t} x={m.l - 7} y={y(t) + 3.5} textAnchor="end">{String(Math.round(t))}</text>)}
          {linhas.map(r => (
            <g key={r.q}>
              <text x={x0(r.q)! + x0.bandwidth() / 2} y={altura - m.b + 16} textAnchor="middle" style={{ fill: 'var(--ink-2)' }}>{rotTri(r.q)}</text>
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
                    {!estreito && <text className="ax" x={x1(k)! + x1.bandwidth() / 2} y={y(v) - 5} textAnchor="middle" style={{ fill: 'var(--ink-2)' }}>{fmtNum(v, 1)}{aberta ? '*' : ''}</text>}
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
            <div className="t">Lançados em {rotTri(r.q)} · {r.n} modelos</div>
            <div className="r"><span><i style={{ background: cor('--s1') }} />Semanas até o pico</span><b>{fmtNum(r.ttp, 1)}</b></div>
            <div className="r"><span><i style={{ background: cor('--s2') }} />Meia-vida após o pico</span><b>{r.half == null ? 'nenhum caiu à metade' : `${fmtNum(r.half, 1)} (${r.nHalf} de ${r.n})`}</b></div>
            <div className="r"><span>Ainda acima de metade do pico</span><b>{Math.round(100 * r.vivos)}%</b></div>
          </div>
        );
      })()}
    </div>
  );
}

function CartaoCoorte({ life, desde }: { life: Vida[]; desde: string }) {
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
  return (
    <Cartao id="cohort" subtitulo={<>Mediana em semanas, modelos que chegaram a 2% do volume semanal, por trimestre de estreia no ranking. Histórico completo desde {desde}: não responde à janela nem ao agrupamento</>}>
      <Legenda itens={[{ key: 'ttp', label: 'Semanas até o pico', slot: '--s1' }, { key: 'half', label: 'Meia-vida após o pico', slot: '--s2' }]} />
      <BarrasCoorte linhas={linhas} />
      {abertas.length > 0 && <p className="nota" style={{ marginTop: 4 }}>* Barra tracejada: {abertas.length === 1 ? 'na coorte' : 'nas coortes'} {abertas.map(r => rotTri(r.q)).join(', ')}, metade ou mais dos modelos ainda está acima de metade do pico. A meia-vida delas só conta quem já caiu, então tende a subir.</p>}
      <details className="tab">
        <summary>Ver os números</summary>
        <div className="tabwrap">
          <table className="t">
            <thead><tr><th>Trimestre</th><th className="num">n</th><th className="num">Sem. até o pico</th><th className="num">Meia-vida</th><th className="num">Com meia-vida</th><th className="num">Acima de metade do pico</th></tr></thead>
            <tbody>{linhas.map(r => (
              <tr key={r.q}><td>{rotTri(r.q)}</td><td className="num">{r.n}</td><td className="num">{fmtNum(r.ttp, 1)}</td><td className="num">{r.half == null ? '—' : fmtNum(r.half, 1)}</td><td className="num">{r.nHalf}</td><td className="num">{Math.round(100 * r.vivos)}%</td></tr>
            ))}</tbody>
          </table>
        </div>
      </details>
      <p className="leitura">
        Nos {life.length} modelos, a mediana é de <b>{fmtNum(ttpG, 1)} semanas</b> até o pico e <b>{fmtNum(halfG, 1)} semanas</b> do pico até perder metade dele.
        {primeira && fechada && primeira.half != null && <> A coorte {rotTri(primeira.q)} levou {fmtNum(primeira.ttp, 1)} semanas até o pico e {fmtNum(primeira.half, 1)} de meia-vida; a de {rotTri(fechada.q)}, a mais recente em que a maioria já caiu, {fmtNum(fechada.ttp, 1)} e {fmtNum(fechada.half, 1)}.</>}
        {primeira && <> A coorte {rotTri(primeira.q)} inclui os modelos que já existiam quando a série começa, em {desde}: para eles, a contagem até o pico parte dessa data, não do lançamento.</>}
      </p>
    </Cartao>
  );
}

// ------------------------------------------------------------------ seção

export default function S10(_: { M: Mercado }) {
  const { D, R } = useHistorico();
  const desde = fMes(D.weeks[0]);
  const sub: ReactNode = <>Com que velocidade um modelo sobe, chega ao pico e perde espaço. Rotatividade e idade do topo respondem à janela e ao agrupamento; as coortes e a forma de uma temporada usam o histórico completo desde {desde}.</>;
  return (
    <Secao id="s10" n="10" titulo="Ciclo de vida dos modelos" sub={sub}>
      <div className="grid2">
        <CartaoChurn R={R} />
        <CartaoIdade R={R} />
      </div>
      <div style={{ marginTop: 14 }}><CartaoCoorte life={D.life} desde={desde} /></div>
      <div style={{ marginTop: 14 }}><CartaoVida T={D.trajetoria as Trajetoria} /></div>
    </Secao>
  );
}
