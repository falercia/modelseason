'use client';
/**
 * Primitivos locais da seção 09: abas acessíveis e o gráfico de linhas com
 * ênfase (porte do emphasisLines() da v1).
 *
 * As abas seguem o padrão WAI-ARIA com ativação automática: setas movem o foco
 * e trocam a aba, Home e End vão às pontas. Os três painéis ficam no HTML, os
 * inativos com o atributo hidden, para o buscador ler o conteúdo de todos.
 */
import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import * as d3 from 'd3';
import { cor, marcasTempo, useLargura } from '@/components/graficos/base';
import { fPer, fmtP } from '@/lib/format';
import type { Gran } from '@/lib/engine';

// ------------------------------------------------------------------ abas

export interface Aba { id: string; rotulo: ReactNode; conteudo: ReactNode }

export function Abas({ prefixo, itens, rotulo }: { prefixo: string; itens: Aba[]; rotulo: string }) {
  const [ativa, setAtiva] = useState(0);
  const botoes = useRef<(HTMLButtonElement | null)[]>([]);
  const ir = (i: number) => {
    const n = (i + itens.length) % itens.length;
    setAtiva(n);
    botoes.current[n]?.focus();
  };
  const tecla = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const mapa: Record<string, number> = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: itens.length - 1 };
    if (e.key in mapa) { e.preventDefault(); ir(mapa[e.key]); }
  };
  return (
    <>
      <div className="abas" role="tablist" aria-label={rotulo}>
        {itens.map((it, i) => (
          <button key={it.id} ref={el => { botoes.current[i] = el; }} type="button" role="tab"
            id={`${prefixo}-aba-${it.id}`} aria-selected={i === ativa} aria-controls={`${prefixo}-painel-${it.id}`}
            tabIndex={i === ativa ? 0 : -1} onClick={() => setAtiva(i)} onKeyDown={e => tecla(e, i)}>
            {it.rotulo}
          </button>
        ))}
      </div>
      {itens.map((it, i) => (
        <div key={it.id} role="tabpanel" id={`${prefixo}-painel-${it.id}`} aria-labelledby={`${prefixo}-aba-${it.id}`}
          hidden={i !== ativa} tabIndex={0} style={{ outlineOffset: 4 }}>
          {it.conteudo}
        </div>
      ))}
    </>
  );
}

// ------------------------------------------------------------------ linhas com ênfase

export interface LinhaEnfase {
  key: string; label: string; values: number[];
  /** 'ink' para o foco; senão um slot da paleta. */
  slot: string; foco?: boolean; traco?: string;
}

/**
 * Marcas do eixo x. Janela curta marca os próprios períodos, com data completa,
 * para não repetir o nome do mês em marcas semanais. Janela longa usa as marcas
 * de calendário do base.tsx, com piso de 360px: em tela estreita a contagem
 * cairia para 2 ou 3 e o d3 passaria a marcar só a virada do ano.
 */
function marcasLocais(x: d3.ScaleTime<number, number>, datas: Date[], gran: Gran, largura: number) {
  const N = datas.length;
  if ((gran === 'semana' && N <= 10) || (gran === 'mes' && N <= 12)) {
    const cabe = Math.max(2, Math.floor(largura / (gran === 'mes' ? 52 : 66)));
    const passo = Math.ceil(N / cabe);
    return datas.filter((_, i) => (N - 1 - i) % passo === 0).map(d => ({ d, rot: fPer(d3.timeFormat('%Y-%m-%d')(d), gran) }));
  }
  // As marcas do base.tsx rotulam só o mês; quando o d3 escolhe marcas semanais,
  // o mesmo mês se repete. Fica a primeira marca de cada mês.
  const vistos = new Set<string>();
  return marcasTempo(x, Math.max(360, largura)).filter(({ d }) => {
    const k = `${d.getFullYear()}-${d.getMonth()}`;
    if (vistos.has(k)) return false;
    vistos.add(k); return true;
  });
}

const corDe = (slot: string) => (slot === 'ink' ? 'var(--ink)' : cor(slot));

/** Amostra de legenda em forma de traço, para o tracejado também identificar a série. */
function Amostra({ l }: { l: LinhaEnfase }) {
  return (
    <svg width={18} height={10} aria-hidden="true" style={{ flex: '0 0 18px' }}>
      <line x1={1} x2={17} y1={5} y2={5} stroke={corDe(l.slot)} strokeWidth={l.foco ? 3 : 2} strokeDasharray={l.traco} strokeLinecap="round" />
    </svg>
  );
}

