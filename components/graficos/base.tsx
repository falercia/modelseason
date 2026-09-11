'use client';
/**
 * Primitivos de gráfico. React desenha o SVG; D3 só calcula escala e geometria.
 * Todo gráfico temporal recebe o eixo já recortado pelo motor: nenhum componente
 * sabe o que é janela ou filtro.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import * as d3 from 'd3';
import type { Fmt } from '@/lib/format';
import type { Gran } from '@/lib/engine';
import { useIdioma } from '@/components/shell/Idioma';

const useIsoLayout = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** Largura do contêiner, acompanhando redimensionamento. Começa em 640 no servidor. */
export function useLargura<T extends HTMLElement>(inicial = 640): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(inicial);
  useIsoLayout(() => {
    const el = ref.current; if (!el) return;
    const medir = () => setW(Math.max(260, Math.round(el.clientWidth)));
    medir();
    const ro = new ResizeObserver(medir); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/** Cor de um slot da paleta: sempre por variável CSS, para acompanhar o tema. */
export const cor = (slot: string) => (slot.startsWith('--') ? `var(${slot})` : slot);

export interface ItemSerie { key: string; label: string; values: (number | null)[]; slot: string; destaque?: boolean }
export interface Margem { t: number; r: number; b: number; l: number }

export function Legenda({ itens, ocultos, alternar }: { itens: { key: string; label: string; slot: string }[]; ocultos?: Set<string>; alternar?: (k: string) => void }) {
  const { t } = useIdioma();
  return (
    <div className="legenda" role={alternar ? 'group' : undefined} aria-label={alternar ? t({ pt: 'Séries: clique para mostrar ou ocultar', en: 'Series: click to show or hide' }) : undefined}>
      {itens.map(it => alternar
        ? <button key={it.key} type="button" aria-pressed={!ocultos?.has(it.key)} onClick={() => alternar(it.key)}><i style={{ background: cor(it.slot) }} />{it.label}</button>
        : <span key={it.key} className="item"><i style={{ background: cor(it.slot) }} />{it.label}</span>)}
    </div>
  );
}

export function useOcultos() {
  const [ocultos, set] = useState<Set<string>>(new Set());
  const alternar = (k: string) => set(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });
  return { ocultos, alternar };
}

/**
 * Marcas do eixo x. Janela longa: uma marca por mês ou trimestre, com o ano na
 * primeira e sempre que ele vira. Janela curta (até ~3 meses): dia e mês, porque
 * "jun jun jun" não diz nada. Nunca menos de 3 marcas quando há pontos para isso.
 * O rótulo segue o idioma: "08 set" / "Sep 8", "jan 26" / "Jan '26".
 */
export function marcasTempo(x: d3.ScaleTime<number, number>, largura: number, datas: Date[] | undefined, f: Fmt) {
  const [d0, d1] = x.domain();
  const dias = (+d1 - +d0) / 864e5;
  const cabem = Math.max(3, Math.min(9, Math.floor(largura / 78)));
  if (dias <= 100) {
    // escolhe entre os próprios pontos, espaçados, com dia e mês
    const base = datas && datas.length ? datas : x.ticks(cabem);
    const passo = Math.max(1, Math.ceil(base.length / cabem));
    const sel = base.filter((_, i) => i % passo === 0);
    return sel.map(d => ({ d, rot: f.marcaDia(d) }));
  }
  const meses = Math.max(1, Math.round(dias / 30.4));
  const k = [1, 2, 3, 4, 6, 12].find(v => meses / v <= cabem) ?? 12;
  const ticks = d3.timeMonth.every(k)!.range(d0, new Date(+d1 + 1));
  let anoAnt: number | null = null;
  return ticks.map(d => {
    const y = d.getFullYear(); const mostra = anoAnt === null || y !== anoAnt; anoAnt = y;
    return { d, rot: f.marcaMes(d, mostra) };
  });
}

export interface LinhaTip { cor?: string; rot: string; val: string }

/**
 * Gráfico temporal genérico: linhas, área simples, área empilhada (share ou
 * absoluto) e faixa (banda piso/teto). Crosshair com tooltip em todos.
 */
export function Temporal({
  eixo, gran, series, modo = 'linhas', fmt, fmtEixo, ymax, ymin = 0, altura = 240, inteiro = false, banda,
  tipExtra, rotuloAria, m = { t: 12, r: 14, b: 26, l: 44 },
}: {
  eixo: string[]; gran: Gran; series: ItemSerie[];
  modo?: 'linhas' | 'area' | 'empilhada';
  fmt: (v: number) => string; fmtEixo?: (v: number) => string; ymax?: number; ymin?: number; altura?: number; inteiro?: boolean;
  banda?: { piso: number[]; teto: number[]; slot: string };
  tipExtra?: (i: number) => LinhaTip[]; rotuloAria: string; m?: Margem;
}) {
  const [ref, w] = useLargura<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const { t, f } = useIdioma();
  const N = eixo.length;
  const datas = eixo.map(s => new Date(s + 'T00:00:00'));
  const x = d3.scaleTime().domain([datas[0], datas[N - 1] ?? datas[0]]).range([m.l, w - m.r]);

  // empilhamento
  const pilha = modo === 'empilhada'
    ? d3.stack<number>().keys(series.map(s => s.key)).value((i, k) => series.find(s => s.key === k)!.values[i] ?? 0)(d3.range(N))
    : null;
  let topo = ymax;
  if (topo == null) {
    if (pilha) topo = d3.max(pilha.at(-1) ?? [], d => d[1]) ?? 1;
    else topo = d3.max(series.flatMap(s => s.values.filter((v): v is number => v != null))) ?? 1;
    if (banda) topo = Math.max(topo, d3.max(banda.teto) ?? 0);
    topo = topo * 1.06 || 1;
  }
  const y = d3.scaleLinear().domain([ymin, topo]).nice(4).range([altura - m.b, m.t]);
  const yt = y.ticks(4).filter(t => !inteiro || Number.isInteger(t));
  const marcas = N > 3 ? marcasTempo(x, w - m.l - m.r, datas, f) : datas.map(d => ({ d, rot: f.fPer(d3.timeFormat('%Y-%m-%d')(d), gran) }));
  const linha = d3.line<number | null>().defined(v => v != null).x((_, i) => x(datas[i])).y(v => y(v as number));
  const area = d3.area<number | null>().defined(v => v != null).x((_, i) => x(datas[i])).y0(y(Math.max(ymin, 0))).y1(v => y(v as number));

  const mover = (ev: React.PointerEvent<SVGRectElement>) => {
    const r = (ev.currentTarget as SVGRectElement).getBoundingClientRect();
    const px = ((ev.clientX - r.left) / r.width) * (w - m.l - m.r) + m.l;
    const t = x.invert(px);
    const i = d3.bisector((d: Date) => d).center(datas, t);
    setHover(Math.max(0, Math.min(N - 1, i)));
  };

  const tip = hover != null ? (
    <div className="tip" style={{ left: Math.min(Math.max(0, x(datas[hover]) + 14), Math.max(0, w - 230)), top: 4 }}>
      <div className="t">{f.fPer(eixo[hover], gran)}</div>
      {(modo === 'empilhada' ? [...series].reverse() : series).map(s => s.values[hover] != null && (
        <div className="r" key={s.key}><span><i style={{ background: cor(s.slot) }} />{s.label}</span><b>{fmt(s.values[hover] as number)}</b></div>
      ))}
      {banda && <div className="r"><span>{t({ pt: 'faixa', en: 'range' })}</span><b>{fmt(banda.piso[hover])} {t({ pt: 'a', en: 'to' })} {fmt(banda.teto[hover])}</b></div>}
      {tipExtra?.(hover).map((l, k) => <div className="r" key={'x' + k}><span>{l.cor && <i style={{ background: cor(l.cor) }} />}{l.rot}</span><b>{l.val}</b></div>)}
    </div>
  ) : null;

  return (
    <div className="plot" ref={ref} onPointerLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${w} ${altura}`} role="img" aria-label={rotuloAria} style={{ height: altura }}>
        <g className="grid">{yt.map(v => <line key={v} x1={m.l} x2={w - m.r} y1={y(v)} y2={y(v)} />)}</g>
        <g className="ax">
          {yt.map(v => <text key={v} x={m.l - 7} y={y(v) + 3.5} textAnchor="end">{(fmtEixo ?? fmt)(v)}</text>)}
          {marcas.map(({ d, rot }) => <text key={+d} x={x(d)} y={altura - m.b + 16} textAnchor="middle">{rot}</text>)}
        </g>
        {banda && (
          <path d={d3.area<number>().x((_, i) => x(datas[i])).y0((_, i) => y(banda.piso[i])).y1((_, i) => y(banda.teto[i]))(banda.piso) ?? ''}
            fill={cor(banda.slot)} opacity={0.14} />
        )}
        {pilha && pilha.map(camada => {
          const s = series.find(q => q.key === camada.key)!;
          const d = d3.area<d3.SeriesPoint<number>>().x((_, i) => x(datas[i])).y0(p => y(p[0])).y1(p => y(p[1]))(camada) ?? '';
          return <path key={camada.key} d={d} fill={cor(s.slot)} opacity={s.destaque === false ? 0.35 : 0.88} stroke="var(--surface)" strokeWidth={0.6} />;
        })}
        {!pilha && series.map(s => (
          <g key={s.key}>
            {modo === 'area' && <path d={area(s.values) ?? ''} fill={cor(s.slot)} opacity={0.14} />}
            <path d={linha(s.values) ?? ''} fill="none" stroke={cor(s.slot)} strokeWidth={s.destaque ? 2.6 : 1.7} opacity={s.destaque === false ? 0.55 : 1} />
          </g>
        ))}
        {hover != null && <line className="cross" x1={x(datas[hover])} x2={x(datas[hover])} y1={m.t} y2={altura - m.b} />}
        {hover != null && !pilha && series.map(s => s.values[hover] != null && (
          <circle key={s.key} cx={x(datas[hover])} cy={y(s.values[hover] as number)} r={3.2} fill={cor(s.slot)} stroke="var(--surface)" strokeWidth={1.2} />
        ))}
        <rect x={m.l} y={m.t} width={Math.max(0, w - m.l - m.r)} height={altura - m.t - m.b} fill="transparent"
          onPointerMove={mover} onPointerDown={mover} style={{ touchAction: 'pan-y' }} />
      </svg>
      {tip}
    </div>
  );
}

/** Barras horizontais com rótulo à esquerda e valor à direita. */
export function BarrasH({ linhas, fmt, rotuloAria, larguraRotulo = 150 }: {
  linhas: { key: string; rot: ReactNode; v: number; slot?: string; extra?: string; href?: string }[];
  fmt: (v: number) => string; rotuloAria: string; larguraRotulo?: number;
}) {
  const max = d3.max(linhas, l => Math.abs(l.v)) || 1;
  return (
    <div className="plot" role="group" aria-label={rotuloAria}>
      <div style={{ display: 'grid', gridTemplateColumns: `minmax(0,${larguraRotulo}px) minmax(0,1fr) auto`, gap: '6px 10px', alignItems: 'center', fontSize: 12.5 }}>
        {linhas.map(l => (
          <FragmentoBarra key={l.key} l={l} max={max} fmt={fmt} />
        ))}
      </div>
    </div>
  );
}
function FragmentoBarra({ l, max, fmt }: { l: { key: string; rot: ReactNode; v: number; slot?: string; extra?: string; href?: string }; max: number; fmt: (v: number) => string }) {
  return (
    <>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink)' }} title={typeof l.rot === 'string' ? l.rot : undefined}>
        {l.href ? <a href={l.href} style={{ color: 'inherit', textDecoration: 'none' }}>{l.rot}</a> : l.rot}
      </span>
      <span style={{ display: 'block', background: 'var(--grid)', borderRadius: 2, height: 8 }}>
        <i style={{ display: 'block', height: 8, borderRadius: 2, width: `${(100 * Math.abs(l.v) / max).toFixed(1)}%`, background: cor(l.slot ?? '--s1') }} />
      </span>
      <span className="mono" style={{ fontSize: 11.5, color: 'var(--ink-2)', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmt(l.v)}{l.extra ? <span style={{ color: 'var(--ink-3)' }}> {l.extra}</span> : null}</span>
    </>
  );
}

/** Tabela de dados por período, recolhida. Acessibilidade e auditoria. */
export function TabelaSerie({ eixo, gran, series, fmt, rotulo }: { eixo: string[]; gran: Gran; series: { label: string; values: (number | null)[] }[]; fmt: (v: number) => string; rotulo?: string }) {
  const { t, f } = useIdioma();
  return (
    <details className="tab">
      <summary>{rotulo ?? t({ pt: 'Ver os números', en: 'See the numbers' })}</summary>
      <div className="tabwrap" style={{ maxHeight: 280, overflowY: 'auto' }}>
        <table className="t">
          <thead><tr><th>{gran === 'mes' ? t({ pt: 'Mês', en: 'Month' }) : t({ pt: 'Semana', en: 'Week' })}</th>{series.map(s => <th key={s.label} className="num">{s.label}</th>)}</tr></thead>
          <tbody>{[...eixo.keys()].reverse().map(i => (
            <tr key={eixo[i]}><td>{f.fPer(eixo[i], gran)}</td>{series.map(s => <td key={s.label} className="num">{s.values[i] == null ? '—' : fmt(s.values[i] as number)}</td>)}</tr>
          ))}</tbody>
        </table>
      </div>
    </details>
  );
}
