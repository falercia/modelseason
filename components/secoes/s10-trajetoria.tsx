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
import { useIdioma } from '@/components/shell/Idioma';
import { ORIGEM_SLOT } from '@/lib/cores';
import type { Fmt } from '@/lib/format';
import { rotulador } from './s09-nomes';

export interface Envelope { mediana: number[]; p25: number[]; p75: number[]; n: number[] }
export interface ModeloTraj {
  model: string; vendor: string; origin: string; weights: string; first: string; cohort: string;
  peak_share: number; weeks_to_peak: number; half_life_weeks: number | null; still_alive: boolean; abs: number[]; rel: number[];
}
export interface Trajetoria { max_idade: number; modelos: ModeloTraj[]; envelope_geral: Envelope; envelope_coorte: Record<string, Envelope | null>; coortes: string[] }

/** Rótulo de trimestre no idioma do f: '2025 Q1' vira 'T1 25' / "Q1 '25". */
export const rotTri = (q: string, f: Fmt) => {
  const [a, t] = q.split(' ');
  return f.lang === 'pt' ? `${t.replace('Q', 'T')} ${a.slice(2)}` : `${t} '${a.slice(2)}`;
};
const slotOrigem = (o: string) => ORIGEM_SLOT[o] ?? '--s0';
/** Origens sem cor própria viram um grupo só na legenda: duas entradas cinza seriam indistinguíveis. É chave; o rótulo sai por idioma. */
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
  const { t, f, modelo, valor } = useIdioma();
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
  const rot = rotulador(T.modelos.map(md => md.model), f);
  const mostrados = T.modelos.filter(md => !ocultos.has(grupoOrigem(md.origin)));
  const ln = d3.line<number>().x((_, i) => x(i)).y(v => y(v)).curve(d3.curveMonotoneX);
  const faixa = d3.area<number>().x((_, i) => x(i)).y0((_, i) => y(E.p25[i])).y1(v => y(v)).curve(d3.curveMonotoneX);
  const { pico, meia } = marcos(E.mediana);
  const xt = x.ticks(w < 560 ? 5 : 9).filter(Number.isInteger);
  const unSem = t({ pt: 'sem', en: 'wk' });

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
  const marcas: [number, string][] = [[pico, t({ pt: 'pico da mediana', en: 'median peak' })], [meia, t({ pt: 'metade do pico', en: 'half of peak' })]];
  return (
    <div className="plot" ref={ref} onPointerLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${w} ${altura}`} role="img" style={{ height: altura }}
        aria-label={t({
          pt: `${T.modelos.length} modelos alinhados na semana de estreia e normalizados pelo próprio pico. A mediana chega ao pico na semana ${pico}${meia > 0 ? ` e cai à metade na semana ${meia}` : ''}.`,
          en: `${T.modelos.length} models aligned at their debut week and normalized to their own peak. The median peaks in week ${pico}${meia > 0 ? ` and falls to half in week ${meia}` : ''}.`,
        })}>
        <g className="grid">{[0, 25, 50, 75, 100].map(v => <line key={v} x1={m.l} x2={w - m.r} y1={y(v)} y2={y(v)} />)}</g>
        <g className="ax">
          {[0, 25, 50, 75, 100].map(v => <text key={v} x={m.l - 7} y={y(v) + 3.5} textAnchor="end">{v}%</text>)}
          {xt.map(v => <text key={v} x={x(v)} y={altura - m.b + 17} textAnchor="middle">{v === 0 ? t({ pt: 'estreia', en: 'debut' }) : `${v} ${unSem}`}</text>)}
        </g>
        {K - 1 >= DOIS_TRI && (
          <g>
            <line x1={x(DOIS_TRI)} x2={x(DOIS_TRI)} y1={m.t - 8} y2={altura - m.b} stroke="var(--axis)" strokeDasharray="3 4" />
            <text className="ax" x={x(DOIS_TRI) + 5} y={m.t - 10} style={{ fill: 'var(--ink-3)' }}>{t({ pt: 'dois trimestres', en: 'two quarters' })}</text>
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
        {marcas.filter(([i]) => i > 0).map(([i, txt]) => (
          <g key={txt}>
            <circle cx={x(i)} cy={y(E.mediana[i])} r={4.2} fill="var(--ink)" stroke="var(--surface)" strokeWidth={2} />
            <text className="ax" x={x(i) + 9} y={y(E.mediana[i]) - 7} style={HALO}>{txt}: {t({ pt: 'semana', en: 'week' })} {i}</text>
          </g>
        ))}
        {K - 1 >= DOIS_TRI && (
          <g>
            <circle cx={x(DOIS_TRI)} cy={y(E.mediana[DOIS_TRI])} r={3.6} fill="var(--ink)" stroke="var(--surface)" strokeWidth={2} />
            <text className="ax" x={x(DOIS_TRI) + 8} y={y(E.mediana[DOIS_TRI]) - 8} style={{ ...HALO, fill: 'var(--ink-2)' }}>{f.fmtNum(E.mediana[DOIS_TRI])}{t({ pt: '% do pico', en: '% of peak' })}</text>
          </g>
        )}
        {h && <line className="cross" x1={x(h.i)} x2={x(h.i)} y1={m.t} y2={altura - m.b} />}
        {h && !destaque && <circle cx={x(h.i)} cy={y(E.mediana[h.i])} r={3.4} fill="var(--ink)" stroke="var(--surface)" strokeWidth={1.4} />}
        {h && destaque && destaque.rel[h.i] != null && <circle cx={x(h.i)} cy={y(destaque.rel[h.i])} r={3.6} fill={cor(slotOrigem(destaque.origin))} stroke="var(--surface)" strokeWidth={1.4} />}
        <rect x={m.l} y={m.t} width={Math.max(0, w - m.l - m.r)} height={altura - m.t - m.b} fill="transparent"
          style={{ touchAction: 'pan-y', cursor: destaque ? 'pointer' : 'crosshair' }}
          onPointerMove={mover} onPointerDown={mover}
          onClick={() => { if (destaque && tipo.current === 'mouse') router.push(modelo(destaque.model)); }} />
      </svg>
      {h && (
        <div className="tip" style={{ left: tipEsq, top: 4 }}>
          {destaque ? (
            <>
              <div className="t">{rot(destaque.model)}</div>
              <div className="r"><span><i style={{ background: cor(slotOrigem(destaque.origin)) }} />{t({ pt: 'Origem', en: 'Origin' })}</span><b>{valor(destaque.origin)}</b></div>
              <div className="r"><span>{t({ pt: 'Estreia', en: 'Debut' })}</span><b>{f.fD(destaque.first)}</b></div>
              <div className="r"><span>{t({ pt: 'Pico de share', en: 'Peak share' })}</span><b>{f.fmtP(destaque.peak_share)}</b></div>
              <div className="r"><span>{t({ pt: 'Semanas até o pico', en: 'Weeks to peak' })}</span><b>{destaque.weeks_to_peak}</b></div>
              <div className="r"><span>{t({ pt: 'Meia-vida', en: 'Half-life' })}</span><b>{destaque.half_life_weeks == null ? t({ pt: 'ainda não caiu à metade', en: 'not yet down to half' }) : `${destaque.half_life_weeks} ${unSem}`}</b></div>
              <div className="r"><span>{t({ pt: `Na semana ${h.i}`, en: `In week ${h.i}` })}</span><b>{f.fmtNum(destaque.rel[h.i])}{t({ pt: '% do pico', en: '% of peak' })}</b></div>
              {tipo.current === 'mouse' && <div className="r" style={{ color: 'var(--ink-3)' }}><span>{t({ pt: 'clique para abrir o modelo', en: 'click to open the model' })}</span></div>}
            </>
          ) : (
            <>
              <div className="t">{h.i === 0 ? t({ pt: 'Semana de estreia', en: 'Debut week' }) : t({ pt: `Semana ${h.i} desde a estreia`, en: `Week ${h.i} since debut` })}</div>
              <div className="r"><span><i style={{ background: 'var(--ink)' }} />{t({ pt: 'Mediana', en: 'Median' })}</span><b>{f.fmtNum(E.mediana[h.i])}{t({ pt: '% do pico', en: '% of peak' })}</b></div>
              <div className="r"><span><i style={{ background: cor('--s1'), opacity: 0.4 }} />{t({ pt: '1º a 3º quartil', en: '1st to 3rd quartile' })}</span><b>{f.fmtNum(E.p25[h.i])}% {t({ pt: 'a', en: 'to' })} {f.fmtNum(E.p75[h.i])}%</b></div>
              <div className="r"><span>{t({ pt: 'Modelos com essa idade', en: 'Models at this age' })}</span><b>{E.n[h.i]}</b></div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ modo coortes

function Mini({ q, E, G }: { q: string; E: Envelope; G: Envelope }) {
  const { t, f } = useIdioma();
  const [ref, w] = useLargura<HTMLDivElement>(200);
  const [hi, setHi] = useState<number | null>(null);
  const K = G.mediana.length, h = 138, m = { t: 8, r: 8, b: 18, l: 30 };
  const x = d3.scaleLinear().domain([0, K - 1]).range([m.l, w - m.r]);
  const y = d3.scaleLinear().domain([0, 100]).range([h - m.b, m.t]);
  const ln = d3.line<number>().x((_, i) => x(i)).y(v => y(v)).curve(d3.curveMonotoneX);
  const faixa = d3.area<number>().x((_, i) => x(i)).y0((_, i) => y(E.p25[i])).y1(v => y(v)).curve(d3.curveMonotoneX);
  const { meia } = marcos(E.mediana);
  const obs = E.mediana.length;
  const tri = rotTri(q, f);
  const mover = (ev: React.PointerEvent<SVGRectElement>) => {
    const r = (ev.currentTarget as SVGRectElement).getBoundingClientRect();
    const px = m.l + (ev.clientX - r.left) * ((w - m.l - m.r) / r.width);
    setHi(Math.max(0, Math.min(K - 1, Math.round(x.invert(px)))));
  };
  return (
    <div style={{ minWidth: 0, background: 'var(--surface-2)', borderRadius: 9, padding: '9px 10px 8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <b style={{ fontSize: 13 }}>{tri}</b>
        <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>n={E.n[0]}</span>
      </div>
      <div className="plot" ref={ref} onPointerLeave={() => setHi(null)}>
        <svg viewBox={`0 0 ${w} ${h}`} role="img" style={{ height: h }}
          aria-label={t({
            pt: `Coorte ${tri}, ${E.n[0]} modelos: ${meia > 0 ? `a mediana cai à metade do pico na semana ${meia}` : `a mediana ainda não caiu à metade do pico em ${obs - 1} semanas observadas`}.`,
            en: `${tri} cohort, ${E.n[0]} ${E.n[0] === 1 ? 'model' : 'models'}: ${meia > 0 ? `the median falls to half of peak in week ${meia}` : `the median has not yet fallen to half of peak after ${obs - 1} observed ${obs - 1 === 1 ? 'week' : 'weeks'}`}.`,
          })}>
          <g className="grid">{[0, 50, 100].map(v => <line key={v} x1={m.l} x2={w - m.r} y1={y(v)} y2={y(v)} />)}</g>
          <g className="ax">
            {[0, 50, 100].map(v => <text key={v} x={m.l - 5} y={y(v) + 3.5} textAnchor="end" style={{ fontSize: 9.5 }}>{v}%</text>)}
            {[0, 13, 26, 39].filter(v => v <= K - 1).map(v => <text key={v} x={x(v)} y={h - 4} textAnchor="middle" style={{ fontSize: 9.5 }}>{v}</text>)}
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
            <div className="t">{t({ pt: `Semana ${hi}`, en: `Week ${hi}` })}</div>
            <div className="r"><span><i style={{ background: cor('--s1') }} />{tri}</span><b>{E.mediana[hi] != null ? `${f.fmtNum(E.mediana[hi])}%` : t({ pt: 'sem dado', en: 'no data' })}</b></div>
            <div className="r"><span><i style={{ background: 'var(--ink-3)' }} />{t({ pt: 'Geral', en: 'Overall' })}</span><b>{f.fmtNum(G.mediana[hi])}%</b></div>
            {E.n[hi] != null && <div className="r"><span>n</span><b>{E.n[hi]}</b></div>}
          </div>
        )}
      </div>
      <p className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 2 }}>
        {meia > 0
          ? t({ pt: `metade do pico na semana ${meia}`, en: `half of peak in week ${meia}` })
          : t({
            pt: `acima da metade em ${obs - 1} ${obs - 1 === 1 ? 'semana observada' : 'semanas observadas'}`,
            en: `above half after ${obs - 1} observed ${obs - 1 === 1 ? 'week' : 'weeks'}`,
          })}
      </p>
    </div>
  );
}

// ------------------------------------------------------------------ cartão

type ModoVida = 'forma' | 'coortes';

export function CartaoVida({ T }: { T: Trajetoria }) {
  const { t, f, modelo, valor } = useIdioma();
  const [modo, setModo] = useState<ModoVida>('forma');
  const { ocultos, alternar } = useOcultos();
  const rot = rotulador(T.modelos.map(md => md.model), f);
  const E = T.envelope_geral, N = T.modelos.length;
  const { pico, meia } = marcos(E.mediana);
  const contar = (g: string) => T.modelos.filter(md => grupoOrigem(md.origin) === g).length;
  const origens = [...new Set(T.modelos.map(md => grupoOrigem(md.origin)))].sort((a, b) => (a === RESTO ? 1 : b === RESTO ? -1 : contar(b) - contar(a)));
  /** Rótulo exibido do grupo de origem: a chave RESTO não é valor do dado, então tem texto próprio. */
  const nomeOrigem = (o: string) => (o === RESTO ? t({ pt: RESTO, en: 'Other and unknown' }) : valor(o));
  // Aos dois trimestres: quantos dos modelos observados até essa idade seguem acima de metade do pico.
  const obs26 = T.modelos.filter(md => md.rel.length > DOIS_TRI && md.rel[DOIS_TRI] != null);
  const acima26 = obs26.filter(md => md.rel[DOIS_TRI] >= 50).length;
  const coortes = T.coortes.filter(q => T.envelope_coorte[q]);
  const porCoorte = coortes.map(q => { const e = T.envelope_coorte[q]!; return { q, n: e.n[0], obs: e.mediana.length - 1, meia: marcos(e.mediana).meia }; });
  const caidas = porCoorte.filter(c => c.meia > 0);
  const abertas = porCoorte.filter(c => c.meia <= 0);
  const unSem = t({ pt: 'sem', en: 'wk' });

  let leitura: ReactNode;
  if (modo === 'forma') {
    leitura = t({
      pt: <>
        A mediana dos {N} modelos chega ao pico na <b>semana {pico}</b>{meia > 0 ? <> e cai à metade dele na <b>semana {meia}</b></> : null}.
        {E.mediana.length > DOIS_TRI && <> Aos dois trimestres está em <b>{f.fmtNum(E.mediana[DOIS_TRI])}%</b> do pico, e só <b>{acima26}</b> dos {obs26.length} modelos observados até essa idade seguem acima de metade do próprio pico.</>}
        {meia > 0 && pico <= 4 && <> Subida rápida, pico cedo e queda longa: é a forma que se repete, e é por isso que o que dura é o método de avaliação e troca, não a escolha do modelo.</>}
      </>,
      en: <>
        The median of the {N} models peaks in <b>week {pico}</b>{meia > 0 ? <> and falls to half of that peak in <b>week {meia}</b></> : null}.
        {E.mediana.length > DOIS_TRI && <> At two quarters it sits at <b>{f.fmtNum(E.mediana[DOIS_TRI])}%</b> of peak, and only <b>{acima26}</b> of the {obs26.length} models observed to that age remain above half their own peak.</>}
        {meia > 0 && pico <= 4 && <> Fast rise, early peak and a long decline: that is the shape that repeats, and it is why what lasts is the method for evaluating and switching, not the choice of model.</>}
      </>,
    });
  } else {
    leitura = t({
      pt: <>
        Semana em que a mediana de cada coorte cai à metade do pico: {caidas.map((c, i) => <span key={c.q}><b>{rotTri(c.q, f)}</b> na {c.meia}{i < caidas.length - 1 ? ', ' : '.'}</span>)}
        {abertas.length > 0 && <> Ainda não caíram: {abertas.map(c => `${rotTri(c.q, f)} (${c.obs} ${c.obs === 1 ? 'semana observada' : 'semanas observadas'})`).join(', ')}.</>}
        {' '}Coortes recentes têm menos semanas de observação; o fim de cada curva é o limite do dado, não o fim da temporada.
      </>,
      en: <>
        Week in which each cohort&apos;s median falls to half of peak: {caidas.map((c, i) => <span key={c.q}><b>{rotTri(c.q, f)}</b> in week {c.meia}{i < caidas.length - 1 ? ', ' : '.'}</span>)}
        {abertas.length > 0 && <> Not yet down to half: {f.lista(abertas.map(c => `${rotTri(c.q, f)} (${c.obs} observed ${c.obs === 1 ? 'week' : 'weeks'})`))}.</>}
        {' '}Recent cohorts have fewer weeks of observation; the end of each curve is the limit of the data, not the end of the season.
      </>,
    });
  }

  return (
    <Cartao id="life"
      subtitulo={modo === 'forma'
        ? t({
          pt: `${N} modelos alinhados na semana de estreia, cada um normalizado pelo próprio pico. A linha grossa é a mediana; a faixa, o 1º ao 3º quartil. Histórico completo, não responde ao recorte`,
          en: `${N} models aligned at their debut week, each normalized to its own peak. The thick line is the median; the band, the 1st to 3rd quartile. Full history, does not respond to the filtered view`,
        })
        : t({
          pt: 'Mediana por trimestre de lançamento contra a mediana geral, tracejada. Mostra se a temporada está encurtando. Histórico completo, não responde ao recorte',
          en: 'Median by debut quarter against the overall median, dashed. Shows whether the season is getting shorter. Full history, does not respond to the filtered view',
        })}
>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '4px 12px', flexWrap: 'wrap-reverse', marginBottom: 2 }}>
      {modo === 'forma' ? (
          <div className="legenda" role="group" aria-label={t({ pt: 'Origem das curvas: clique para mostrar ou ocultar', en: 'Curve origin: click to show or hide' })}>
            <span className="item"><i style={{ background: 'var(--ink)', height: 3, borderRadius: 1 }} />{t({ pt: `Mediana dos ${N}`, en: `Median of the ${N}` })}</span>
            <span className="item"><i style={{ background: cor('--s1'), opacity: 0.35 }} />{t({ pt: '1º a 3º quartil', en: '1st to 3rd quartile' })}</span>
            {origens.map(o => (
              <button key={o} type="button" aria-pressed={!ocultos.has(o)} onClick={() => alternar(o)}>
                <i style={{ background: cor(o === RESTO ? '--s0' : slotOrigem(o)) }} />{nomeOrigem(o)} ({contar(o)})
              </button>
            ))}
          </div>
      ) : (
          <div className="legenda">
            <span className="item"><i style={{ background: cor('--s1') }} />{t({ pt: 'Mediana da coorte', en: 'Cohort median' })}</span>
            <span className="item"><i style={{ background: cor('--s1'), opacity: 0.35 }} />{t({ pt: '1º a 3º quartil da coorte', en: 'Cohort 1st to 3rd quartile' })}</span>
            <span className="item"><i style={{ background: 'var(--ink-3)', height: 2 }} />{t({ pt: 'Mediana geral', en: 'Overall median' })}</span>
          </div>
      )}
        <Modos valor={modo} onChange={setModo} rotulo={t({ pt: 'Modo de visualização', en: 'View mode' })}
          opcoes={[['forma', t({ pt: 'Forma', en: 'Shape' })], ['coortes', t({ pt: 'Coortes', en: 'Cohorts' })]]} />
      </div>
      {modo === 'forma' ? <Forma T={T} ocultos={ocultos} /> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,200px),1fr))', gap: 10 }}>
            {coortes.map(q => <Mini key={q} q={q} E={T.envelope_coorte[q]!} G={E} />)}
          </div>
      )}
      <details className="tab">
        <summary>{t({ pt: `Ver os ${N} modelos`, en: `See all ${N} models` })}</summary>
        <div className="tabwrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
          <table className="t">
            <thead><tr>
              <th>{t({ pt: 'Modelo', en: 'Model' })}</th><th>{t({ pt: 'Origem', en: 'Origin' })}</th><th>{t({ pt: 'Coorte', en: 'Cohort' })}</th>
              <th className="num">{t({ pt: 'Pico de share', en: 'Peak share' })}</th><th className="num">{t({ pt: 'Sem. até o pico', en: 'Wks to peak' })}</th>
              <th className="num">{t({ pt: 'Meia-vida', en: 'Half-life' })}</th><th>{t({ pt: 'Situação', en: 'Status' })}</th>
            </tr></thead>
            <tbody>{T.modelos.map(md => (
              <tr key={md.model}>
                <td><Link prefetch={false} href={modelo(md.model)}>{rot(md.model)}</Link></td><td>{valor(md.origin)}</td><td>{rotTri(md.cohort, f)}</td>
                <td className="num">{f.fmtP(md.peak_share)}</td><td className="num">{md.weeks_to_peak}</td>
                <td className="num">{md.half_life_weeks == null ? '—' : `${md.half_life_weeks} ${unSem}`}</td>
                <td>{md.still_alive ? t({ pt: 'acima de metade do pico', en: 'above half its peak' }) : t({ pt: 'abaixo de metade do pico', en: 'below half its peak' })}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </details>
      <p className="leitura">{leitura}</p>
    </Cartao>
  );
}