export function LegendaEnfase({ linhas, ocultos, alternar, valor }: {
  linhas: LinhaEnfase[]; ocultos: Set<string>; alternar: (k: string) => void; valor: (l: LinhaEnfase) => string;
}) {
  return (
    <div className="legenda" role="group" aria-label="Séries: clique para mostrar ou ocultar">
      {linhas.map(l => (
        <button key={l.key} type="button" aria-pressed={!ocultos.has(l.key)} onClick={() => alternar(l.key)}
          style={l.foco ? { color: 'var(--ink)', fontWeight: 600 } : undefined}>
          <Amostra l={l} />{l.label} <span className="mono" style={{ color: 'var(--ink-3)', fontSize: 11 }}>{valor(l)}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Share do laboratório em destaque contra os concorrentes. O foco veste tinta,
 * que é ênfase e não identidade; concorrentes com slot de entidade usam a cor
 * dele, os demais ficam em cinza e se distinguem pelo traço e pelo rótulo direto.
 */
export function LinhasEnfase({ eixo, gran, linhas, rotuloAria, altura = 300 }: {
  eixo: string[]; gran: Gran; linhas: LinhaEnfase[]; rotuloAria: string; altura?: number;
}) {
  const [ref, w] = useLargura<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const N = eixo.length;
  const largo = w >= 560;
  const m = { t: 12, r: largo ? 128 : 14, b: 26, l: 40 };
  const datas = eixo.map(s => new Date(s + 'T00:00:00'));
  const x = d3.scaleTime().domain([datas[0], datas[N - 1] ?? datas[0]]).range([m.l, w - m.r]);
  const topo = (d3.max(linhas, l => d3.max(l.values)) ?? 1) * 1.08 || 1;
  const y = d3.scaleLinear().domain([0, topo]).nice(4).range([altura - m.b, m.t]);
  const yt = y.ticks(4);
  const marcas = marcasLocais(x, datas, gran, w - m.l - m.r);
  const linha = d3.line<number>().x((_, i) => x(datas[i])).y(v => y(v)).curve(d3.curveMonotoneX);
  const ult = N - 1;

  // Rótulos diretos na ponta direita, empurrados para não colidir.
  const rot = linhas.map(l => ({ l, y: y(l.values[ult] ?? 0), v: l.values[ult] ?? 0 })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < rot.length; i++) if (rot[i].y - rot[i - 1].y < 13) rot[i].y = rot[i - 1].y + 13;
  const maxY = altura - m.b - 2;
  if (rot.length && rot[rot.length - 1].y > maxY) {
    rot[rot.length - 1].y = maxY;
    for (let i = rot.length - 2; i >= 0; i--) if (rot[i + 1].y - rot[i].y < 13) rot[i].y = rot[i + 1].y - 13;
  }

  const mover = (ev: React.PointerEvent<SVGRectElement>) => {
    const r = (ev.currentTarget as SVGRectElement).getBoundingClientRect();
    const px = ((ev.clientX - r.left) / r.width) * (w - m.l - m.r) + m.l;
    const i = d3.bisector((d: Date) => d).center(datas, x.invert(px));
    setHover(Math.max(0, Math.min(N - 1, i)));
  };
  // Ordem de desenho: concorrentes primeiro, foco por cima.
  const ordem = [...linhas.filter(l => !l.foco), ...linhas.filter(l => l.foco)];

  return (
    <div className="plot" ref={ref} onPointerLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${w} ${altura}`} role="img" aria-label={rotuloAria} style={{ height: altura }}>
        <g className="grid">{yt.map(t => <line key={t} x1={m.l} x2={w - m.r} y1={y(t)} y2={y(t)} />)}</g>
        <g className="ax">
          {yt.map(t => <text key={t} x={m.l - 7} y={y(t) + 3.5} textAnchor="end">{fmtP(t, 0)}</text>)}
          {marcas.map(({ d, rot: r }) => <text key={+d} x={x(d)} y={altura - m.b + 16} textAnchor="middle">{r}</text>)}
        </g>
        {ordem.map(l => (
          <path key={l.key} d={linha(l.values) ?? ''} fill="none" stroke={corDe(l.slot)} strokeWidth={l.foco ? 3 : 1.6}
            strokeDasharray={l.traco} strokeLinecap="round" opacity={l.foco ? 1 : 0.8} />
        ))}
        {ordem.map(l => l.values[ult] != null && (
          <circle key={'p' + l.key} cx={x(datas[ult])} cy={y(l.values[ult])} r={l.foco ? 4 : 2.6} fill={corDe(l.slot)} stroke="var(--surface)" strokeWidth={1.4} />
        ))}
        {largo && rot.map(({ l, y: yy, v }) => (
          <text key={'r' + l.key} className="ax" x={x(datas[ult]) + 9} y={yy + 3.5}
            style={{ fill: l.foco ? 'var(--ink)' : 'var(--ink-3)', fontWeight: l.foco ? 700 : 500 }}>
            {l.label} {fmtP(v, 1)}
          </text>
        ))}
        {hover != null && <line className="cross" x1={x(datas[hover])} x2={x(datas[hover])} y1={m.t} y2={altura - m.b} />}
        {hover != null && linhas.map(l => (
          <circle key={'h' + l.key} cx={x(datas[hover])} cy={y(l.values[hover] ?? 0)} r={3.2} fill={corDe(l.slot)} stroke="var(--surface)" strokeWidth={1.2} />
        ))}
        <rect x={m.l} y={m.t} width={Math.max(0, w - m.l - m.r)} height={altura - m.t - m.b} fill="transparent"
          onPointerMove={mover} onPointerDown={mover} style={{ touchAction: 'pan-y' }} />
      </svg>
      {hover != null && (
        <div className="tip" style={{ left: Math.min(Math.max(0, x(datas[hover]) + 14), Math.max(0, w - 230)), top: 4 }}>
          <div className="t">{fPer(eixo[hover], gran)}</div>
          {[...linhas].sort((a, b) => (b.values[hover] ?? 0) - (a.values[hover] ?? 0)).map(l => (
            <div className="r" key={l.key}>
              <span style={l.foco ? { color: 'var(--ink)', fontWeight: 600 } : undefined}><i style={{ background: corDe(l.slot) }} />{l.label}</span>
              <b>{fmtP(l.values[hover], 1)}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
