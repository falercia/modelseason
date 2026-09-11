'use client';
/**
 * Seção 13: o mapa da temporada. Porte de mapa() e montarPesos() da v1. Os
 * percentis, o rastro e os pesos são calculados no motor (R.mapa); aqui só se
 * desenha, e os sliders devolvem os pesos para o motor via setPesos.
 */
import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { Mercado } from '@/lib/tipos';
import { PESOS_PADRAO, rotuloLab, type PerfilLab, type PesosMapa } from '@/lib/engine';
import { useHistorico } from '@/components/shell/Historico';
import { Cartao, Modos, Secao } from '@/components/shell/Cartao';
import { Legenda, cor, useLargura } from '@/components/graficos/base';
import { ORIGEM_SLOT } from '@/lib/cores';
import { br, fmtCtx, fmtNum, fmtP } from '@/lib/format';
import s from './s13.module.css';

type Modo = 'recursos' | 'indice';
type Ponto = PerfilLab & { px: number };

const ROT_PESO: Record<string, string> = {
  share: 'Share de tokens', gasto: 'Share do gasto', cresc: 'Crescimento de share',
  ctx: 'Janela de contexto', multi: 'Multimodalidade', rac: 'Suporte a raciocínio', ampl: 'Amplitude do catálogo', cad: 'Cadência de lançamento',
};
const GRUPOS: { g: keyof PesosMapa; rot: string; chaves: string[] }[] = [
  { g: 'tracao', rot: 'Eixo vertical, tração', chaves: ['share', 'gasto', 'cresc'] },
  { g: 'cap', rot: 'Eixo horizontal, capacidade declarada', chaves: ['ctx', 'multi', 'rac', 'ampl', 'cad'] },
];
/** Rastro só dos maiores: percentil de laboratório minúsculo oscila por ruído, e vinte linhas cruzando o plano escondem o que importa. */
const RASTRO = 8;
const slotDe = (origem: string) => ORIGEM_SLOT[origem] ?? '--s0';
const ord = (v: number) => Math.round(v) + 'º';
const quadrante = (o: { px: number; y: number }) => (o.y >= 50 ? (o.px >= 50 ? 'Líderes' : 'Desafiantes') : (o.px >= 50 ? 'Promessas' : 'Nichados'));
const QUADS = [
  { k: 'Líderes', d: 'tração e capacidade acima da mediana' },
  { k: 'Desafiantes', d: 'muito uso, capacidade abaixo da mediana' },
  { k: 'Promessas', d: 'capacidade alta, pouca tração' },
  { k: 'Nichados', d: 'as duas abaixo da mediana' },
];
const lista = (xs: string[]) => (xs.length ? (xs.length === 1 ? xs[0] : xs.slice(0, -1).join(', ') + ' e ' + xs.at(-1)) : 'nenhum');

