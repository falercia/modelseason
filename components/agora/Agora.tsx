/**
 * Bloco "Agora": fora do filtro, de propósito. Retrato do mundo no último dia
 * publicado pela fonte, e se sustenta sozinho. Renderizado no servidor: todo
 * número está no HTML, e nenhum é escrito à mão.
 *
 * Manchete, "o que mudou" e líderes chegam do pipeline como números e chaves
 * (campo "dados" e "id"); a frase é montada aqui, em cada idioma. Sem "dados"
 * (JSON anterior a 11/09/2026), o português usa a frase pronta do pipeline e o
 * inglês cai na regra mais simples, a do líder da semana.
 */
import Link from 'next/link';
import * as d3 from 'd3';
import type { Agora as TAgora, LinhaTop, Lider } from '@/lib/tipos';
import type { Lang, Texto } from '@/lib/i18n';
import { idioma, type Idioma } from '@/lib/idioma';
import { BotaoInfo } from '@/components/shell/Info';
import { iniciais, slotLab } from '@/lib/cores';

function Sparkline({ pontos, I }: { pontos: { d: string; T: number }[]; I: Idioma }) {
  const { t, f } = I;
  const w = 220, h = 48;
  const x = d3.scaleLinear().domain([0, pontos.length - 1]).range([1, w - 1]);
  const ext = d3.extent(pontos, p => p.T) as [number, number];
  const y = d3.scaleLinear().domain([ext[0] * 0.9, ext[1]]).range([h - 2, 3]);
  const linha = d3.line<{ T: number }>().x((_, i) => x(i)).y(p => y(p.T))(pontos) ?? '';
  const area = d3.area<{ T: number }>().x((_, i) => x(i)).y0(h).y1(p => y(p.T))(pontos) ?? '';
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: h }} role="img"
      aria-label={t({ pt: `Volume diário dos últimos ${pontos.length} dias, de ${f.fmtT(ext[0])} a ${f.fmtT(ext[1])}`,
        en: `Daily volume over the last ${pontos.length} days, from ${f.fmtT(ext[0])} to ${f.fmtT(ext[1])}` })}>
      <path d={area} fill="var(--s1)" opacity={0.16} />
      <path d={linha} fill="none" stroke="var(--s1)" strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// ------------------------------------------------------------ manchete

/** Uma casa decimal, sem cortar o zero: "15,0" / "15.0". Mesma regra do pp() do pipeline. */
const casa1 = (I: Idioma, v: number) => I.f.dec(v.toFixed(1));

function Manchete({ A, I }: { A: TAgora; I: Idioma }) {
  const { t, f, nomeLab } = I;
  const M = A.manchete, d = M.dados;
  const em = (s: string) => <em>{s}</em>;
  let titulo: React.ReactNode, texto: React.ReactNode;
  if (d && M.regra === 'lancamento_recente_no_topo' && d.dias != null && d.share != null) {
    const n = d.estreias ?? 0, lab = d.lab ? nomeLab(d.lab) : '';
    titulo = t({
      pt: <>Um modelo lançado há {em(`${d.dias} ${d.dias === 1 ? 'dia' : 'dias'}`)} já leva {em(f.fmtP(d.share))} do tráfego.</>,
      en: <>A model launched {em(`${d.dias} ${d.dias === 1 ? 'day' : 'days'}`)} ago already takes {em(f.fmtP(d.share))} of traffic.</>,
    });
    const subiu = d.de != null && d.para != null;
    texto = t({
      pt: `${d.nome} (${lab}) ${subiu ? `foi de ${f.fmtP(d.de)} para ${f.fmtP(d.para)} em uma semana.` : 'está entre os três mais usados da semana.'}`
        + (n ? ` ${n} ${n === 1 ? 'modelo estreou' : 'modelos estrearam'} nos últimos sete dias.` : ''),
      en: `${d.nome} (${lab}) ${subiu ? `went from ${f.fmtP(d.de)} to ${f.fmtP(d.para)} in one week.` : 'is among the three most used models this week.'}`
        + (n ? ` ${n} ${n === 1 ? 'model' : 'models'} debuted in the last seven days.` : ''),
    });
  } else if (d && M.regra === 'maior_alta' && d.delta_pp != null && d.de != null && d.para != null) {
    titulo = t({
      pt: <>{d.nome} ganhou {em(`${casa1(I, d.delta_pp)} pontos`)} de share em uma semana.</>,
      en: <>{d.nome} gained {em(`${casa1(I, d.delta_pp)} points`)} of share in one week.</>,
    });
    texto = t({
      pt: `Saiu de ${f.fmtP(d.de)} para ${f.fmtP(d.para)} do volume. É a maior alta entre as duas últimas janelas de sete dias.`,
      en: `It went from ${f.fmtP(d.de)} to ${f.fmtP(d.para)} of volume, the biggest gain between the last two seven-day windows.`,
    });
  } else if (d && M.regra === 'troca_de_lider' && d.share != null && d.rank_anterior != null) {
    titulo = t({ pt: <>{d.nome} assumiu a liderança com {em(f.fmtP(d.share))} do tráfego.</>, en: <>{d.nome} took the lead with {em(f.fmtP(d.share))} of traffic.</> });
    texto = t({ pt: `Na semana anterior ele era o ${f.ord(d.rank_anterior)}.`, en: `The week before, it ranked ${f.ord(d.rank_anterior)}.` });
  } else if (d && M.regra === 'lider_estavel' && d.share != null) {
    titulo = t({ pt: <>{d.nome} segue na liderança, com {em(f.fmtP(d.share))} do tráfego.</>, en: <>{d.nome} still leads, with {em(f.fmtP(d.share))} of traffic.</> });
    texto = t({ pt: `Em 30 dias, o líder é ${d.lider_30d}.`, en: `Over 30 days, the leader is ${d.lider_30d}.` });
  } else if (I.pt) {
    titulo = <Destacar texto={M.titulo} destaques={M.destaques} />;
    texto = M.texto;
  } else {
    const x = A.top7[0], y = A.top30[0];
    titulo = <>{x.nome} leads, with {em(f.fmtP(x.share))} of traffic.</>;
    texto = `Over 30 days, the leader is ${y.nome}.`;
  }
  return <><h3>{titulo}</h3><p>{texto}</p></>;
}

