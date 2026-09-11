'use client';
/**
 * "A forma de uma temporada": porte do trajectory() da v1. O eixo x é a IDADE
 * do modelo (semanas desde a estreia) e o y é o share como % do próprio pico.
 * Curvas de 2025 e de 2026 ficam comparáveis, e o que aparece não é um modelo:
 * é o formato que todos repetem. Histórico completo, não responde ao recorte.
 */
import { useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as d3 from 'd3';
import { Cartao, Modos } from '@/components/shell/Cartao';
import { cor, useLargura, useOcultos } from '@/components/graficos/base';
import { ORIGEM_SLOT } from '@/lib/cores';
import { curto, fD, fmtNum, fmtP, urlModelo } from '@/lib/format';
import { rotulador } from './s09-nomes';

export interface Envelope { mediana: number[]; p25: number[]; p75: number[]; n: number[] }
export interface ModeloTraj {
  model: string; vendor: string; origin: string; weights: string; first: string; cohort: string;
  peak_share: number; weeks_to_peak: number; half_life_weeks: number | null; still_alive: boolean; abs: number[]; rel: number[];
}
export interface Trajetoria { max_idade: number; modelos: ModeloTraj[]; envelope_geral: Envelope; envelope_coorte: Record<string, Envelope | null>; coortes: string[] }

/** '2025 Q1' vira 'T1 25'. */
export const rotTri = (q: string) => { const [a, t] = q.split(' '); return `${t.replace('Q', 'T')} ${a.slice(2)}`; };
const slotOrigem = (o: string) => ORIGEM_SLOT[o] ?? '--s0';
/** Origens sem cor própria viram um grupo só na legenda: duas entradas cinza seriam indistinguíveis. */
const RESTO = 'Outras e não identificada';
const grupoOrigem = (o: string) => (slotOrigem(o) === '--s0' ? RESTO : o);
/** Duas marcas trimestrais no eixo de idade: 13 semanas é um trimestre. */
const DOIS_TRI = 26;
/** Rótulo sobre o novelo de curvas: contorno da cor do fundo para continuar legível. */
const HALO = { fill: 'var(--ink)', fontWeight: 600, paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 4, strokeLinejoin: 'round' } as const;

/** Pico da mediana e a primeira semana depois dele em que ela cai à metade. */
export function marcos(med: number[]) {
  const max = d3.max(med) ?? 0;
  const pico = med.indexOf(max);
  const meia = med.findIndex((v, i) => i > pico && v <= max / 2);
  return { pico, meia, max };
}

// ------------------------------------------------------------------ modo forma

function Forma({ T, ocultos }: { T: Trajetoria; ocultos: Set<string> }) {
  const [ref, w] = useLargura<HTMLDivElement>();
  const router = useRouter();
  // No toque, o primeiro toque mostra o tooltip; só o clique de mouse navega.
  const tipo = useRef('mouse');
  const [hover, setHover] = useState<{ i: number; px: number; py: number; mod: ModeloTraj | null } | null>(null);
  const E = T.envelope_geral, K = E.mediana.length;
  const altura = w < 560 ? 300 : 390;
  const m = { t: 22, r: 18, b: 32, l: 44 };
  const x = d3.scaleLinear().domain([0, K - 1]).range([m.l, w - m.r]);
  const y = d3.scaleLinear().domain([0, 100]).range([altura - m.b, m.t]);
  const rot = rotulador(T.modelos.map(md => md.model));
  const mostrados = T.modelos.filter(md => !ocultos.has(grupoOrigem(md.origin)));
  const ln = d3.line<number>().x((_, i) => x(i)).y(v => y(v)).curve(d3.curveMonotoneX);
  const faixa = d3.area<number>().x((_, i) => x(i)).y0((_, i) => y(E.p25[i])).y1(v => y(v)).curve(d3.curveMonotoneX);
  const { pico, meia } = marcos(E.mediana);
  const xt = x.ticks(w < 560 ? 5 : 9).filter(Number.isInteger);

  const mover = (ev: React.PointerEvent<SVGRectElement>) => {
    tipo.current = ev.pointerType;
    const r = (ev.currentTarget as SVGRectElement).getBoundingClientRect();
    // px de tela para px do viewBox, nos dois eixos
    const px = m.l + (ev.clientX - r.left) * ((w - m.l - m.r) / r.width);
    const py = m.t + (ev.clientY - r.top) * ((altura - m.t - m.b) / r.height);
    const i = Math.max(0, Math.min(K - 1, Math.round(x.invert(px))));
    // A curva mais próxima do ponteiro naquela idade, se estiver perto o bastante.
    let mod: ModeloTraj | null = null, melhor = 9;
    for (const md of mostrados) {
      const v = md.rel[i]; if (v == null) continue;
      const d = Math.abs(y(v) - py);
      if (d < melhor) { melhor = d; mod = md; }
    }
    setHover({ i, px, py, mod });
  };

  const h = hover;
  const destaque = h?.mod ?? null;
  const tipEsq = h ? Math.min(Math.max(0, h.px + 14), Math.max(0, w - 250)) : 0;
  return (
    <div className="plot" ref={ref} onPointerLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${w} ${altura}`} role="img" style={{ height: altura }}
        aria-label={`${T.modelos.length} modelos alinhados na semana de estreia e normalizados pelo próprio pico. A mediana chega ao pico na semana ${pico}${meia > 0 ? ` e cai à metade na semana ${meia}` : ''}.`}>
        <g className="grid">{[0, 25, 50, 75, 100].map(t => <line key={t} x1={m.l} x2={w - m.r} y1={y(t)} y2={y(t)} />)}</g>
        <g className="ax">
          {[0, 25, 50, 75, 100].map(t => <text key={t} x={m.l - 7} y={y(t) + 3.5} textAnchor="end">{t}%</text>)}
          {xt.map(t => <text key={t} x={x(t)} y={altura - m.b + 17} textAnchor="middle">{t === 0 ? 'estreia' : `${t} sem`}</text>)}
        </g>
        {K - 1 >= DOIS_TRI && (
          <g>
            <line x1={x(DOIS_TRI)} x2={x(DOIS_TRI)} y1={m.t - 8} y2={altura - m.b} stroke="var(--axis)" strokeDasharray="3 4" />
            <text className="ax" x={x(DOIS_TRI) + 5} y={m.t - 10} style={{ fill: 'var(--ink-3)' }}>dois trimestres</text>
          </g>
        )}
        <path d={faixa(E.p75) ?? ''} fill={cor('--s1')} opacity={0.16} />
        <g>
          {mostrados.map(md => (
            <path key={md.model} d={ln(md.rel) ?? ''} fill="none" stroke={cor(slotOrigem(md.origin))}
              strokeWidth={destaque === md ? 2.6 : 0.9} opacity={destaque ? (destaque === md ? 1 : 0.05) : 0.14} />
          ))}
        </g>
        {destaque && <path d={ln(destaque.rel) ?? ''} fill="none" stroke={cor(slotOrigem(destaque.origin))} strokeWidth={2.6} />}
        <path d={ln(E.mediana) ?? ''} fill="none" stroke="var(--surface)" strokeWidth={5.5} opacity={0.9} />
        <path d={ln(E.mediana) ?? ''} fill="none" stroke="var(--ink)" strokeWidth={2.75} />
        {([[pico, 'pico da mediana'], [meia, 'metade do pico']] as [number, string][]).filter(([i]) => i > 0).map(([i, txt]) => (
          <g key={txt}>
            <circle cx={x(i)} cy={y(E.mediana[i])} r={4.2} fill="var(--ink)" stroke="var(--surface)" strokeWidth={2} />
            <text className="ax" x={x(i) + 9} y={y(E.mediana[i]) - 7} style={HALO}>{txt}: semana {i}</text>
          </g>
        ))}
        {K - 1 >= DOIS_TRI && (
          <g>
            <circle cx={x(DOIS_TRI)} cy={y(E.mediana[DOIS_TRI])} r={3.6} fill="var(--ink)" stroke="var(--surface)" strokeWidth={2} />
            <text className="ax" x={x(DOIS_TRI) + 8} y={y(E.mediana[DOIS_TRI]) - 8} style={{ ...HALO, fill: 'var(--ink-2)' }}>{fmtNum(E.mediana[DOIS_TRI])}% do pico</text>
          </g>
        )}
        {h && <line className="cross" x1={x(h.i)} x2={x(h.i)} y1={m.t} y2={altura - m.b} />}
        {h && !destaque && <circle cx={x(h.i)} cy={y(E.mediana[h.i])} r={3.4} fill="var(--ink)" stroke="var(--surface)" strokeWidth={1.4} />}
        {h && destaque && destaque.rel[h.i] != null && <circle cx={x(h.i)} cy={y(destaque.rel[h.i])} r={3.6} fill={cor(slotOrigem(destaque.origin))} stroke="var(--surface)" strokeWidth={1.4} />}
        <rect x={m.l} y={m.t} width={Math.max(0, w - m.l - m.r)} height={altura - m.t - m.b} fill="transparent"
          style={{ touchAction: 'pan-y', cursor: destaque ? 'pointer' : 'crosshair' }}
          onPointerMove={mover} onPointerDown={mover}
          onClick={() => { if (destaque && tipo.current === 'mouse') router.push(urlModelo(destaque.model)); }} />
      </svg>
      {h && (
        <div className="tip" style={{ left: tipEsq, top: 4 }}>
          {destaque ? (
            <>
              <div className="t">{rot(destaque.model)}</div>
              <div className="r"><span><i style={{ background: cor(slotOrigem(destaque.origin)) }} />Origem</span><b>{destaque.origin}</b></div>
              <div className="r"><span>Estreia</span><b>{fD(destaque.first)}</b></div>
              <div className="r"><span>Pico de share</span><b>{fmtP(destaque.peak_share)}</b></div>
              <div className="r"><span>Semanas até o pico</span><b>{destaque.weeks_to_peak}</b></div>
              <div className="r"><span>Meia-vida</span><b>{destaque.half_life_weeks == null ? 'ainda não caiu à metade' : `${destaque.half_life_weeks} sem`}</b></div>
              <div className="r"><span>Na semana {h.i}</span><b>{fmtNum(destaque.rel[h.i])}% do pico</b></div>
              {tipo.current === 'mouse' && <div className="r" style={{ color: 'var(--ink-3)' }}><span>clique para abrir o modelo</span></div>}
            </>
          ) : (
            <>
              <div className="t">{h.i === 0 ? 'Semana de estreia' : `Semana ${h.i} desde a estreia`}</div>
              <div className="r"><span><i style={{ background: 'var(--ink)' }} />Mediana</span><b>{fmtNum(E.mediana[h.i])}% do pico</b></div>
              <div className="r"><span><i style={{ background: cor('--s1'), opacity: 0.4 }} />1º a 3º quartil</span><b>{fmtNum(E.p25[h.i])}% a {fmtNum(E.p75[h.i])}%</b></div>
              <div className="r"><span>Modelos com essa idade</span><b>{E.n[h.i]}</b></div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ modo coortes

function Mini({ q, E, G }: { q: string; E: Envelope; G: Envelope }) {
  const [ref, w] = useLargura<HTMLDivElement>(200);
  const [hi, setHi] = useState<number | null>(null);
  const K = G.mediana.length, h = 138, m = { t: 8, r: 8, b: 18, l: 30 };
  const x = d3.scaleLinear().domain([0, K - 1]).range([m.l, w - m.r]);
  const y = d3.scaleLinear().domain([0, 100]).range([h - m.b, m.t]);
  const ln = d3.line<number>().x((_, i) => x(i)).y(v => y(v)).curve(d3.curveMonotoneX);
  const faixa = d3.area<number>().x((_, i) => x(i)).y0((_, i) => y(E.p25[i])).y1(v => y(v)).curve(d3.curveMonotoneX);
  const { meia } = marcos(E.mediana);
  const obs = E.mediana.length;
  const mover = (ev: React.PointerEvent<SVGRectElement>) => {
    const r = (ev.currentTarget as SVGRectElement).getBoundingClientRect();
    const px = m.l + (ev.clientX - r.left) * ((w - m.l - m.r) / r.width);
    setHi(Math.max(0, Math.min(K - 1, Math.round(x.invert(px)))));
  };
  return (
    <div style={{ minWidth: 0, background: 'var(--surface-2)', borderRadius: 9, padding: '9px 10px 8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <b style={{ fontSize: 13 }}>{rotTri(q)}</b>
        <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>n={E.n[0]}</span>
      </div>
      <div className="plot" ref={ref} onPointerLeave={() => setHi(null)}>
        <svg viewBox={`0 0 ${w} ${h}`} role="img" style={{ height: h }}
          aria-label={`Coorte ${rotTri(q)}, ${E.n[0]} modelos: ${meia > 0 ? `a mediana cai à metade do pico na semana ${meia}` : `a mediana ainda não caiu à metade do pico em ${obs - 1} semanas observadas`}.`}>
          <g className="grid">{[0, 50, 100].map(t => <line key={t} x1={m.l} x2={w - m.r} y1={y(t)} y2={y(t)} />)}</g>
          <g className="ax">
            {[0, 50, 100].map(t => <text key={t} x={m.l - 5} y={y(t) + 3.5} textAnchor="end" style={{ fontSize: 9.5 }}>{t}%</text>)}
            {[0, 13, 26, 39].filter(t => t <= K - 1).map(t => <text key={t} x={x(t)} y={h - 4} textAnchor="middle" style={{ fontSize: 9.5 }}>{t}</text>)}
          </g>
          <path d={faixa(E.p75) ?? ''} fill={cor('--s1')} opacity={0.14} />
          <path d={ln(G.mediana) ?? ''} fill="none" stroke="var(--ink-3)" strokeWidth={1.4} strokeDasharray="3 3" />
          <path d={ln(E.mediana) ?? ''} fill="none" stroke={cor('--s1')} strokeWidth={2.4} />
          {meia > 0 && <circle cx={x(meia)} cy={y(E.mediana[meia])} r={3.4} fill={cor('--s1')} stroke="var(--surface-2)" strokeWidth={1.6} />}
          {obs < K && <line x1={x(obs - 1)} x2={x(obs - 1)} y1={m.t} y2={h - m.b} stroke="var(--axis)" strokeDasharray="2 3" />}
          {hi != null && <line className="cross" x1={x(hi)} x2={x(hi)} y1={m.t} y2={h - m.b} />}
          <rect x={m.l} y={m.t} width={Math.max(0, w - m.l - m.r)} height={h - m.t - m.b} fill="transparent" onPointerMove={mover} onPointerDown={mover} style={{ touchAction: 'pan-y' }} />
        </svg>
        {hi != null && (
          <div className="tip" style={{ left: Math.min(Math.max(0, x(hi) + 10), Math.max(0, w - 170)), top: 0, minWidth: 140 }}>
            <div className="t">Semana {hi}</div>
            <div className="r"><span><i style={{ background: cor('--s1') }} />{rotTri(q)}</span><b>{E.mediana[hi] != null ? `${fmtNum(E.mediana[hi])}%` : 'sem dado'}</b></div>
            <div className="r"><span><i style={{ background: 'var(--ink-3)' }} />Geral</span><b>{fmtNum(G.mediana[hi])}%</b></div>
            {E.n[hi] != null && <div className="r"><span>n</span><b>{E.n[hi]}</b></div>}
          </div>
        )}
      </div>
      <p className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 2 }}>
        {meia > 0 ? `metade do pico na semana ${meia}` : `acima da metade em ${obs - 1} ${obs - 1 === 1 ? 'semana observada' : 'semanas observadas'}`}
      </p>
    </div>
  );
}

// ------------------------------------------------------------------ cartão

type ModoVida = 'forma' | 'coortes';

export function CartaoVida({ T }: { T: Trajetoria }) {
  const [modo, setModo] = useState<ModoVida>('forma');
  const { ocultos, alternar } = useOcultos();
  const rot = rotulador(T.modelos.map(md => md.model));
  const E = T.envelope_geral, N = T.modelos.length;
  const { pico, meia } = marcos(E.mediana);
  const contar = (g: string) => T.modelos.filter(md => grupoOrigem(md.origin) === g).length;
  const origens = [...new Set(T.modelos.map(md => grupoOrigem(md.origin)))].sort((a, b) => (a === RESTO ? 1 : b === RESTO ? -1 : contar(b) - contar(a)));
  // Aos dois trimestres: quantos dos modelos observados até essa idade seguem acima de metade do pico.
  const obs26 = T.modelos.filter(md => md.rel.length > DOIS_TRI && md.rel[DOIS_TRI] != null);
  const acima26 = obs26.filter(md => md.rel[DOIS_TRI] >= 50).length;
  const coortes = T.coortes.filter(q => T.envelope_coorte[q]);
  const porCoorte = coortes.map(q => { const e = T.envelope_coorte[q]!; return { q, n: e.n[0], obs: e.mediana.length - 1, meia: marcos(e.mediana).meia }; });
  const caidas = porCoorte.filter(c => c.meia > 0);

  let leitura: ReactNode;
  if (modo === 'forma') {
    leitura = <>
      A mediana dos {N} modelos chega ao pico na <b>semana {pico}</b>{meia > 0 ? <> e cai à metade dele na <b>semana {meia}</b></> : null}.
      {E.mediana.length > DOIS_TRI && <> Aos dois trimestres está em <b>{fmtNum(E.mediana[DOIS_TRI])}%</b> do pico, e só <b>{acima26}</b> dos {obs26.length} modelos observados até essa idade seguem acima de metade do próprio pico.</>}
      {meia > 0 && pico <= 4 && <> Subida rápida, pico cedo e queda longa: é a forma que se repete, e é por isso que o que dura é o método de avaliação e troca, não a escolha do modelo.</>}
    </>;
  } else {
    leitura = <>
      Semana em que a mediana de cada coorte cai à metade do pico: {caidas.map((c, i) => <span key={c.q}><b>{rotTri(c.q)}</b> na {c.meia}{i < caidas.length - 1 ? ', ' : '.'}</span>)}
      {porCoorte.filter(c => c.meia <= 0).length > 0 && <> Ainda não caíram: {porCoorte.filter(c => c.meia <= 0).map(c => `${rotTri(c.q)} (${c.obs} ${c.obs === 1 ? 'semana observada' : 'semanas observadas'})`).join(', ')}.</>}
      {' '}Coortes recentes têm menos semanas de observação; o fim de cada curva é o limite do dado, não o fim da temporada.
    </>;
  }

  return (
    <Cartao id="life"
      subtitulo={modo === 'forma'
        ? `${N} modelos alinhados na semana de estreia, cada um normalizado pelo próprio pico. A linha grossa é a mediana; a faixa, o 1º ao 3º quartil. Histórico completo, não responde ao recorte`
        : 'Mediana por trimestre de lançamento contra a mediana geral, tracejada. Mostra se a temporada está encurtando. Histórico completo, não responde ao recorte'}
>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '4px 12px', flexWrap: 'wrap-reverse', marginBottom: 2 }}>
      {modo === 'forma' ? (
          <div className="legenda" role="group" aria-label="Origem das curvas: clique para mostrar ou ocultar">
            <span className="item"><i style={{ background: 'var(--ink)', height: 3, borderRadius: 1 }} />Mediana dos {N}</span>
            <span className="item"><i style={{ background: cor('--s1'), opacity: 0.35 }} />1º a 3º quartil</span>
            {origens.map(o => (
              <button key={o} type="button" aria-pressed={!ocultos.has(o)} onClick={() => alternar(o)}>
                <i style={{ background: cor(o === RESTO ? '--s0' : slotOrigem(o)) }} />{o} ({contar(o)})
              </button>
            ))}
          </div>
      ) : (
          <div className="legenda">
            <span className="item"><i style={{ background: cor('--s1') }} />Mediana da coorte</span>
            <span className="item"><i style={{ background: cor('--s1'), opacity: 0.35 }} />1º a 3º quartil da coorte</span>
            <span className="item"><i style={{ background: 'var(--ink-3)', height: 2 }} />Mediana geral</span>
          </div>
      )}
        <Modos valor={modo} onChange={setModo} rotulo="Modo de visualização" opcoes={[['forma', 'Forma'], ['coortes', 'Coortes']]} />
      </div>
      {modo === 'forma' ? <Forma T={T} ocultos={ocultos} /> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,200px),1fr))', gap: 10 }}>
            {coortes.map(q => <Mini key={q} q={q} E={T.envelope_coorte[q]!} G={E} />)}
          </div>
      )}
      <details className="tab">
        <summary>Ver os {N} modelos</summary>
        <div className="tabwrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
          <table className="t">
            <thead><tr><th>Modelo</th><th>Origem</th><th>Coorte</th><th className="num">Pico de share</th><th className="num">Sem. até o pico</th><th className="num">Meia-vida</th><th>Situação</th></tr></thead>
            <tbody>{T.modelos.map(md => (
              <tr key={md.model}>
                <td><Link prefetch={false} href={urlModelo(md.model)}>{rot(md.model)}</Link></td><td>{md.origin}</td><td>{rotTri(md.cohort)}</td>
                <td className="num">{fmtP(md.peak_share)}</td><td className="num">{md.weeks_to_peak}</td>
                <td className="num">{md.half_life_weeks == null ? '—' : `${md.half_life_weeks} sem`}</td>
                <td>{md.still_alive ? 'acima de metade do pico' : 'abaixo de metade do pico'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </details>
      <p className="leitura">{leitura}</p>
    </Cartao>
  );
}