function Mapa({ labs, antes, modo, per, unid }: {
  labs: Ponto[]; antes: Record<string, { x: number; xAA?: number; y: number }>; modo: Modo; per: number; unid: string;
}) {
  const [ref, w] = useLargura<HTMLDivElement>();
  const [hover, setHover] = useState<string | null>(null);
  const estreito = w < 560;
  const h = estreito ? 380 : 470;
  const m = estreito ? { t: 20, r: 14, b: 42, l: 38 } : { t: 22, r: 26, b: 46, l: 52 };
  const x = d3.scaleLinear().domain([0, 100]).range([m.l, w - m.r]);
  const y = d3.scaleLinear().domain([0, 100]).range([h - m.b, m.t]);
  const r = d3.scaleSqrt().domain([0, d3.max(labs, o => o.tokens) || 1]).range(estreito ? [4, 17] : [5, 26]);
  const porTam = [...labs].sort((a, b) => b.tokens - a.tokens);
  const comRastro = new Set(porTam.slice(0, RASTRO).map(o => o.lab));
  const comRotulo = new Set(porTam.slice(0, estreito ? 9 : porTam.length).map(o => o.lab));

  // Rótulo acima da bolha, empurrado para cima enquanto colidir com um já posto.
  const usados: { x: number; y: number }[] = [];
  const rotulos = porTam.filter(o => comRotulo.has(o.lab)).map(o => {
    const cx = x(o.px), txt = rotuloLab(o.lab), larg = txt.length * 6.4 + 8;
    let py = y(o.y) - r(o.tokens) - 6;
    let tent = 0;
    while (usados.some(u => Math.abs(u.x - cx) < larg / 2 + 30 && Math.abs(u.y - py) < 12) && tent < 8) { py -= 12; tent++; }
    if (py < m.t + 2) py = y(o.y) + r(o.tokens) + 13;
    usados.push({ x: cx, y: py });
    const anc = cx - larg / 2 < m.l ? 'start' : cx + larg / 2 > w - m.r ? 'end' : 'middle';
    const ax = anc === 'start' ? Math.max(cx - r(o.tokens), m.l + 2) : anc === 'end' ? Math.min(cx + r(o.tokens), w - m.r - 2) : cx;
    return { lab: o.lab, txt, x: ax, y: py, anc };
  });

  const ativo = hover ? labs.find(o => o.lab === hover) : undefined;
  const tipW = 250;
  const tip = ativo && (() => {
    const cx = x(ativo.px), cy = y(ativo.y), rr = r(ativo.tokens);
    const left = cx + rr + 10 + tipW < w ? cx + rr + 10 : Math.max(0, cx - rr - 10 - tipW);
    const top = Math.max(0, Math.min(cy - 50, h - 300));
    const comp = modo === 'indice'
      ? [['Melhor Índice de Inteligência', fmtNum(ativo.aa, 1)]]
      : ['ctx', 'multi', 'rac', 'ampl', 'cad'].map(k => [ROT_PESO[k], ord(ativo.pct[k])]);
    return (
      <div className="tip" style={{ left, top, width: tipW }}>
        <div className="t">{rotuloLab(ativo.lab)}</div>
        <div className="r"><span><i style={{ background: cor(slotDe(ativo.origem)) }} />Origem</span><b>{ativo.origem}</b></div>
        <div className="r"><span>Tração, percentil</span><b>{ord(ativo.y)}</b></div>
        <div className="r"><span>Capacidade, percentil</span><b>{ord(ativo.px)}</b></div>
        <div className="r" style={{ opacity: 0.7, marginTop: 4 }}><span>decomposição em percentis</span><b /></div>
        {['share', 'gasto', 'cresc'].map(k => <div className="r" key={k}><span>{ROT_PESO[k]}</span><b>{ord(ativo.pct[k])}</b></div>)}
        {comp.map(([k, v]) => <div className="r" key={k}><span>{k}</span><b>{v}</b></div>)}
        <div className="r" style={{ opacity: 0.7, marginTop: 4 }}><span>valores</span><b /></div>
        <div className="r"><span>Share de tokens</span><b>{fmtP(ativo.share)}</b></div>
        <div className="r"><span>Share do gasto</span><b>{fmtP(ativo.shareG)}</b></div>
        <div className="r"><span>Modelos com volume</span><b>{ativo.ampl}</b></div>
      </div>
    );
  })();

  const q = (px: number, py: number, t: string, anc: 'start' | 'end') => <text className={s.quad} x={px} y={py} textAnchor={anc}>{t}</text>;
  const cnt = d3.rollup(labs, v => v.length, o => quadrante(o) as string);
  const aria = `Mapa de ${labs.length} laboratórios por percentil de tração (vertical) e de ${modo === 'indice' ? 'Índice de Inteligência' : 'capacidade declarada'} (horizontal). `
    + QUADS.map(qq => `${qq.k}: ${cnt.get(qq.k) ?? 0}`).join(', ') + '.';

  return (
    <div className={'plot ' + s.plot} ref={ref} onPointerLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={aria} style={{ height: h }}>
        <g className="grid">{[0, 25, 75, 100].map(v => <g key={v}><line x1={m.l} x2={w - m.r} y1={y(v)} y2={y(v)} /><line x1={x(v)} x2={x(v)} y1={m.t} y2={h - m.b} /></g>)}</g>
        <g className="ax">
          {[0, 25, 50, 75, 100].map(v => <text key={'y' + v} x={m.l - 7} y={y(v) + 3.5} textAnchor="end">{v}</text>)}
          {[0, 25, 50, 75, 100].map(v => <text key={'x' + v} x={x(v)} y={h - m.b + 16} textAnchor="middle">{v}</text>)}
        </g>
        {/* Em percentil a mediana é sempre 50: é ali que os quadrantes se dividem. */}
        <line x1={x(50)} x2={x(50)} y1={m.t} y2={h - m.b} stroke="var(--axis)" strokeWidth={1.5} />
        <line x1={m.l} x2={w - m.r} y1={y(50)} y2={y(50)} stroke="var(--axis)" strokeWidth={1.5} />
        {q(w - m.r - 6, m.t + 13, 'Líderes', 'end')}
        {q(m.l + 6, m.t + 13, 'Desafiantes', 'start')}
        {q(w - m.r - 6, h - m.b - 8, 'Promessas', 'end')}
        {q(m.l + 6, h - m.b - 8, 'Nichados', 'start')}
        <text className={s.eixo} x={(m.l + w - m.r) / 2} y={h - 8} textAnchor="middle">
          {modo === 'indice' ? 'percentil do Índice de Inteligência →' : 'percentil de capacidade declarada →'}
        </text>
        <text className={s.eixo} transform={`translate(12 ${(m.t + h - m.b) / 2}) rotate(-90)`} textAnchor="middle">percentil de tração →</text>

        {per > 0 && labs.filter(o => comRastro.has(o.lab)).map(o => {
          const a = antes[o.lab]; if (!a) return null;
          const ax = modo === 'indice' ? a.xAA : a.x; if (ax == null) return null;
          if (Math.abs(ax - o.px) < 3 && Math.abs(a.y - o.y) < 3) return null;
          // A linha para na borda da bolha, senão parece atravessar o marcador.
          const dx = x(o.px) - x(ax), dy = y(o.y) - y(a.y), d = Math.hypot(dx, dy) || 1, rr = r(o.tokens) + 2;
          const c = cor(slotDe(o.origem));
          return (
            <g key={'r' + o.lab} opacity={0.6}>
              <line x1={x(ax)} y1={y(a.y)} x2={x(o.px) - (dx / d) * rr} y2={y(o.y) - (dy / d) * rr} stroke={c} strokeWidth={1.4} strokeDasharray="3 3" strokeLinecap="round" />
              <circle cx={x(ax)} cy={y(a.y)} r={3} fill="none" stroke={c} strokeWidth={1.4} />
            </g>
          );
        })}
        {porTam.map(o => {
          const c = cor(slotDe(o.origem)), on = hover === o.lab;
          return (
            <circle key={o.lab} className={s.bolha} cx={x(o.px)} cy={y(o.y)} r={r(o.tokens)} fill={c} fillOpacity={on ? 0.85 : 0.45}
              stroke={c} strokeWidth={1.6} onPointerEnter={() => setHover(o.lab)} onPointerDown={() => setHover(o.lab)} />
          );
        })}
        {rotulos.map(l => <text key={'t' + l.lab} className={s.rot} x={l.x} y={l.y} textAnchor={l.anc as 'start'} pointerEvents="none">{l.txt}</text>)}
        {ativo && <circle cx={x(ativo.px)} cy={y(ativo.y)} r={r(ativo.tokens) + 3} fill="none" stroke="var(--ink)" strokeWidth={1.2} pointerEvents="none" />}
      </svg>
      {tip}
    </div>
  );
}

