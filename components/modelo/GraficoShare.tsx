'use client';
/**
 * Share semanal de um modelo, da primeira semana com volume até a última semana
 * completa, com a linha do pico. React desenha, D3 calcula escala.
 */
import { useState } from 'react';
import * as d3 from 'd3';
import { cor, marcasTempo, TabelaSerie, useLargura } from '@/components/graficos/base';
import { fD } from '@/lib/format';
import { pct } from './comum';

export function GraficoShare({ semanas, valores, pico, nome, slot = '--s1' }: {
  semanas: string[]; valores: number[]; pico: { v: number; semana: string } | null; nome: string; slot?: string;
}) {
  const [ref, w] = useLargura<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const N = semanas.length;
  const altura = 230, m = { t: 22, r: 22, b: 26, l: 46 };
  const datas = semanas.map(s => new Date(s + 'T00:00:00'));
  const x = d3.scaleTime().domain([datas[0], datas[N - 1]]).range([m.l, w - m.r]);
  const topo = Math.max(d3.max(valores) ?? 0, pico?.v ?? 0) * 1.12 || 1;
  const y = d3.scaleLinear().domain([0, topo]).nice(4).range([altura - m.b, m.t]);
  const yt = y.ticks(4);
  const casas = topo < 2 ? 2 : 1;
  const fmtEixo = (v: number) => d3.format(`.${topo < 2 ? 1 : 0}f`)(v).replace('.', ',') + '%';
  // até 16 semanas, marca por semana com dia e mês; acima disso, por mês
  const marcas = N <= 16 ? (() => {
    const cabe = Math.max(1, Math.floor((w - m.l - m.r) / 64));
    const passo = Math.max(1, Math.ceil(N / cabe));
    return datas.map((d, i) => ({ d, rot: fD(semanas[i]).slice(0, 6), i })).filter(({ i }) => (N - 1 - i) % passo === 0);
  })() : marcasTempo(x, w - m.l - m.r);
  const linha = d3.line<number>().x((_, i) => x(datas[i])).y(v => y(v));
  const area = d3.area<number>().x((_, i) => x(datas[i])).y0(y(0)).y1(v => y(v));
  const iPico = pico ? semanas.indexOf(pico.semana) : -1;

  const mover = (ev: React.PointerEvent<SVGRectElement>) => {
    const r = ev.currentTarget.getBoundingClientRect();
    const px = ((ev.clientX - r.left) / r.width) * (w - m.l - m.r) + m.l;
    const i = d3.bisector((d: Date) => d).center(datas, x.invert(px));
    setHover(Math.max(0, Math.min(N - 1, i)));
  };
  const rotPico = pico && iPico >= 0 ? `pico ${pct(pico.v)} em ${fD(pico.semana)}` : '';
  const xPico = iPico >= 0 ? x(datas[iPico]) : 0;
  const ancoraPico = xPico > w - 150 ? 'end' : xPico < m.l + 60 ? 'start' : 'middle';

  return (
    <>
      <div className="plot" ref={ref} onPointerLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${w} ${altura}`} style={{ height: altura }} role="img"
          aria-label={`Share semanal de ${nome}, de ${fD(semanas[0])} a ${fD(semanas[N - 1])}${rotPico ? `, ${rotPico}` : ''}, última semana ${pct(valores[N - 1])}`}>
          <g className="grid">{yt.map(t => <line key={t} x1={m.l} x2={w - m.r} y1={y(t)} y2={y(t)} />)}</g>
          <g className="ax">
            {yt.map(t => <text key={t} x={m.l - 7} y={y(t) + 3.5} textAnchor="end">{fmtEixo(t)}</text>)}
            {marcas.map(({ d, rot }) => <text key={+d} x={x(d)} y={altura - m.b + 16} textAnchor="middle">{rot}</text>)}
          </g>
          <path d={area(valores) ?? ''} fill={cor(slot)} opacity={0.14} />
          <path d={linha(valores) ?? ''} fill="none" stroke={cor(slot)} strokeWidth={2} />
          {N <= 16 && valores.map((v, i) => <circle key={i} cx={x(datas[i])} cy={y(v)} r={2.6} fill={cor(slot)} />)}
          {pico && iPico >= 0 && (
            <g>
              <line x1={m.l} x2={w - m.r} y1={y(pico.v)} y2={y(pico.v)} stroke="var(--ink-3)" strokeWidth={1} strokeDasharray="3 3" />
              <circle cx={xPico} cy={y(pico.v)} r={4} fill={cor(slot)} stroke="var(--surface)" strokeWidth={2} />
              <text x={xPico} y={y(pico.v) - 8} textAnchor={ancoraPico} className="ax" style={{ fill: 'var(--ink-2)', fontSize: 10.5 }}>{rotPico}</text>
            </g>
          )}
          {hover != null && (
            <>
              <line className="cross" x1={x(datas[hover])} x2={x(datas[hover])} y1={m.t} y2={altura - m.b} />
              <circle cx={x(datas[hover])} cy={y(valores[hover])} r={3.5} fill={cor(slot)} stroke="var(--surface)" strokeWidth={1.5} />
            </>
          )}
          <rect x={m.l} y={m.t} width={Math.max(0, w - m.l - m.r)} height={altura - m.t - m.b} fill="transparent"
            onPointerMove={mover} onPointerDown={mover} style={{ touchAction: 'pan-y' }} />
        </svg>
        {hover != null && (
          <div className="tip" style={{ left: Math.min(Math.max(0, x(datas[hover]) + 14), Math.max(0, w - 200)), top: 4 }}>
            <div className="t">semana de {fD(semanas[hover])}</div>
            <div className="r"><span><i style={{ background: cor(slot) }} />share</span><b>{d3.format(`.${casas + 1}f`)(valores[hover]).replace('.', ',')}%</b></div>
            {pico && pico.v > 0 && <div className="r"><span>do pico</span><b>{Math.round((100 * valores[hover]) / pico.v)}%</b></div>}
          </div>
        )}
      </div>
      <TabelaSerie eixo={semanas} gran="semana" series={[{ label: 'Share', values: valores }]} fmt={v => d3.format('.3f')(v).replace('.', ',') + '%'} />
    </>
  );
}
