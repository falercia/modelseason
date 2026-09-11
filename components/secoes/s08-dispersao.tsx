'use client';
/**
 * Dispersão da seção 08. Primitivo local: base.tsx não tem gráfico de pontos.
 * React desenha o SVG; D3 só calcula escala. Rótulos diretos só nos pontos com
 * prioridade, posicionados por tentativa (acima, abaixo, direita, esquerda) e
 * descartados quando não cabem sem colidir: melhor sem rótulo que sobreposto.
 */
import { useState } from 'react';
import * as d3 from 'd3';
import { cor, useLargura, type LinhaTip } from '@/components/graficos/base';

export interface PontoD {
  key: string; x: number; y: number; r: number; slot: string; opacidade?: number; forte?: boolean;
  href?: string; rotulo?: string; prioridade?: number; titulo: string; linhas: LinhaTip[];
}

/**
 * Marcas de escala log: 1-2-5 por década quando o domínio é curto, só potências
 * de dez quando passa de duas décadas e meia, sempre a pelo menos `gap` px uma
 * da outra. Com `ticks()` do D3 a escala log devolve dezenas de marcas.
 */
function ticksLog(x: d3.ScaleLogarithmic<number, number>, gap = 48) {
  const [lo, hi] = x.domain(), cand: number[] = [];
  const mults = Math.log10(hi / lo) > 2.5 ? [1] : [1, 2, 5];
  for (let e = -6; e <= 6; e++) for (const m of mults) { const v = m * Math.pow(10, e); if (v >= lo && v <= hi) cand.push(v); }
  const out: number[] = []; let ult = -1e9;
  cand.forEach(v => { if (x(v) - ult >= gap) { out.push(v); ult = x(v); } });
  return out;
}

interface Caixa { x0: number; x1: number; y0: number; y1: number }
const colide = (a: Caixa, b: Caixa) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