/** Sliders de peso. Mostram o valor na hora e mandam para o motor com um pequeno atraso, para arrastar não recalcular a página a cada pixel. */
function Pesos({ pesos, setPesos, modo }: { pesos: PesosMapa; setPesos: (p: PesosMapa) => void; modo: Modo }) {
  const [loc, setLoc] = useState(pesos);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => setLoc(pesos), [pesos]);
  useEffect(() => () => { if (t.current) clearTimeout(t.current); }, []);
  const mudar = (g: keyof PesosMapa, k: string, v: number) => {
    const novo = { ...loc, [g]: { ...loc[g], [k]: v } } as PesosMapa;
    setLoc(novo);
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => setPesos(novo), 140);
  };
  const padrao = JSON.stringify(loc) === JSON.stringify(PESOS_PADRAO);
  return (
    <div className={s.pesos} role="group" aria-labelledby="s13-pesos-t">
      <h4 id="s13-pesos-t">Pesos dos eixos</h4>
      <p className="nota" style={{ marginTop: 0 }}>A escolha dos pesos é editorial. Mexa para testar se a posição de alguém depende dela. Cada eixo é a média ponderada dos percentis; o número entre parênteses é a fatia efetiva do eixo.</p>
      {GRUPOS.map(({ g, rot, chaves }) => {
        const grupo = loc[g] as Record<string, number>;
        const soma = chaves.reduce((a, k) => a + grupo[k], 0);
        return (
          <div key={g}>
            <div className={s.g}>{rot}{g === 'cap' && modo === 'indice' ? ', sem efeito no modo Índice' : ''}</div>
            {chaves.map(k => {
              const idIn = `s13-p-${g}-${k}`;
              const fat = soma ? Math.round((100 * grupo[k]) / soma) : 0;
              return (
                <div className={s.slider} key={k}>
                  <label htmlFor={idIn}>{ROT_PESO[k]}</label>
                  <input id={idIn} type="range" min={0} max={50} step={5} value={grupo[k]}
                    aria-valuetext={`${grupo[k]}, ${fat}% do eixo`} disabled={g === 'cap' && modo === 'indice'}
                    onChange={e => mudar(g, k, +e.target.value)} />
                  <output htmlFor={idIn}>{grupo[k]}<small>({fat}%)</small></output>
                </div>
              );
            })}
            {soma === 0 && <p className={s.alerta}>Com todos os pesos em zero, este eixo perde o sentido e todos ficam na mesma linha.</p>}
          </div>
        );
      })}
      <div className={s.acoes}>
        <button type="button" className="tbtn" disabled={padrao} onClick={() => { if (t.current) clearTimeout(t.current); setLoc(PESOS_PADRAO); setPesos(PESOS_PADRAO); }}>restaurar padrão</button>
        {!padrao && <span className="nota" style={{ margin: 0 }}>Pesos alterados. O mapa e a leitura já refletem a sua escolha.</span>}
      </div>
    </div>
  );
}