function Destacar({ texto, destaques }: { texto: string; destaques: string[] }) {
  if (!destaques.length) return <>{texto}</>;
  const re = new RegExp('(' + destaques.map(d => d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')');
  return <>{texto.split(re).map((p, i) => (destaques.includes(p) ? <em key={i}>{p}</em> : <span key={i}>{p}</span>))}</>;
}

// ------------------------------------------------------------ o que mudou

function Mudanca({ m, I }: { m: TAgora['mudou'][number]; I: Idioma }) {
  const { t, f, modelo } = I;
  const d = m.dados;
  let titulo = m.titulo, evidencia = m.evidencia, observar = m.observar;
  if (d && m.tipo === 'subiu' && d.de != null && d.para != null && d.delta_pp != null) {
    titulo = t({ pt: `${d.nome} ganhou espaço`, en: `${d.nome} gained ground` });
    evidencia = t({
      pt: `Share de ${f.fmtP(d.de)} para ${f.fmtP(d.para)} entre as duas últimas janelas de 7 dias (${f.fmtPP(d.delta_pp)}).`,
      en: `Share went from ${f.fmtP(d.de)} to ${f.fmtP(d.para)} between the last two 7-day windows (${f.fmtPP(d.delta_pp)}).`,
    });
    observar = t({
      pt: 'Uma semana é pico ou tendência? A regra só chama de sustentado quando a alta se repete em janelas sem sobreposição.',
      en: 'Is one week a spike or a trend? The rule only calls it sustained when the gain repeats in non-overlapping windows.',
    });
  } else if (d && m.tipo === 'caiu' && d.de != null && d.para != null && d.delta_pp != null) {
    titulo = t({ pt: `${d.nome} perdeu espaço`, en: `${d.nome} lost ground` });
    evidencia = t({ pt: `Share de ${f.fmtP(d.de)} para ${f.fmtP(d.para)} (${f.fmtPP(d.delta_pp)}).`, en: `Share went from ${f.fmtP(d.de)} to ${f.fmtP(d.para)} (${f.fmtPP(d.delta_pp)}).` });
    const ml = d.mesmo_lab;
    observar = ml
      ? t({ pt: `No mesmo laboratório, ${ml.nome} subiu ${f.fmtPP(ml.delta_pp)}. A queda coincide com a troca de geração, o que não prova migração.`,
            en: `At the same lab, ${ml.nome} rose ${f.fmtPP(ml.delta_pp)}. The drop coincides with a generation change, which does not prove migration.` })
      : t({ pt: 'Queda de share pode ser crescimento dos outros. Confira o volume absoluto na página do modelo antes de concluir.',
            en: 'A falling share can mean the others are growing. Check absolute volume on the model page before drawing a conclusion.' });
  } else if (d && m.tipo === 'estreou' && d.primeiro_dia && d.share != null) {
    titulo = t({ pt: `${d.nome} estreou`, en: `${d.nome} debuted` });
    evidencia = t({
      pt: `Primeiro volume registrado em ${f.fD(d.primeiro_dia)}, já com ${f.fmtP(d.share)} do tráfego da semana.`,
      en: `First volume recorded on ${f.fD(d.primeiro_dia)}, already with ${f.fmtP(d.share)} of the week's traffic.`,
    });
    observar = t({
      pt: 'Estreia no roteador não é data de lançamento, e share de estreia costuma incluir tráfego de teste.',
      en: 'A debut on the router is not a launch date, and debut share often includes test traffic.',
    });
  } else if (!I.pt) return null; // sem "dados", o inglês não inventa: some o cartão
  return (
    <div className={'mud ' + m.tipo}>
      <h4><Link href={modelo(m.slug)}>{titulo}</Link></h4>
      <p>{evidencia}</p>
      <p className="obs"><b>{t({ pt: 'O que observar.', en: 'What to watch.' })}</b> {observar}</p>
    </div>
  );
}

// ------------------------------------------------------------ líderes

/** Rótulo, tipo, critério e fonte de cada líder, pelo id do pipeline. Em português, o texto do pipeline vale. */
const LIDER_EN: Record<string, { rotulo: string; tipo: string; criterio: string; fonte: string }> = {
  inteligencia: { rotulo: 'Overall evaluation', tipo: 'benchmark performance', criterio: 'Highest Artificial Analysis Intelligence Index among evaluated models', fonte: 'Artificial Analysis, via OpenRouter' },
  codigo: { rotulo: 'Coding', tipo: 'benchmark performance', criterio: 'Highest Artificial Analysis Coding Index', fonte: 'Artificial Analysis, via OpenRouter' },
  agentes: { rotulo: 'Agents', tipo: 'benchmark performance', criterio: 'Highest Artificial Analysis Agentic Index', fonte: 'Artificial Analysis, via OpenRouter' },
  uso: { rotulo: 'Usage', tipo: 'observed usage', criterio: 'Highest token share over the last 7 full days', fonte: 'OpenRouter, daily rankings' },
  ganho: { rotulo: 'Share gain', tipo: 'observed usage', criterio: 'Biggest share gain in percentage points, last 7 days against the previous 7', fonte: 'OpenRouter, daily rankings' },
  economico: { rotulo: 'Value pick', tipo: 'fit for a scenario', criterio: 'Lowest price per 1M tokens (75% input, 25% output blend) among the 10 highest Intelligence Index scores', fonte: 'Artificial Analysis, via OpenRouter, catalog prices' },
};

function CartaoLider({ l, I }: { l: Lider; I: Idioma }) {
  const { t, f, modelo } = I;
  const txt = I.pt ? l : { ...l, ...(LIDER_EN[l.id] ?? {}) };
  const val = (v: number | undefined) =>
    l.unidade === '%' ? f.fmtP(v) : l.unidade === 'pp' ? f.fmtPP(v) : l.unidade === 'US$/1M' ? f.fmtUSD(v) + ' / 1M' : f.dec(String(v));
  return (
    <div className="lider" data-lider={l.id}>
      <div className="tp"><span className="rot">{txt.rotulo}</span><span className="tipo">{txt.tipo}</span></div>
      {l.nome ? (
        <>
          {l.empate?.length ? (
            <span className="nome">{l.empate.map((e, i) => <span key={e.slug}>{i > 0 && t({ pt: ' e ', en: ' and ' })}<Link className="nome" href={modelo(e.slug)}>{e.nome}</Link></span>)}</span>
          ) : <Link className="nome" href={modelo(l.slug!)}>{l.nome}</Link>}
          <span className="num">
            {val(l.valor)}
            {l.empate?.length
              ? t({ pt: ' · empate no valor publicado', en: ' · tied on the published value' })
              : l.vice ? ` · ${f.ord(2)}: ${l.vice.nome} (${l.unidade === '%' ? f.fmtP(l.vice.valor) : f.dec(String(l.vice.valor))})` : ''}
            {l.inteligencia != null ? ` · ${t({ pt: 'índice', en: 'index' })} ${f.dec(String(l.inteligencia))}` : ''}
          </span>
        </>
      ) : <span className="vazio">{t({ pt: 'Sem dado suficiente para este critério.', en: 'Not enough data for this criterion.' })}</span>}
      <span className="crit">{txt.criterio}. {txt.fonte}{l.as_of ? `, ${f.fD(l.as_of)}` : ''}{l.n ? t({ pt: `, ${l.n} modelos avaliados`, en: `, ${l.n} models evaluated` }) : ''}.</span>
    </div>
  );
}

// ------------------------------------------------------------ rankings

function Selo({ l, pos, mostrarRank, I }: { l: LinhaTop; pos: number; mostrarRank?: boolean; I: Idioma }) {
  const { t } = I;
  if (l.estreou) return <span className="delta up">{t({ pt: 'novo', en: 'new' })}</span>;
  if (!mostrarRank) return null;
  if (l.rank_anterior == null) return <span className="delta up">{t({ pt: 'entrou', en: 'entered' })}</span>;
  const d = l.rank_anterior - pos;
  if (!d) return null;
  return <span className={'delta ' + (d > 0 ? 'up' : 'down')}>{d > 0 ? '↑' : '↓'}{Math.abs(d)}</span>;
}

function Top({ linhas, titulo, cap, id, mostrarRank, I }: { linhas: LinhaTop[]; titulo: string; cap: string; id: string; mostrarRank?: boolean; I: Idioma }) {
  const { f, modelo, nomeLab, valor } = I;
  const max = linhas[0]?.share || 1;
  return (
    <div className="pod" data-chart={id}>
      <div className="pod-h"><div><h3>{titulo}</h3><p className="cap">{cap}</p></div><BotaoInfo id={id} /></div>
      <ol className="rank" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {linhas.slice(0, 5).map((l, i) => (
          <li className="row" key={l.slug}>
            <span className="pos">{i + 1}</span>
            <span className="ico" style={{ background: `var(${slotLab(l.vendor)})` }} aria-hidden="true">{iniciais(l.lab)}</span>
            <span className="who"><Link className="nm" href={modelo(l.slug)}>{l.nome}</Link><span className="lb">{nomeLab(l.lab)} · {valor(l.origem)}</span></span>
            <span className="val"><span className="pc">{f.fmtP(l.share)}</span><Selo l={l} pos={i + 1} mostrarRank={mostrarRank} I={I} /><br /><span className="tk">{f.fmtT(l.T)}</span></span>
            <span className="barra"><i style={{ width: `${(100 * l.share / max).toFixed(1)}%`, background: `var(${slotLab(l.vendor)})` }} /></span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ------------------------------------------------------------ bloco

export function Agora({ A, lang }: { A: TAgora; lang: Lang }) {
  const I = idioma(lang);
  const { t, f, modelo, nomeLab } = I;
  const T = A.termometro;
  const j7 = A.janelas['7d'];
  const cresc = (v: number | null) => (v == null ? '' : `${v >= 0 ? '+' : '−'}${f.dec(Math.abs(v).toFixed(0))}%`);
  const dias = (n: number) => t({ pt: `${n} ${n === 1 ? 'dia' : 'dias'}`, en: `${n} ${n === 1 ? 'day' : 'days'}` });
  const cab = (h: Texto, cap: Texto, id: string) => (
    <div className="pod-h"><div><h3>{t(h)}</h3><p className="cap">{t(cap)}</p></div><BotaoInfo id={id} /></div>
  );
  return (
    <section className="agora" id="agora" aria-labelledby="agora-t">
      <div className="ah">
        <h2 id="agora-t">{t({ pt: 'Agora', en: 'Now' })}</h2>
        <span className="pulse"><i />{t({ pt: 'dado até', en: 'data through' })} {f.fD(A.ultimo_dia)}</span>
      </div>
      <p className="asub">{t({
        pt: `Fora do filtro, de propósito. É o retrato do mercado no último dia publicado pela fonte: quem lidera, quem está subindo, quem estreou, quanto custa e quão concentrado está. Janelas de 7 dias (${f.fD(j7[0])} a ${f.fD(j7[1])}) e de 30 dias.`,
        en: `Outside the filters, on purpose. This is the market as of the latest day the source published: who leads, who is rising, who debuted, what it costs and how concentrated it is. A 7-day window (${f.fD(j7[0])} to ${f.fD(j7[1])}) and a 30-day window.`,
      })}</p>

      <div className="manchete" data-chart="manchete">
        <div className="txt">
          <span className="kicker">{t({ pt: 'O que salta aos olhos hoje · regra automática', en: 'What stands out today · automatic rule' })}</span>
          <Manchete A={A} I={I} />
        </div>
        <div className="spark">
          <Sparkline pontos={T.diario_30d} I={I} />
          <span className="cap">{t({
            pt: `volume diário · ${T.diario_30d.length} dias · ${f.fmtT(d3.min(T.diario_30d, p => p.T))} a ${f.fmtT(d3.max(T.diario_30d, p => p.T))}`,
            en: `daily volume · ${T.diario_30d.length} days · ${f.fmtT(d3.min(T.diario_30d, p => p.T))} to ${f.fmtT(d3.max(T.diario_30d, p => p.T))}`,
          })}</span>
        </div>
      </div>

      <div className="grid3">
        <Top id="agora-top7" I={I} titulo={t({ pt: 'Top 5 · últimos 7 dias', en: 'Top 5 · last 7 days' })}
          cap={t({ pt: `${f.fmtT(T.volume_7d_T)} · ${T.modelos_ativos_7d} modelos ativos`, en: `${f.fmtT(T.volume_7d_T)} · ${T.modelos_ativos_7d} active models` })} linhas={A.top7} mostrarRank />
        <Top id="agora-top30" I={I} titulo={t({ pt: 'Top 5 · últimos 30 dias', en: 'Top 5 · last 30 days' })}
          cap={t({ pt: `${f.fmtT(T.volume_30d_T)} · ${T.modelos_ativos_30d} modelos ativos`, en: `${f.fmtT(T.volume_30d_T)} · ${T.modelos_ativos_30d} active models` })} linhas={A.top30} />
        <div className="pod" data-chart="agora-movimentos">
          {cab({ pt: 'Quem mexeu esta semana', en: 'Who moved this week' }, { pt: '7 dias contra os 7 anteriores', en: 'Last 7 days vs. the previous 7' }, 'agora-movimentos')}
          <p className="mv-lbl">{t({ pt: 'subiu', en: 'up' })}</p>
          <div className="mv">
            {A.subiram.slice(0, 3).map(m => (
              <div className="mv-row" key={m.slug}>
                <Link className="nm" href={modelo(m.slug)}>{m.nome}</Link><span className="pp up">{f.fmtPP(m.delta_pp)}</span>
                <span className="de">{nomeLab(m.lab)} · {m.estreou ? t({ pt: 'estreou · ', en: 'debuted · ' }) : ''}{f.fmtP(m.de)} → {f.fmtP(m.para)}</span>
              </div>
            ))}
          </div>
          <div className="mv-sep" />
          <p className="mv-lbl">{t({ pt: 'caiu', en: 'down' })}</p>
          <div className="mv">
            {A.cairam.slice(0, 3).map(m => (
              <div className="mv-row" key={m.slug}>
                <Link className="nm" href={modelo(m.slug)}>{m.nome}</Link><span className="pp down">{f.fmtPP(m.delta_pp)}</span>
                <span className="de">{nomeLab(m.lab)} · {f.fmtP(m.de)} → {f.fmtP(m.para)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mini" data-chart="agora-termometro">
        <div className="m"><div className="k">{t({ pt: 'Volume · 7 dias', en: 'Volume · 7 days' })} <BotaoInfo id="agora-termometro" /></div><div className="v">{f.fmtT(T.volume_7d_T)}</div>
          <div className="d">{cresc(T.crescimento_7d_pct)} {t({ pt: 'vs. 7 dias antes', en: 'vs. prior 7 days' })}</div></div>
        <div className="m"><div className="k">{t({ pt: 'Preço efetivo', en: 'Effective price' })}</div><div className="v">{f.fmtUSD(T.preco_efetivo)}</div>
          <div className="d">{t({ pt: `por 1M tokens · ${f.fmtNum(T.preco_cobertura_pct, 0)}% com preço`, en: `per 1M tokens · ${f.fmtNum(T.preco_cobertura_pct, 0)}% priced` })}</div></div>
        <div className="m"><div className="k">{t({ pt: 'Concentração', en: 'Concentration' })}</div><div className="v">{f.fmtP(T.top5_pct)}</div><div className="d">top 5 · HHI {T.hhi}</div></div>
        <div className="m"><div className="k">{t({ pt: 'Labs chineses', en: 'Chinese labs' })}</div><div className="v">{f.fmtP(T.china_pct)}</div>
          <div className="d">{t({ pt: 'pesos abertos', en: 'open weights' })} {f.fmtP(T.abertos_pct)}</div></div>
        <div className="m"><div className="k">{t({ pt: 'Estreias', en: 'Debuts' })}</div><div className="v">{T.estreias}</div>
          <div className="d">{t({ pt: 'modelos novos em 7 dias', en: 'new models in 7 days' })}</div></div>
      </div>

      <div className="grid2" style={{ marginTop: 14 }}>
        <div className="pod" data-chart="agora-estreias">
          {cab({ pt: 'Estrearam nos últimos 7 dias', en: 'Debuted in the last 7 days' }, { pt: 'primeiro volume registrado na janela', en: 'first volume recorded in the window' }, 'agora-estreias')}
          {A.estreias.length ? (
            <table className="t"><tbody>
              {A.estreias.slice(0, 5).map(e => (
                <tr key={e.slug}><td><Link href={modelo(e.slug)}>{e.nome}</Link></td><td>{nomeLab(e.lab)}</td><td className="num">{f.fD(e.primeiro_dia)}</td><td className="num">{f.fmtP(e.share, 2)}</td></tr>
              ))}
            </tbody></table>
          ) : <p className="vazio">{t({ pt: 'Nenhum modelo estreou nesta janela.', en: 'No model debuted in this window.' })}</p>}
          {A.estreias.length > 5 && <p className="nota">{t({ pt: `e mais ${A.estreias.length - 5} com volume menor`, en: `and ${A.estreias.length - 5} more with lower volume` })}</p>}
        </div>
        <div className="pod" data-chart="agora-idade">
          {cab({ pt: 'Idade do topo', en: 'Age of the leaders' }, { pt: 'dias desde a entrada no catálogo, para os mais usados', en: 'days since entering the catalog, for the most used models' }, 'agora-idade')}
          <table className="t"><tbody>
            {A.idade_topo.map(x => (
              <tr key={x.slug}><td><Link href={modelo(x.slug)}>{x.nome}</Link></td><td className="num" style={x.dias <= 30 ? { color: 'var(--s2)', fontWeight: 600 } : undefined}>{dias(x.dias)}</td><td className="num">{f.fmtP(x.share)}</td></tr>
            ))}
          </tbody></table>
          {(() => {
            const k = Math.min(4, A.idade_topo.length), novos = A.idade_topo.slice(0, 4).filter(x => x.dias <= 31).length;
            return novos ? <p className="nota">{t({ pt: `${novos} dos ${k} maiores entraram no catálogo nos últimos 31 dias.`, en: `${novos} of the ${k} largest entered the catalog in the last 31 days.` })}</p> : null;
          })()}
        </div>
      </div>

      <div style={{ marginTop: 22 }} id="lideres">
        <div className="pod-h" style={{ marginBottom: 8 }}>
          <div><h3 style={{ fontSize: 15 }}>{t({ pt: 'Líderes por critério', en: 'Leaders by criterion' })}</h3>
            <p className="cap" style={{ fontFamily: 'inherit', fontSize: 12 }}>{t({
              pt: 'Três tipos de liderança, com rótulos próprios: desempenho em avaliação, uso observado e adequação a um cenário. Não existe “melhor IA” numa métrica só.',
              en: 'Three kinds of leadership, each with its own label: benchmark performance, observed usage and fit for a scenario. There is no “best AI” on a single metric.',
            })}</p></div>
          <BotaoInfo id="lideres" />
        </div>
        <div className="grid6">
          {A.lideres.map(l => <CartaoLider key={l.id} l={l} I={I} />)}
        </div>
      </div>

      <div style={{ marginTop: 22 }}>
        <div className="pod-h" style={{ marginBottom: 8 }}>
          <div><h3 style={{ fontSize: 15 }}>{t({ pt: 'O que mudou desde a semana passada', en: 'What changed since last week' })}</h3>
            <p className="cap" style={{ fontFamily: 'inherit', fontSize: 12 }}>{t({
              pt: 'Até três mudanças, cada uma com a evidência e o que observar. A regra detecta associação; causa exige investigação.',
              en: 'Up to three changes, each with the evidence and what to watch. The rule detects association; causation takes investigation.',
            })}</p></div>
          <BotaoInfo id="agora-mudou" />
        </div>
        <div className="mudou">
          {A.mudou.map(m => <Mudanca key={m.tipo + m.slug} m={m} I={I} />)}
        </div>
      </div>
    </section>
  );
}