export function Dispersao({
  pontos, escalaX, fmtX, fmtY, tituloX, tituloY, medianas, quadrantes: quadLongos, quadrantesCurtos, fronteira, altura = 400, rotuloAria,
  dominioY, maxRotulos = 8,
}: {
  pontos: PontoD[]; escalaX: 'lin' | 'log'; fmtX: (v: number) => string; fmtY: (v: number) => string;
  tituloX: string; tituloY: string; medianas?: { x: number; y: number }; quadrantes?: [string, string, string, string]; quadrantesCurtos?: [string, string, string, string];
  fronteira?: { x: number; y: number }[]; altura?: number; rotuloAria: string; dominioY?: [number, number]; maxRotulos?: number;
}) {
  const [ref, w] = useLargura<HTMLDivElement>();
  const [hov, setHov] = useState<string | null>(null);
  const estreito = w < 520;
  const quadrantes = estreito && quadrantesCurtos ? quadrantesCurtos : quadLongos;
  // Em tela estreita os dois rótulos de quadrante de cima vão em linhas separadas.
  const m = { t: quadrantes ? (estreito ? 42 : 30) : 12, r: 14, b: 42, l: 54 };
  const h = estreito ? Math.min(altura, 340) : altura;

  const xs = pontos.map(p => p.x), ys = pontos.map(p => p.y);
  const [x0, x1] = d3.extent(xs) as [number, number];
  const x = escalaX === 'log'
    ? d3.scaleLog().domain([x0 * 0.7, x1 * 1.4]).range([m.l, w - m.r])
    : d3.scaleLinear().domain([x0 - (x1 - x0) * 0.05 - 1, x1 + (x1 - x0) * 0.05 + 1]).range([m.l, w - m.r]);
  const y = d3.scaleLinear().domain(dominioY ?? [0, (d3.max(ys) ?? 1) * 1.1]).nice(5).range([h - m.b, m.t]);
  const xt = escalaX === 'log' ? ticksLog(x as d3.ScaleLogarithmic<number, number>) : (x as d3.ScaleLinear<number, number>).ticks(estreito ? 4 : 7);
  const yt = y.ticks(estreito ? 4 : 5);

  // rótulos: por prioridade, primeira posição livre
  const postos: Caixa[] = [];
  const rotulos: { key: string; x: number; y: number; anchor: 'start' | 'middle' | 'end'; t: string }[] = [];
  const candidatos = pontos.filter(p => p.rotulo && p.prioridade != null).sort((a, b) => a.prioridade! - b.prioridade!).slice(0, estreito ? Math.min(4, maxRotulos) : maxRotulos);
  // Obstáculos: todos os pontos, os degraus da fronteira e os rótulos de quadrante de baixo.
  const obst: Caixa[] = pontos.map(p => { const px = x(p.x), py = y(p.y), r = Math.max(2, p.r - 1); return { x0: px - r, x1: px + r, y0: py - r, y1: py + r }; });
  (fronteira ?? []).forEach((f, i, arr) => {
    const n = arr[i + 1]; if (!n) return;
    const xa = x(f.x), xb = x(n.x), ya = y(f.y), yb = y(n.y);
    obst.push({ x0: xa, x1: xb, y0: ya - 1, y1: ya + 1 }, { x0: xb - 1, x1: xb + 1, y0: Math.min(ya, yb), y1: Math.max(ya, yb) });
  });
  if (medianas && quadrantes) {
    const lq = (t: string) => t.length * 6.2;
    postos.push({ x0: m.l, x1: m.l + 4 + lq(quadrantes[2]), y0: h - m.b - 16, y1: h - m.b }, { x0: w - m.r - 4 - lq(quadrantes[3]), x1: w - m.r, y0: h - m.b - 16, y1: h - m.b });
  }
  for (const p of candidatos) {
    const px = x(p.x), py = y(p.y), larg = p.rotulo!.length * 6 + 4, alt = 13, r = p.r + 3;
    const cx = (x0: number, yb: number, anchor: 'start' | 'middle' | 'end') => {
      const a = anchor === 'start' ? x0 : anchor === 'end' ? x0 - larg : x0 - larg / 2;
      return { x: x0, y: yb, anchor, c: { x0: a - 1, x1: a + larg + 1, y0: yb - alt + 1, y1: yb + 3 } };
    };
    const d = r * 0.72;
    const opcoes = [
      cx(px, py - r - 3, 'middle'), cx(px + r + 1, py + 4, 'start'), cx(px - r - 1, py + 4, 'end'), cx(px, py + r + 12, 'middle'),
      cx(px + d, py - d - 2, 'start'), cx(px - d, py - d - 2, 'end'), cx(px + d, py + d + 10, 'start'), cx(px - d, py + d + 10, 'end'),
    ];
    const proprio = (b: Caixa) => Math.abs((b.x0 + b.x1) / 2 - px) < 0.01 && Math.abs((b.y0 + b.y1) / 2 - py) < 0.01;
    const ok = opcoes.find(o => o.c.x0 >= m.l - 2 && o.c.x1 <= w - m.r + 2 && o.c.y0 >= m.t - 2 && o.c.y1 <= h - m.b
      && !postos.some(q => colide(q, o.c)) && !obst.some(q => !proprio(q) && colide(q, o.c)));
    if (!ok) continue;
    postos.push(ok.c);
    rotulos.push({ key: p.key, x: ok.x, y: ok.y, anchor: ok.anchor, t: p.rotulo! });
  }

  const ph = hov ? pontos.find(p => p.key === hov) : undefined;
  const halo = { paintOrder: 'stroke' as const, stroke: 'var(--surface)', strokeWidth: 3, strokeLinejoin: 'round' as const };
  const caminhoFronteira = fronteira && fronteira.length > 1
    ? d3.line<{ x: number; y: number }>().x(d => x(d.x)).y(d => y(d.y)).curve(d3.curveStepAfter)(fronteira) : null;
  const ordem = [...pontos].sort((a, b) => (a.forte === b.forte ? b.r - a.r : a.forte ? 1 : -1));

  return (
    <div className="plot" ref={ref} onPointerLeave={() => setHov(null)}>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ height: h }} role="img" aria-label={rotuloAria}>
        <g className="grid">
          {yt.map(t => <line key={'y' + t} x1={m.l} x2={w - m.r} y1={y(t)} y2={y(t)} />)}
          {xt.map(t => <line key={'x' + t} x1={x(t)} x2={x(t)} y1={m.t} y2={h - m.b} opacity={0.55} />)}
        </g>
        <g className="ax">
          {yt.map(t => <text key={t} x={m.l - 7} y={y(t) + 3.5} textAnchor="end">{fmtY(t)}</text>)}
          {xt.map(t => <text key={t} x={x(t)} y={h - m.b + 16} textAnchor="middle">{fmtX(t)}</text>)}
        </g>
        <text className="ax" x={(m.l + w - m.r) / 2} y={h - 6} textAnchor="middle">{tituloX}</text>
        <text className="ax" transform={`translate(12 ${(m.t + h - m.b) / 2}) rotate(-90)`} textAnchor="middle">{tituloY}</text>
        {medianas && (
          <g stroke="var(--axis)" strokeDasharray="4 4" strokeWidth={1.2}>
            <line x1={x(medianas.x)} x2={x(medianas.x)} y1={m.t} y2={h - m.b} />
            <line x1={m.l} x2={w - m.r} y1={y(medianas.y)} y2={y(medianas.y)} />
          </g>
        )}
        {caminhoFronteira && <path d={caminhoFronteira} fill="none" stroke="var(--ink)" strokeWidth={1.6} opacity={0.75} />}
        {ordem.map(p => {
          const alvo = (
            <g onPointerEnter={() => setHov(p.key)} onPointerDown={() => setHov(p.key)} onFocus={() => setHov(p.key)} onBlur={() => setHov(null)}>
              <circle cx={x(p.x)} cy={y(p.y)} r={p.r} fill={cor(p.slot)} opacity={p.opacidade ?? 0.7}
                stroke={hov === p.key ? 'var(--ink)' : 'var(--surface)'} strokeWidth={hov === p.key ? 2 : 1.5} />
              <circle cx={x(p.x)} cy={y(p.y)} r={Math.max(p.r + 2, 8)} fill="transparent" />
            </g>
          );
          return p.href
            ? <a key={p.key} href={p.href} aria-label={p.titulo} style={{ cursor: 'pointer' }}>{alvo}</a>
            : <g key={p.key}>{alvo}</g>;
        })}
        {medianas && quadrantes && (
          <g className="ax" style={{ pointerEvents: 'none',  fontSize: estreito ? 9.5 : 10.5 }}>
            <text x={m.l + 2} y={m.t - (estreito ? 24 : 10)} textAnchor="start" style={{ fill: 'var(--ink-3)' }}>{quadrantes[0]}</text>
            <text x={w - m.r - 2} y={m.t - 10} textAnchor="end" style={{ fill: 'var(--ink-3)' }}>{quadrantes[1]}</text>
            <text x={m.l + 4} y={h - m.b - 5} textAnchor="start" style={{ fill: 'var(--ink-3)', ...halo }}>{quadrantes[2]}</text>
            <text x={w - m.r - 4} y={h - m.b - 5} textAnchor="end" style={{ fill: 'var(--ink-3)', ...halo }}>{quadrantes[3]}</text>
          </g>
        )}
        <g style={{ pointerEvents: 'none' }}>
          {rotulos.map(l => (
            <text key={l.key} x={l.x} y={l.y} textAnchor={l.anchor} style={{ fill: 'var(--ink-2)', fontSize: 11, fontWeight: 500, ...halo }}>{l.t}</text>
          ))}
        </g>
      </svg>
      {ph && (() => {
        const px = x(ph.x), py = y(ph.y), baixo = py > h / 2;
        return (
          <div className="tip" style={{ left: Math.max(0, Math.min(px + 14, w - 250)), top: baixo ? py - 10 : py + 12, transform: baixo ? 'translateY(-100%)' : undefined }}>
            <div className="t">{ph.titulo}</div>
            {ph.linhas.map((l, i) => <div className="r" key={i}><span>{l.cor && <i style={{ background: cor(l.cor) }} />}{l.rot}</span><b>{l.val}</b></div>)}
          </div>
        );
      })()}
    </div>
  );
}

/** "US$ 0,031", "US$ 1,86", "US$ 0,00042": custo por tarefa pede mais casas que preço por 1M. */
export const fmtCusto = (v: number | null | undefined) => {
  if (v == null || !isFinite(v)) return '—';
  const s = v >= 1 ? v.toFixed(2) : v >= 0.01 ? v.toFixed(3) : String(+v.toPrecision(2));
  return 'US$ ' + s.replace('.', ',');
};