export default function S13(_: { M: Mercado }) {
  const { R, estado, pesos, setPesos } = useHistorico();
  const [modo, setModo] = useState<Modo>('recursos');
  const MP = R.mapa;
  const per = MP.periodos_atras;
  const unid = per === 1 ? (estado.gran === 'semana' ? 'semana' : 'mês') : (estado.gran === 'semana' ? 'semanas' : 'meses');

  const todos: Ponto[] = MP.labs.map(o => ({ ...o, px: (modo === 'indice' ? o.xAA : o.xRec) as number }));
  const labs = todos.filter(o => o.px != null && isFinite(o.px));
  const semX = todos.length - labs.length;

  const sub = modo === 'recursos'
    ? <>Posição relativa entre os <b>{MP.total}</b> laboratórios com volume no último período. Vertical: tração, do share de tokens, do gasto e do crescimento. Horizontal: capacidade declarada, da janela de contexto, multimodalidade, raciocínio, amplitude do catálogo e cadência de lançamento.{per > 0 ? <> O rastro mostra onde cada um estava {per} {unid} antes.</> : null}</>
    : <>Vertical: tração. Horizontal: melhor Índice de Inteligência do catálogo do laboratório. <b>{MP.com_indice} de {MP.total}</b> laboratórios têm ao menos um modelo com índice publicado; os demais ficam fora deste modo.</>;

  const modos = <Modos<Modo> rotulo="Eixo de capacidade" valor={modo} onChange={setModo} opcoes={[['recursos', 'Recursos'], ['indice', 'Índice']]} />;

  let corpo;
  if (!MP.labs.length) corpo = <p className="vazio">Nenhum laboratório com volume no recorte atual.</p>;
  else if (labs.length < 3) corpo = <p className="vazio">{modo === 'indice' ? 'Menos de três laboratórios do recorte têm modelo com índice publicado. O modo Recursos coloca todos no mapa.' : 'Menos de três laboratórios no recorte atual: percentil entre tão poucos não diz nada.'}</p>;
  else {
    const grupos: Record<string, Ponto[]> = { 'Líderes': [], 'Desafiantes': [], 'Promessas': [], 'Nichados': [] };
    labs.forEach(o => grupos[quadrante(o)].push(o));
    const nomes = (k: string) => grupos[k].sort((a, b) => b.tokens - a.tokens).map(o => rotuloLab(o.lab));
    const mov = labs.filter(o => MP.antes[o.lab]).map(o => ({ o, d: o.y - MP.antes[o.lab].y }));
    const sobe = [...mov].sort((a, b) => b.d - a.d)[0], desce = [...mov].sort((a, b) => a.d - b.d)[0];
    const origens = [...new Set(labs.map(o => o.origem))];
    corpo = (
      <>
        <Legenda itens={origens.map(o => ({ key: o, label: o, slot: slotDe(o) }))} />
        <Mapa labs={labs} antes={MP.antes} modo={modo} per={per} unid={unid} />
        <p className="nota">
          Área da bolha proporcional aos tokens do laboratório no último período. {per > 0 ? `Rastro tracejado: posição ${per} ${unid} antes, só para os ${Math.min(RASTRO, labs.length)} maiores. ` : 'A janela não tem período anterior para desenhar o rastro. '}
          {semX > 0 ? `${semX} ${semX === 1 ? 'laboratório sem índice fica' : 'laboratórios sem índice ficam'} fora deste modo.` : ''}
        </p>
        <div className={s.baixo}>
          <Pesos pesos={pesos} setPesos={setPesos} modo={modo} />
          <div className={s.leit} aria-live="polite">
            <h4>Quem está onde</h4>
            <div className={s.quadros}>
              {QUADS.map(qq => (
                <div className={s.quadro} key={qq.k}>
                  <span className={s.k}>{qq.k}</span><span className={s.d}>{qq.d}</span>
                  <span className={s.l}>{lista(nomes(qq.k))}</span>
                </div>
              ))}
            </div>
            {grupos['Desafiantes'].length > 0 && (
              <p>O quadrante dos desafiantes é o que a tese prevê: tração construída sobre preço e disponibilidade, não sobre recurso técnico de fronteira.</p>
            )}
            {per > 0 && sobe && Math.abs(sobe.d) >= 3 ? (
              <p>Maior avanço em tração {per === 1 ? 'no último' : 'nos últimos'} {per} {unid}: <b>{rotuloLab(sobe.o.lab)}</b>, {sobe.d >= 0 ? '+' : '−'}{Math.abs(Math.round(sobe.d))} pontos de percentil.
                {desce && desce.d <= -3 ? <> Maior recuo: <b>{rotuloLab(desce.o.lab)}</b>, −{Math.abs(Math.round(desce.d))}.</> : null}</p>
            ) : per > 0 ? <p>Ninguém se moveu três pontos de percentil ou mais em tração {per === 1 ? 'no último' : 'nos últimos'} {per} {unid}.</p> : null}
            <p><span className={s.flag}>método</span>Os dois eixos são percentis entre os laboratórios presentes, não valores absolutos: subir aqui pode significar que os outros pioraram.</p>
            {modo === 'indice' && MP.com_indice < MP.total && (
              <p><span className={s.flag}>cobertura</span>{MP.total - MP.com_indice} de {MP.total} laboratórios não têm modelo com índice publicado e ficam fora deste modo. O modo Recursos coloca todos no mapa.</p>
            )}
          </div>
        </div>
        <details className="tab">
          <summary>Ver os números</summary>
          <div className="tabwrap">
            <table className="t">
              <thead><tr><th>Laboratório</th><th>Origem</th><th className="num">Tração</th><th className="num">Capacidade</th><th className="num">Share tokens</th><th className="num">Share gasto</th><th className="num">Cresc.</th><th className="num">Modelos</th><th className="num">Contexto</th><th className="num">Índice</th></tr></thead>
              <tbody>{[...labs].sort((a, b) => b.y - a.y).map(o => (
                <tr key={o.lab}><td>{rotuloLab(o.lab)}</td><td>{o.origem}</td><td className="num">{ord(o.y)}</td><td className="num">{ord(o.px)}</td>
                  <td className="num">{fmtP(o.share)}</td><td className="num">{fmtP(o.shareG)}</td>
                  <td className="num">{(o.cresc > 0 ? '+' : o.cresc < 0 ? '−' : '') + br(Math.abs(o.cresc).toFixed(2))} pp</td>
                  <td className="num">{o.ampl}</td><td className="num">{fmtCtx(o.ctx)}</td><td className="num">{o.aa == null ? '—' : fmtNum(o.aa, 1)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </details>
      </>
    );
  }

  return (
    <Secao id="s13" n="13" titulo="O mapa da temporada"
      sub={<>Cada laboratório posicionado pela tração que tem e pela capacidade que declara, em percentil contra os demais. É um mapa de posição relativa, como todo quadrante de mercado, com os pesos abertos para ajuste.</>}>
      <Cartao id="mapa" subtitulo={sub} acoes={modos}>{corpo}</Cartao>
    </Secao>
  );
}
