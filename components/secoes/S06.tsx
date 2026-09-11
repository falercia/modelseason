'use client';
/**
 * Seção 06, "Onde os modelos são usados". Duas fotos sem histórico na fonte:
 * o ranking de apps do último dia e o custo mediano por sessão de cada harness.
 * Nenhuma das duas responde à janela nem aos filtros do Histórico.
 */
import { useMemo, useState } from 'react';
import * as d3 from 'd3';
import type { AppLinha, Mercado } from '@/lib/tipos';
import { Cartao, Modos, Secao } from '@/components/shell/Cartao';
import { cor, useLargura } from '@/components/graficos/base';
import { fD, urlModelo } from '@/lib/format';
import { fmtCusto, fmtCustoCurto, fmtReq, fmtTokReq, fmtTrilhao, fmtVezes, pct, tokPorReq } from '@/components/modelo/comum';

/** O total de referência da fonte é o do ranking geral de 100 apps (campo tokens_top100_T). */
const TOP_FONTE = 100;
/** Cor por harness: slot fixo por entidade. Harness novo entra em cinza até ganhar lugar aqui. */
const HARNESS_SLOT: Record<string, string> = { 'claude-code': '--s1', codex: '--s2', 'hermes-agent': '--s3', 'kilo-code': '--s4' };
const slotHarness = (slug: string) => HARNESS_SLOT[slug] ?? '--s0';
const curtoTurnos = (s: string) => s.replace(' turnos ou mais', ' ou mais').replace(/ turnos?$/, s.startsWith('1 ') ? ' turno' : '');

const CSS = `
.s06-chips{display:flex; flex-wrap:wrap; gap:6px; margin:2px 0 12px}
.s06-apps{display:grid; grid-template-columns:minmax(0,1.65fr) minmax(0,1fr); gap:22px}
.s06-cab,.s06-app{display:grid; grid-template-columns:20px minmax(0,170px) minmax(0,1fr) 62px 64px; gap:0 10px; align-items:center}
.s06-cab{font-size:10px; letter-spacing:.07em; text-transform:uppercase; color:var(--ink-3); padding-bottom:5px; border-bottom:1px solid var(--grid); margin-bottom:4px}
.s06-cab span:nth-child(n+4){text-align:right}
.s06-app{padding:4px 0; font-size:12.5px}
.s06-app .p{font-family:var(--font-mono),monospace; font-size:11px; color:var(--ink-3); text-align:right}
.s06-app .nm{overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--ink); font-weight:500}
.s06-app .br{display:block; height:8px; background:var(--grid); border-radius:2px; overflow:hidden}
.s06-app .br i{display:block; height:100%; border-radius:2px; background:var(--s1)}
.s06-app .v{text-align:right; font-family:var(--font-mono),monospace; font-size:12px; color:var(--ink-2)}
.s06-app .r{text-align:right; font-family:var(--font-mono),monospace; font-size:11px; color:var(--ink-3)}
.s06-alta h4{font-size:12px; font-weight:700; margin-bottom:6px; display:flex; justify-content:space-between; gap:8px; align-items:baseline}
.s06-alta h4 span{font-size:10.5px; font-weight:400; color:var(--ink-3); font-family:var(--font-mono),monospace}
.s06-leg{display:flex; flex-wrap:wrap; gap:4px 14px; margin:2px 0 6px; font-size:12px}
.s06-leg button{border:0; background:transparent; padding:3px 0; display:inline-flex; gap:6px; align-items:center; color:var(--ink-2); cursor:pointer}
.s06-leg button i{width:14px; height:3px; border-radius:2px}
.s06-leg button[aria-pressed="true"]{color:var(--ink); font-weight:600}
.s06-leg button[aria-pressed="true"] i{height:4px}
.s06-det{display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:10px 22px; margin-top:10px}
.s06-det h4{font-size:12px; font-weight:700; margin-bottom:4px}
.s06-mod{display:grid; grid-template-columns:minmax(0,1fr) auto; gap:4px 10px; align-items:baseline; font-size:12.5px; padding:3px 0; border-bottom:1px solid var(--grid)}
.s06-mod:last-child{border-bottom:0}
.s06-mod a{color:var(--ink); text-decoration:none; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:500}
.s06-mod a:hover{text-decoration:underline}
.s06-mod small{color:var(--ink-3); font-size:10.5px; margin-left:6px; font-weight:400}
.s06-mod b{font-family:var(--font-mono),monospace; font-weight:500; font-size:12px; color:var(--ink-2)}
.s06-faixa{display:flex; flex-wrap:wrap; gap:8px 14px; align-items:center; margin-top:14px; padding-top:12px; border-top:1px solid var(--grid)}
.s06-faixa .t{font-size:12.5px; color:var(--ink-2)}
.s06-faixa .t b{color:var(--ink)}
@media (max-width:760px){
  .s06-apps,.s06-det{grid-template-columns:minmax(0,1fr)}
}
@media (max-width:560px){
  .s06-cab,.s06-app{grid-template-columns:18px minmax(0,1.2fr) minmax(0,1fr) 54px 50px; gap:0 7px}
}
`;

