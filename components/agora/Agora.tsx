/**
 * Bloco "Agora": fora do filtro, de propósito. Retrato do mundo no último dia
 * publicado pela fonte, e se sustenta sozinho. Renderizado no servidor: todo
 * número está no HTML, e nenhum é escrito à mão.
 */
import Link from 'next/link';
import * as d3 from 'd3';
import type { Agora as TAgora, LinhaTop } from '@/lib/tipos';
import { BotaoInfo } from '@/components/shell/Info';
import { fD, fmtP, fmtPP, fmtT, fmtUSD, urlModelo, br } from '@/lib/format';
import { iniciais, slotLab } from '@/lib/cores';

function Sparkline({ pontos }: { pontos: { d: string; T: number }[] }) {
  const w = 220, h = 48;
  const x = d3.scaleLinear().domain([0, pontos.length - 1]).range([1, w - 1]);
  const ext = d3.extent(pontos, p => p.T) as [number, number];
  const y = d3.scaleLinear().domain([ext[0] * 0.9, ext[1]]).range([h - 2, 3]);
  const linha = d3.line<{ T: number }>().x((_, i) => x(i)).y(p => y(p.T))(pontos) ?? '';
  const area = d3.area<{ T: number }>().x((_, i) => x(i)).y0(h).y1(p => y(p.T))(pontos) ?? '';
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: h }} role="img"
      aria-label={`Volume diário dos últimos ${pontos.length} dias, de ${fmtT(ext[0])} a ${fmtT(ext[1])}`}>
      <path d={area} fill="var(--s1)" opacity={0.16} />
      <path d={linha} fill="none" stroke="var(--s1)" strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Destacar({ texto, destaques }: { texto: string; destaques: string[] }) {
  if (!destaques.length) return <>{texto}</>;
  const re = new RegExp('(' + destaques.map(d => d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')');
  return <>{texto.split(re).map((p, i) => (destaques.includes(p) ? <em key={i}>{p}</em> : <span key={i}>{p}</span>))}</>;
}

function Posicao({ l }: { l: LinhaTop }) {
  if (l.estreou) return <span className="delta up">novo</span>;
  return null;
}
function MudancaRank({ l, pos }: { l: LinhaTop; pos: number }) {
  if (l.estreou) return <span className="delta up">novo</span>;
  if (l.rank_anterior == null) return <span className="delta up">entrou</span>;
  const d = l.rank_anterior - pos;
  if (!d) return null;
  return <span className={'delta ' + (d > 0 ? 'up' : 'down')}>{d > 0 ? '↑' : '↓'}{Math.abs(d)}</span>;
}

function Top({ linhas, titulo, cap, id, mostrarRank }: { linhas: LinhaTop[]; titulo: string; cap: string; id: string; mostrarRank?: boolean }) {
  const max = linhas[0]?.share || 1;
  return (
    <div className="pod" data-chart={id}>
      <div className="pod-h"><div><h3>{titulo}</h3><p className="cap">{cap}</p></div><BotaoInfo id={id} /></div>
      <ol className="rank" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {linhas.slice(0, 5).map((l, i) => (
          <li className="row" key={l.slug}>
            <span className="pos">{i + 1}</span>
            <span className="ico" style={{ background: `var(${slotLab(l.vendor)})` }} aria-hidden="true">{iniciais(l.lab)}</span>
            <span className="who"><Link className="nm" href={urlModelo(l.slug)}>{l.nome}</Link><span className="lb">{l.lab} · {l.origem}</span></span>
            <span className="val"><span className="pc">{fmtP(l.share)}</span>{mostrarRank ? <MudancaRank l={l} pos={i + 1} /> : <Posicao l={l} />}<br /><span className="tk">{fmtT(l.T)}</span></span>
            <span className="barra"><i style={{ width: `${(100 * l.share / max).toFixed(1)}%`, background: `var(${slotLab(l.vendor)})` }} /></span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function Agora({ A }: { A: TAgora }) {
  const T = A.termometro;
  const j7 = A.janelas['7d'], j30 = A.janelas['30d'];
  const cresc = (v: number | null) => (v == null ? '' : `${v >= 0 ? '+' : '−'}${br(Math.abs(v).toFixed(0))}%`);
  return (
    <section className="agora" id="agora" aria-labelledby="agora-t">
      <div className="ah">
        <h2 id="agora-t">Agora</h2>
        <span className="pulse"><i />dado até {fD(A.ultimo_dia)}</span>
      </div>
      <p className="asub">
        Fora do filtro, de propósito. É o retrato do mercado no último dia publicado pela fonte: quem lidera, quem está subindo, quem estreou, quanto custa e
        quão concentrado está. Janelas de 7 dias ({fD(j7[0])} a {fD(j7[1])}) e de 30 dias.
      </p>

      <div className="manchete" data-chart="manchete">
        <div className="txt">
          <span className="kicker">O que salta aos olhos hoje · regra automática</span>
          <h3><Destacar texto={A.manchete.titulo} destaques={A.manchete.destaques} /></h3>
          <p>{A.manchete.texto}</p>
        </div>
        <div className="spark">
          <Sparkline pontos={T.diario_30d} />
          <span className="cap">volume diário · {T.diario_30d.length} dias · {fmtT(d3.min(T.diario_30d, p => p.T))} a {fmtT(d3.max(T.diario_30d, p => p.T))}</span>
        </div>
      </div>

      <div className="grid3">
        <Top id="agora-top7" titulo="Top 5 · últimos 7 dias" cap={`${fmtT(T.volume_7d_T)} · ${T.modelos_ativos_7d} modelos ativos`} linhas={A.top7} mostrarRank />
        <Top id="agora-top30" titulo="Top 5 · últimos 30 dias" cap={`${fmtT(T.volume_30d_T)} · ${T.modelos_ativos_30d} modelos ativos`} linhas={A.top30} />
        <div className="pod" data-chart="agora-movimentos">
          <div className="pod-h"><div><h3>Quem mexeu esta semana</h3><p className="cap">7 dias contra os 7 anteriores</p></div><BotaoInfo id="agora-movimentos" /></div>
          <p className="mv-lbl">subiu</p>
          <div className="mv">
            {A.subiram.slice(0, 3).map(m => (
              <div className="mv-row" key={m.slug}>
                <Link className="nm" href={urlModelo(m.slug)}>{m.nome}</Link><span className="pp up">{fmtPP(m.delta_pp)}</span>
                <span className="de">{m.lab} · {m.estreou ? 'estreou · ' : ''}{fmtP(m.de)} → {fmtP(m.para)}</span>
              </div>
            ))}
          </div>
          <div className="mv-sep" />
          <p className="mv-lbl">caiu</p>
          <div className="mv">
            {A.cairam.slice(0, 3).map(m => (
              <div className="mv-row" key={m.slug}>
                <Link className="nm" href={urlModelo(m.slug)}>{m.nome}</Link><span className="pp down">{fmtPP(m.delta_pp)}</span>
                <span className="de">{m.lab} · {fmtP(m.de)} → {fmtP(m.para)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mini" data-chart="agora-termometro">
        <div className="m"><div className="k">Volume · 7 dias <BotaoInfo id="agora-termometro" /></div><div className="v">{fmtT(T.volume_7d_T)}</div><div className="d">{cresc(T.crescimento_7d_pct)} vs. 7 dias antes</div></div>
        <div className="m"><div className="k">Preço efetivo</div><div className="v">{fmtUSD(T.preco_efetivo)}</div><div className="d">por 1M tokens · {T.preco_cobertura_pct}% com preço</div></div>
        <div className="m"><div className="k">Concentração</div><div className="v">{fmtP(T.top5_pct)}</div><div className="d">top 5 · HHI {T.hhi}</div></div>
        <div className="m"><div className="k">Labs chineses</div><div className="v">{fmtP(T.china_pct)}</div><div className="d">pesos abertos {fmtP(T.abertos_pct)}</div></div>
        <div className="m"><div className="k">Estreias</div><div className="v">{T.estreias}</div><div className="d">modelos novos em 7 dias</div></div>
      </div>

      <div className="grid2" style={{ marginTop: 14 }}>
        <div className="pod" data-chart="agora-estreias">
          <div className="pod-h"><div><h3>Estrearam nos últimos 7 dias</h3><p className="cap">primeiro volume registrado na janela</p></div><BotaoInfo id="agora-estreias" /></div>
          {A.estreias.length ? (
            <table className="t"><tbody>
              {A.estreias.slice(0, 5).map(e => (
                <tr key={e.slug}><td><Link href={urlModelo(e.slug)}>{e.nome}</Link></td><td>{e.lab}</td><td className="num">{fD(e.primeiro_dia)}</td><td className="num">{fmtP(e.share, 2)}</td></tr>
              ))}
            </tbody></table>
          ) : <p className="vazio">Nenhum modelo estreou nesta janela.</p>}
          {A.estreias.length > 5 && <p className="nota">e mais {A.estreias.length - 5} com volume menor</p>}
        </div>
        <div className="pod" data-chart="agora-idade">
          <div className="pod-h"><div><h3>Idade do topo</h3><p className="cap">dias desde a entrada no catálogo, para os mais usados</p></div><BotaoInfo id="agora-idade" /></div>
          <table className="t"><tbody>
            {A.idade_topo.map(x => (
              <tr key={x.slug}><td><Link href={urlModelo(x.slug)}>{x.nome}</Link></td><td className="num" style={x.dias <= 30 ? { color: 'var(--s2)', fontWeight: 600 } : undefined}>{x.dias} dias</td><td className="num">{fmtP(x.share)}</td></tr>
            ))}
          </tbody></table>
          {(() => { const novos = A.idade_topo.slice(0, 4).filter(x => x.dias <= 31).length; return novos ? <p className="nota">{novos} dos {Math.min(4, A.idade_topo.length)} maiores entraram no catálogo nos últimos 31 dias.</p> : null; })()}
        </div>
      </div>

      <div style={{ marginTop: 22 }} id="lideres">
        <div className="pod-h" style={{ marginBottom: 8 }}>
          <div><h3 style={{ fontSize: 15 }}>Líderes por critério</h3>
            <p className="cap" style={{ fontFamily: 'inherit', fontSize: 12 }}>Três tipos de liderança, com rótulos próprios: desempenho em avaliação, uso observado e adequação a um cenário. Não existe “melhor IA” numa métrica só.</p></div>
          <BotaoInfo id="lideres" />
        </div>
        <div className="grid6">
          {A.lideres.map(l => (
            <div className="lider" key={l.id} data-lider={l.id}>
              <div className="tp"><span className="rot">{l.rotulo}</span><span className="tipo">{l.tipo}</span></div>
              {l.nome ? (
                <>
                  {l.empate?.length ? (
                    <span className="nome">{l.empate.map((e, i) => <span key={e.slug}>{i > 0 && ' e '}<Link className="nome" href={urlModelo(e.slug)}>{e.nome}</Link></span>)}</span>
                  ) : <Link className="nome" href={urlModelo(l.slug!)}>{l.nome}</Link>}
                  <span className="num">
                    {l.unidade === '%' ? fmtP(l.valor) : l.unidade === 'pp' ? fmtPP(l.valor) : l.unidade === 'US$/1M' ? fmtUSD(l.valor) + ' / 1M' : br(String(l.valor))}
                    {l.empate?.length ? ' · empate no valor publicado' : l.vice ? ` · 2º: ${l.vice.nome} (${l.unidade === '%' ? fmtP(l.vice.valor) : br(String(l.vice.valor))})` : ''}
                    {l.inteligencia != null ? ` · índice ${br(String(l.inteligencia))}` : ''}
                  </span>
                </>
              ) : <span className="vazio">Sem dado suficiente para este critério.</span>}
              <span className="crit">{l.criterio}. {l.fonte}{l.as_of ? `, ${fD(l.as_of)}` : ''}{l.n ? `, ${l.n} modelos avaliados` : ''}.</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 22 }}>
        <div className="pod-h" style={{ marginBottom: 8 }}>
          <div><h3 style={{ fontSize: 15 }}>O que mudou desde a semana passada</h3>
            <p className="cap" style={{ fontFamily: 'inherit', fontSize: 12 }}>Até três mudanças, cada uma com a evidência e o que observar. A regra detecta associação; causa exige investigação.</p></div>
          <BotaoInfo id="agora-mudou" />
        </div>
        <div className="mudou">
          {A.mudou.map(m => (
            <div className={'mud ' + m.tipo} key={m.tipo + m.slug}>
              <h4><Link href={urlModelo(m.slug)}>{m.titulo}</Link></h4>
              <p>{m.evidencia}</p>
              <p className="obs"><b>O que observar.</b> {m.observar}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