export default function S06({ M }: { M: Mercado }) {
  const A = M.apps, S = M.sessoes;
  return (
    <Secao id="s06" n="06" titulo="Onde os modelos são usados"
      sub={<>Em quais aplicativos o tráfego acontece, e quanto custa uma sessão de agente. As duas são fotos da fonte, sem histórico lá, e <b>não respondem à janela nem aos filtros do Histórico</b>.</>}>
      <style href="s06-css" precedence="medium">{CSS}</style>
      {A && A.geral.length ? <Apps A={A} /> : <p className="vazio">O ranking de apps ainda não foi arquivado.</p>}
      <div style={{ height: 14 }} />
      {S && S.resumo.length ? <Sessoes S={S} /> : <p className="vazio">O custo por sessão ainda não foi arquivado.</p>}
    </Secao>
  );
}

/* ─────────────────────────────── apps ─────────────────────────────── */

function Apps({ A }: { A: NonNullable<Mercado['apps']> }) {
  const [cat, setCat] = useState<string>('geral');
  const catSel = A.categorias.find(c => c.key === cat);
  const lista: AppLinha[] = catSel ? catSel.apps : A.geral;
  const max = Math.max(...lista.map(a => a.T), 0) || 1;
  const noGeral = new Set(A.geral.map(a => a.app_id));
  const top = lista[0];
  const comReq = lista.map(a => ({ a, r: tokPorReq(a.T, a.requisicoes) })).filter((x): x is { a: AppLinha; r: number } => x.r != null);
  const pesado = [...comReq].sort((x, y) => y.r - x.r)[0];
  const leve = [...comReq].sort((x, y) => x.r - y.r)[0];
  const top3 = lista.slice(0, 3);
  const soma3 = top3.reduce((s, a) => s + a.T, 0);
  const tot = A.tokens_top100_T;
  const rotulo = catSel ? `em ${catSel.nome}` : 'no ranking geral';

  return (
    <Cartao id="apps" novo subtitulo={`Tokens processados por aplicativo em ${fD(A.dia)}, o último dia publicado pela fonte`}>
      <div className="s06-chips" role="group" aria-label="Ranking de apps">
        <button type="button" className="chip" aria-pressed={cat === 'geral'} onClick={() => setCat('geral')}>Geral</button>
        {A.categorias.map(c => <button key={c.key} type="button" className="chip" aria-pressed={cat === c.key} onClick={() => setCat(c.key)}>{c.nome}</button>)}
      </div>
      <div className="s06-apps">
        <div className="plot" role="img" aria-label={`Apps com mais tokens ${rotulo} em ${fD(A.dia)}: ` + lista.map(a => `${a.nome} ${fmtTrilhao(a.T)}`).join(', ')}>
          <div className="s06-cab" aria-hidden="true"><span /><span>{catSel ? catSel.nome : `Os ${lista.length} maiores`}</span><span /><span>tokens</span><span>tok/req</span></div>
          {lista.map(a => (
            <div className="s06-app" key={a.app_id} title={`${a.nome}: ${fmtTrilhao(a.T)} em ${fmtReq(a.requisicoes)} de requisições`}>
              <span className="p">{a.rank}</span>
              <span className="nm">{a.nome}</span>
              <span className="br"><i style={{ width: `${((100 * a.T) / max).toFixed(1)}%` }} /></span>
              <span className="v">{fmtTrilhao(a.T)}</span>
              <span className="r">{fmtTokReq(tokPorReq(a.T, a.requisicoes))}</span>
            </div>
          ))}
        </div>
        <div className="s06-alta">
          <h4>Em alta <span>critério da fonte</span></h4>
          {A.tendencia.length ? (
            <table className="t">
              <tbody>{A.tendencia.map((a, i) => (
                <tr key={a.app_id}>
                  <td className="num" style={{ width: 18, color: 'var(--ink-3)', textAlign: 'right' }}>{i + 1}</td>
                  <td style={{ maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.nome}{!noGeral.has(a.app_id) && <span className="pill">fora do top {A.geral.length}</span>}
                  </td>
                  <td className="num">{fmtTrilhao(a.T)}</td>
                </tr>
              ))}</tbody>
            </table>
          ) : <p className="vazio">A fonte não publicou a lista em alta neste dia.</p>}
          <p className="nota">Ordem de crescimento recente definida pela fonte; o número é o volume do dia.</p>
        </div>
      </div>
      {top && (
        <p className="leitura">
          <b>{top.nome}</b> lidera {rotulo}, com {fmtTrilhao(top.T)} no dia{tot > 0 && <>, {pct((100 * top.T) / tot)} do volume dos {TOP_FONTE} maiores apps ({fmtTrilhao(tot)})</>}.
          {!catSel && top3.length === 3 && tot > 0 && <> Os três primeiros somam {pct((100 * soma3) / tot)}.</>}
          {pesado && leve && pesado.a.app_id !== leve.a.app_id && (
            <> Por requisição, a carga mais pesada da lista é <b>{pesado.a.nome}</b>, com {fmtTokReq(pesado.r)} tokens por chamada; a mais leve é <b>{leve.a.nome}</b>, com {fmtTokReq(leve.r)}.</>
          )}
        </p>
      )}
      <p className="nota">Só entra app que se identifica para a fonte; chamada direta de API fica de fora. Um app pode aparecer em mais de uma categoria.</p>
    </Cartao>
  );
}

/* ─────────────────────────────── sessões ─────────────────────────────── */

function Sessoes({ S }: { S: NonNullable<Mercado['sessoes']> }) {
  const faixas = useMemo(() => {
    const vistos = new Map<string, string>();
    for (const r of S.resumo) if (!vistos.has(r.turnos)) vistos.set(r.turnos, r.turnos_nome);
    return [...vistos].map(([k, nome]) => ({ k, nome }));
  }, [S]);
  const harness = useMemo(() => S.harness.filter(h => S.resumo.some(r => r.harness === h.nome)), [S]);
  const [hSel, setHSel] = useState<string>(() => harness[0]?.slug ?? '');
  const [fSel, setFSel] = useState<string>(() => faixas[Math.min(2, faixas.length - 1)]?.k ?? '');
  const [hover, setHover] = useState<number | null>(null);
  const [ref, w] = useLargura<HTMLDivElement>();

  const H = harness.find(h => h.slug === hSel) ?? harness[0];
  const cel = (hNome: string, f: string) => S.resumo.find(r => r.harness === hNome && r.turnos === f);

  // escala log: medianas de todos e a faixa mínimo–máximo do harness escolhido
  const m = { t: 14, r: 16, b: 30, l: 62 }, altura = 270;
  const vals = [...S.resumo.map(r => r.mediana), ...S.resumo.filter(r => r.harness === H.nome).flatMap(r => [r.min, r.max])].filter(v => v > 0);
  const y = d3.scaleLog().domain([(d3.min(vals) ?? 0.001) / 1.4, (d3.max(vals) ?? 1) * 1.4]).range([altura - m.b, m.t]);
  const [y0, y1] = y.domain();
  const ticks = d3.range(Math.ceil(Math.log10(y0)), Math.floor(Math.log10(y1)) + 1).map(e => 10 ** e);
  const x = d3.scalePoint<string>().domain(faixas.map(f => f.k)).range([m.l, w - m.r]).padding(0.35);
  const passo = x.step();
  const linha = d3.line<{ k: string; v: number }>().x(d => x(d.k)!).y(d => y(d.v));

  const pontos = (hNome: string) => faixas.map(f => ({ k: f.k, v: cel(hNome, f.k)?.mediana })).filter((d): d is { k: string; v: number } => d.v != null && d.v > 0);
  const ultima = faixas.at(-1)!;
  const naUltima = harness.map(h => ({ h, r: cel(h.nome, ultima.k) })).filter((d): d is { h: typeof H; r: NonNullable<ReturnType<typeof cel>> } => !!d.r)
    .sort((a, b) => a.r.mediana - b.r.mediana);
  const rSelUlt = cel(H.nome, ultima.k);

  // detalhe: harness × faixa
  const rDet = cel(H.nome, fSel);
  const celulas = H.celulas.filter(c => c.turnos === fSel && c.custo != null).sort((a, b) => a.custo - b.custo);
  const nLado = Math.min(5, Math.ceil(celulas.length / 2));
  const baratos = celulas.slice(0, nLado);
  const caros = celulas.slice(nLado).slice(-5).reverse();

  const mover = (ev: React.PointerEvent<SVGSVGElement>) => {
    const r = ev.currentTarget.getBoundingClientRect();
    const px = ((ev.clientX - r.left) / r.width) * w;
    let melhor = 0, dist = Infinity;
    faixas.forEach((f, i) => { const d = Math.abs(x(f.k)! - px); if (d < dist) { dist = d; melhor = i; } });
    setHover(melhor);
  };

  return (
    <Cartao id="sessoes" novo
      subtitulo={`Mediana da fonte por modelo, agregada por harness e faixa de turnos; janela de ${S.janela_dias ?? '—'} dias até ${S.janela_fim ? fD(S.janela_fim) : 'data não informada'}`}>
      <div className="s06-leg" role="group" aria-label="Harness: clique para escolher">
        {harness.map(h => (
          <button key={h.slug} type="button" aria-pressed={h.slug === H.slug} onClick={() => setHSel(h.slug)}>
            <i style={{ background: cor(slotHarness(h.slug)) }} />{h.nome}
          </button>
        ))}
      </div>
      <div className="plot" ref={ref} onPointerLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${w} ${altura}`} style={{ height: altura, touchAction: 'pan-y' }} role="img" onPointerMove={mover} onPointerDown={mover}
          aria-label={`Custo mediano por sessão, em escala logarítmica, por faixa de turnos. ` +
            harness.map(h => `${h.nome}: ` + faixas.map(f => `${f.nome} ${fmtCusto(cel(h.nome, f.k)?.mediana)}`).join(', ')).join('. ')}>
          <g className="grid">{ticks.map(t => <line key={t} x1={m.l} x2={w - m.r} y1={y(t)} y2={y(t)} />)}</g>
          <g className="ax">
            {ticks.map(t => <text key={t} x={m.l - 8} y={y(t) + 3.5} textAnchor="end">{t >= 1 ? 'US$ ' + t : fmtCusto(t)}</text>)}
            {faixas.map(f => <text key={f.k} x={x(f.k)} y={altura - m.b + 18} textAnchor="middle">{curtoTurnos(f.nome)}</text>)}
          </g>
          {/* faixa do modelo mais barato ao mais caro, só no harness escolhido */}
          {faixas.map(f => {
            const r = cel(H.nome, f.k); if (!r || r.min <= 0) return null;
            const larg = Math.min(16, passo * 0.18), rotulos = w >= 520;
            return (
              <g key={'b' + f.k}>
                <rect x={x(f.k)! - larg / 2} width={larg} y={y(r.max)} height={Math.max(1, y(r.min) - y(r.max))} rx={3}
                  fill={cor(slotHarness(H.slug))} opacity={0.16} />
                {rotulos && <text x={x(f.k)! + larg / 2 + 5} y={y(r.max) + 3.5} className="ax" style={{ fontSize: 9.5, stroke: 'var(--surface)', strokeWidth: 3, paintOrder: 'stroke' }}>{fmtCustoCurto(r.max)}</text>}
                {rotulos && <text x={x(f.k)! + larg / 2 + 5} y={y(r.min) + 3.5} className="ax" style={{ fontSize: 9.5, stroke: 'var(--surface)', strokeWidth: 3, paintOrder: 'stroke' }}>{fmtCustoCurto(r.min)}</text>}
              </g>
            );
          })}
          {hover != null && <line className="cross" x1={x(faixas[hover].k)} x2={x(faixas[hover].k)} y1={m.t} y2={altura - m.b} />}
          {[...harness].sort((a, b) => (a.slug === H.slug ? 1 : 0) - (b.slug === H.slug ? 1 : 0)).map(h => {
            const p = pontos(h.nome), sel = h.slug === H.slug;
            return (
              <g key={h.slug} style={{ cursor: 'pointer' }} onClick={() => setHSel(h.slug)}>
                <path d={linha(p) ?? ''} fill="none" stroke={cor(slotHarness(h.slug))} strokeWidth={sel ? 2.6 : 1.6} opacity={sel ? 1 : 0.6} />
                <path d={linha(p) ?? ''} fill="none" stroke="transparent" strokeWidth={14} />
                {p.map(d => <circle key={d.k} cx={x(d.k)} cy={y(d.v)} r={sel ? 4.5 : 3.5} fill={cor(slotHarness(h.slug))} stroke="var(--surface)" strokeWidth={2} />)}
              </g>
            );
          })}
          {pontos(H.nome).map(d => (
            <text key={'v' + d.k} x={x(d.k)! - 9} y={y(d.v) + 3.5} textAnchor="end" className="ax"
              style={{ fontSize: 10.5, fill: 'var(--ink)', fontWeight: 600, stroke: 'var(--surface)', strokeWidth: 3, paintOrder: 'stroke', strokeLinejoin: 'round' }}>
              {fmtCustoCurto(d.v)}
            </text>
          ))}
        </svg>
        <HoverSessoes hover={hover} faixas={faixas} harness={harness} cel={cel} x={x} w={w} />
      </div>
      <details className="tab">
        <summary>Ver os números</summary>
        <div className="tabwrap">
          <table className="t">
            <thead><tr><th>Harness</th><th>Faixa</th><th className="num">Modelos</th><th className="num">Mediana</th><th className="num">Mínimo</th><th className="num">Máximo</th></tr></thead>
            <tbody>{S.resumo.map(r => (
              <tr key={r.harness + r.turnos}><td>{r.harness}</td><td>{r.turnos_nome}</td><td className="num">{r.modelos}</td>
                <td className="num">{fmtCusto(r.mediana)}</td><td className="num">{fmtCusto(r.min)}</td><td className="num">{fmtCusto(r.max)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </details>
      <p className="nota" style={{ marginTop: 6 }}>Escala logarítmica. A faixa clara é o intervalo do modelo mais barato ao mais caro no harness escolhido; o número em negrito é a mediana entre modelos.</p>

      <div className="s06-faixa">
        <Modos valor={fSel} onChange={setFSel} rotulo="Faixa de turnos" opcoes={faixas.map(f => [f.k, curtoTurnos(f.nome)] as [string, string])} />
        {rDet && <span className="t"><b>{H.nome}</b>, {rDet.turnos_nome}: {rDet.modelos} modelos, mediana <b>{fmtCusto(rDet.mediana)}</b>, de {fmtCusto(rDet.min)} a {fmtCusto(rDet.max)}</span>}
      </div>
      {celulas.length ? (
        <div className="s06-det">
          <div>
            <h4>Mais baratos</h4>
            {baratos.map(c => <ModeloCusto key={c.slug} c={c} />)}
          </div>
          <div>
            <h4>Mais caros</h4>
            {caros.length ? caros.map(c => <ModeloCusto key={c.slug} c={c} />) : <p className="nota">Só há um modelo nesta faixa.</p>}
          </div>
        </div>
      ) : <p className="vazio" style={{ marginTop: 10 }}>A fonte não publicou modelos de {H.nome} nesta faixa.</p>}

      {naUltima.length >= 2 && (
        <p className="leitura">
          Com {ultima.nome}, a mediana vai de <b>{fmtCusto(naUltima[0].r.mediana)}</b> no {naUltima[0].h.nome} a <b>{fmtCusto(naUltima.at(-1)!.r.mediana)}</b> no {naUltima.at(-1)!.h.nome}.
          {rSelUlt && rSelUlt.min > 0 && (
            <> Dentro do {H.nome}, na mesma faixa, o custo vai de {fmtCusto(rSelUlt.min)} a {fmtCusto(rSelUlt.max)} conforme o modelo, uma diferença de {fmtVezes(rSelUlt.max / rSelUlt.min).replace('×', ' vezes')}
              {rSelUlt.max / rSelUlt.min > naUltima.at(-1)!.r.mediana / naUltima[0].r.mediana
                ? <>, contra {fmtVezes(naUltima.at(-1)!.r.mediana / naUltima[0].r.mediana).replace('×', ' vezes')} entre harness: a escolha do modelo pesa mais que a da ferramenta.</> : '.'}</>
          )}
        </p>
      )}
      <p className="nao"><b>Diferença entre harness não prova economia.</b> Cada ferramenta atende tarefas, bases de código e usuários diferentes, e a mediana entre modelos não pondera pelo volume de cada um.</p>
    </Cartao>
  );
}

function HoverSessoes({ hover, faixas, harness, cel, x, w }: {
  hover: number | null; faixas: { k: string; nome: string }[]; harness: NonNullable<Mercado['sessoes']>['harness'];
  cel: (h: string, f: string) => NonNullable<Mercado['sessoes']>['resumo'][number] | undefined;
  x: d3.ScalePoint<string>; w: number;
}) {
  if (hover == null) return null;
  const f = faixas[hover];
  const linhas = harness.map(h => ({ h, r: cel(h.nome, f.k) })).filter(d => d.r).sort((a, b) => b.r!.mediana - a.r!.mediana);
  const left = Math.min(Math.max(0, x(f.k)! + 14), Math.max(0, w - 240));
  return (
    <div className="tip" style={{ left, top: 4 }}>
      <div className="t">{f.nome}</div>
      {linhas.map(({ h, r }) => (
        <div className="r" key={h.slug}><span><i style={{ background: cor(slotHarness(h.slug)) }} />{h.nome} <small style={{ color: 'var(--ink-3)' }}>{r!.modelos} mod.</small></span><b>{fmtCusto(r!.mediana)}</b></div>
      ))}
    </div>
  );
}

function ModeloCusto({ c }: { c: NonNullable<Mercado['sessoes']>['harness'][number]['celulas'][number] }) {
  return (
    <div className="s06-mod">
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        <a href={urlModelo(c.slug)}>{c.nome}</a><small>{c.lab}</small>
      </span>
      <b>{fmtCusto(c.custo)}</b>
    </div>
  );
}
