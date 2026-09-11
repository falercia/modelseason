/**
 * Página de modelo, renderizada no servidor. Tudo sai de modelos.json, agora.json
 * e mercado.json; o que depende de interação (o gráfico) é o único componente
 * de cliente. A comparação vai pronta no HTML, sem carregar nada no clique.
 */
import type { Agora, Mercado, Modelo, Modelos } from '@/lib/tipos';
import { Cartao } from '@/components/shell/Cartao';
import { fD, fmtCtx, fmtT, fmtUSD, urlModelo, br } from '@/lib/format';
import { GraficoShare } from './GraficoShare';
import { fmtCusto, fmtModalidade, fmtPesos, nomeAvaliacao, ord, pct, slotMacro } from './comum';

const MEDIDAS_AA = [
  { k: 'aa_inteligencia', rot: 'Inteligência' },
  { k: 'aa_codigo', rot: 'Código' },
  { k: 'aa_agentes', rot: 'Agentes' },
] as const;

const CSS = `
.mp-top{display:grid; grid-template-columns:minmax(0,1fr) minmax(0,340px); gap:18px 36px; align-items:start; margin:8px 0 18px}
.mp-top h1{font-size:30px; margin:6px 0 2px}
.mp-slug{font-family:var(--font-mono),monospace; font-size:12px; color:var(--ink-3); overflow-wrap:anywhere}
.mp-tags{display:flex; flex-wrap:wrap; gap:6px; margin-top:10px}
.mp-tags .pill{margin-left:0; font-size:11px; padding:2px 8px}
.mp-ficha{background:var(--surface); border:1px solid var(--ring); border-radius:11px; padding:12px 16px}
.mp-ficha .ficha{gap:5px 14px}
.mp-ficha .ficha dd{text-align:right; overflow-wrap:anywhere}
.mp-tiles .m .v{font-variant-numeric:normal}
.mp-grid{display:grid; grid-template-columns:minmax(0,1.25fr) minmax(0,1fr); gap:14px; margin-bottom:14px}
.mp-tar{font-size:12.5px}
.mp-tar .ln{display:grid; grid-template-columns:minmax(0,170px) minmax(0,1fr) 46px 64px; gap:0 10px; align-items:center; padding:3px 0}
.mp-tar .nm{display:flex; gap:7px; align-items:center; min-width:0}
.mp-tar .nm span{overflow:hidden; text-overflow:ellipsis; white-space:nowrap}
.mp-tar .nm i{width:8px; height:8px; border-radius:2px; flex:0 0 8px}
.mp-tar .br{display:block; height:8px; background:var(--grid); border-radius:2px; overflow:hidden}
.mp-tar .br i{display:block; height:100%; border-radius:2px}
.mp-tar .v{text-align:right; font-family:var(--font-mono),monospace; font-size:12px; color:var(--ink-2)}
.mp-tar .p{text-align:right; font-family:var(--font-mono),monospace; font-size:10.5px; color:var(--ink-3)}
.mp-tar .ln.cab{font-size:10px; letter-spacing:.07em; text-transform:uppercase; color:var(--ink-3); border-bottom:1px solid var(--grid); padding-bottom:4px; margin-bottom:3px}
.mp-tar .ln.cab span:nth-child(n+3){text-align:right}
.mp-aa{display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; margin-bottom:14px}
.mp-aa > div{border:1px solid var(--grid); border-radius:9px; padding:9px 11px; min-width:0}
.mp-aa .k{font-size:11px; color:var(--ink-3)}
.mp-aa .v{font-size:20px; font-weight:700; letter-spacing:-.01em; margin:1px 0}
.mp-aa .v.sem{font-size:13px; font-weight:500; color:var(--ink-3); margin:6px 0 4px}
.mp-aa .d{font-size:10.5px; color:var(--ink-3); font-family:var(--font-mono),monospace}
.mp-ev{margin-top:4px}
.mp-ev h4{font-size:12.5px; font-weight:700; display:flex; justify-content:space-between; gap:8px; align-items:baseline}
.mp-ev h4 span{font-family:var(--font-mono),monospace; font-weight:500; font-size:12px; color:var(--ink-2)}
.mp-ev .trilho{position:relative; height:10px; background:var(--grid); border-radius:3px; margin:6px 0 4px}
.mp-ev .trilho i{position:absolute; left:0; top:0; bottom:0; border-radius:3px; background:var(--s1)}
.mp-ev .trilho b{position:absolute; top:-3px; bottom:-3px; width:2px; background:var(--ink-3); border-radius:1px}
.mp-ev p{font-size:11.5px; color:var(--ink-3)}
.mp-ev + .mp-ev{margin-top:14px}
table.t tr.eu td{background:var(--surface-2); color:var(--ink); font-weight:600}
table.t tr.eu td:first-child{box-shadow:inset 3px 0 0 var(--accent); padding-left:10px}
table.t tr.grp td{font-size:10px; letter-spacing:.08em; text-transform:uppercase; color:var(--ink-3); padding-top:12px; font-weight:500; background:transparent}
table.t td.nm{white-space:nowrap}
.mp-comp td:first-child,.mp-comp th:first-child{position:sticky; left:0; background:var(--surface); z-index:1}
.mp-comp tr.eu td:first-child{background:var(--surface-2)}
.mp-comp small.lab{display:none; color:var(--ink-3); font-size:10.5px; font-weight:400}
@media (max-width:560px){ .mp-comp .col-lab{display:none} .mp-comp small.lab{display:block} .mp-comp .pill{display:none} }
.mp-prov td{white-space:nowrap}
.mp-lead{font-size:14px; color:var(--ink-2); max-width:62ch; margin-top:12px}
.mp-lead b{color:var(--ink)}
@media (max-width:900px){ .mp-top,.mp-grid{grid-template-columns:minmax(0,1fr)} }
@media (max-width:760px){ .mp-tiles{grid-template-columns:repeat(2,minmax(0,1fr))} .mp-top h1{font-size:25px} .mp-aa{grid-template-columns:repeat(3,minmax(0,1fr)); gap:6px} .mp-aa .v{font-size:17px} }
@media (max-width:560px){
  .mp-tar .ln{grid-template-columns:minmax(0,1fr) 46px 52px; gap:0 8px}
  .mp-tar .ln.cab span:nth-child(2){display:none}
  .mp-tar .ln .nm{grid-column:1; grid-row:1} .mp-tar .ln .v{grid-column:2; grid-row:1} .mp-tar .ln .p{grid-column:3; grid-row:1}
  .mp-tar .ln .br{grid-column:1/-1; grid-row:2; margin:4px 0 3px} }
`;

const valorAA = (m: Modelo, k: (typeof MEDIDAS_AA)[number]['k']) => {
  const v = m[k]; return typeof v === 'number' && isFinite(v) ? v : null;
};
const mediana = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b); const n = s.length;
  return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null;
};
const fmtIdx = (v: number | null) => (v == null ? '—' : br(v.toFixed(1)));
const fmtTokens = (v: number) => (v >= 0.01 ? fmtT(v) : v > 0 ? '<0,01T' : '0T');
/** Preço de tabela: duas casas no mínimo, três abaixo de 1 dólar quando a terceira existe. */
const fmtPreco = (v: number | null | undefined) => {
  if (v == null || !isFinite(v)) return '—';
  if (v === 0) return 'grátis';
  if (v >= 1) return fmtUSD(v);
  const s = v.toFixed(3);
  return 'US$ ' + br(s.endsWith('0') ? s.slice(0, -1) : s);
};

export function PaginaModelo({ m, MS, A, Mc, vendorFiltravel }: { m: Modelo; MS: Modelos; A: Agora; Mc: Mercado; vendorFiltravel: boolean }) {
  const todos = Object.values(MS.modelos);
  const ativos7 = todos.filter(x => x.rank_7d != null).length;
  const j7 = A.janelas['7d'];

  // série semanal a partir da estreia: antes dela é ausência, não zero
  const ini = m.primeira_semana ? MS.semanas.indexOf(m.primeira_semana) : -1;
  const semanas = ini >= 0 ? MS.semanas.slice(ini) : [];
  const valores = ini >= 0 ? m.serie_share.slice(ini) : [];
  const pico = m.pico_share != null && m.pico_semana ? { v: m.pico_share, semana: m.pico_semana } : null;
  const ultimo = valores.at(-1);
  const semanasAtePico = pico ? MS.semanas.indexOf(pico.semana) - ini : null;

  // finalidade
  const T = Mc.tarefas;
  const maxTar = Math.max(...m.tarefas.map(t => t.share_na_tarefa), 0) || 1;
  const nTarefas = T?.classificacoes.length ?? 0;
  const maiorPeso = [...m.tarefas].sort((a, b) => b.peso_da_tarefa - a.peso_da_tarefa)[0];

  // provedores
  const P = m.provedores;
  const nProv = new Set(P.map(p => p.provedor)).size;
  const entradas = P.map(p => p.entrada).filter((v): v is number => v != null);
  const nZdr = P.filter(p => p.zdr).length;

  // avaliações: posição entre os modelos que têm o índice, mediana dos avaliados pela fonte
  const posAA = (k: (typeof MEDIDAS_AA)[number]['k']) => {
    const v = valorAA(m, k); if (v == null) return null;
    const com = todos.map(x => valorAA(x, k)).filter((x): x is number => x != null);
    return { v, pos: com.filter(x => x > v).length + 1, n: com.length };
  };
  const evals = Mc.benchmarks?.evals ?? [];
  const avals = m.avaliacoes.map(a => {
    const doTipo = evals.filter(e => e.tipo === a.tipo);
    const minha = doTipo.find(e => e.slug === m.slug);
    const scores = doTipo.map(e => e.score).filter((x): x is number => x != null);
    const custos = doTipo.map(e => e.custo_tarefa).filter((x): x is number => x != null);
    return { ...a, tarefas: minha?.tarefas ?? null, n: doTipo.length, medScore: mediana(scores), medCusto: mediana(custos),
      pos: a.score != null ? scores.filter(s => s > a.score!).length + 1 : null };
  });
  const temAA = MEDIDAS_AA.some(({ k }) => valorAA(m, k) != null);

  // comparação: 5 maiores proprietários e 5 maiores de pesos abertos nos últimos 7 dias
  const porShare = [...todos].filter(x => (x.share_7d ?? 0) > 0).sort((a, b) => (b.share_7d ?? 0) - (a.share_7d ?? 0));
  const grupos = [
    { rot: 'Proprietários', pesos: 'Proprietário', itens: porShare.filter(x => x.pesos === 'Proprietário').slice(0, 5) },
    { rot: 'Pesos abertos', pesos: 'Open-weights', itens: porShare.filter(x => x.pesos === 'Open-weights').slice(0, 5) },
  ];
  const incluido = grupos.some(g => g.itens.some(x => x.slug === m.slug));
  if (!incluido) {
    const g = grupos.find(g => g.pesos === m.pesos);
    if (g) g.itens = [...g.itens, m].sort((a, b) => (b.share_7d ?? 0) - (a.share_7d ?? 0));
    else grupos.push({ rot: 'Licença não identificada', pesos: m.pesos, itens: [m] });
  }

  const crumbLab = vendorFiltravel ? <a href={`/?vendor=${encodeURIComponent(m.vendor)}#historico`} title={`Histórico filtrado por ${m.lab}`}>{m.lab}</a> : <span>{m.lab}</span>;
  const semCatalogo = m.model_id === undefined;

  return (
    <>
      <style href="mp-css" precedence="medium">{CSS}</style>
      <div className="mp-top">
        <div>
          <nav className="crumb" aria-label="Você está em"><a href="/">Model Season</a> / {crumbLab} /</nav>
          <h1>{m.nome}</h1>
          <div className="mp-slug">{m.slug}</div>
          <div className="mp-tags">
            <span className="pill">{m.lab}</span>
            <span className="pill">{m.origem}</span>
            <span className="pill">{fmtPesos(m.pesos)}</span>
            {m.ativo_no_catalogo === false && <span className="pill">fora do catálogo atual</span>}
            {semCatalogo && <span className="pill">sem ficha no catálogo</span>}
          </div>
          <p className="mp-lead">
            {m.rank_7d && m.share_7d ? <><b>{ord(m.rank_7d)}</b> modelo mais usado no roteador nos últimos 7 dias, com <b>{pct(m.share_7d)}</b> dos tokens.</> : <>Sem volume nos últimos 7 dias.</>}
            {' '}{pico ? <>Pico semanal de {pct(pico.v)} na semana de {fD(pico.semana)}{m.primeira_semana ? <>, e {fmtTokens(m.tokens_total_T)} processados desde {fD(m.primeira_semana)}</> : null}.</> : null}
          </p>
        </div>
        <div className="mp-ficha">
          <dl className="ficha">
            <dt>Lançamento</dt><dd>{m.lancamento ? fD(m.lancamento) : 'não informado'}</dd>
            <dt>Contexto</dt><dd>{m.contexto ? `${fmtCtx(m.contexto)} tokens` : 'não informado'}</dd>
            <dt>Modalidade</dt><dd>{fmtModalidade(m.modalidade) ?? 'não informada'}</dd>
            <dt>Raciocínio</dt><dd>{m.raciocinio == null ? 'não informado' : m.raciocinio ? 'sim' : 'não'}</dd>
            <dt>Licença</dt><dd>{fmtPesos(m.pesos)}</dd>
            <dt>Entrada</dt><dd>{m.preco_entrada == null ? 'não informado' : `${fmtPreco(m.preco_entrada)} / 1M`}</dd>
            <dt>Saída</dt><dd>{m.preco_saida == null ? 'não informado' : `${fmtPreco(m.preco_saida)} / 1M`}</dd>
          </dl>
        </div>
      </div>

      <div className="tiles4 mp-tiles">
        <div className="m">
          <div className="k">Share nos últimos 7 dias</div>
          <div className="v">{m.share_7d && m.share_7d > 0 ? pct(m.share_7d) : '—'}</div>
          <div className="d">{m.rank_7d ? `${ord(m.rank_7d)} de ${ativos7} · ${fD(j7[0])} a ${fD(j7[1])}` : 'sem volume nos últimos 7 dias'}</div>
        </div>
        <div className="m">
          <div className="k">Pico de share semanal</div>
          <div className="v">{pico ? pct(pico.v) : '—'}</div>
          <div className="d">{pico ? `semana de ${fD(pico.semana)}` : 'sem semana completa com volume'}</div>
        </div>
        <div className="m">
          <div className="k">Tokens acumulados</div>
          <div className="v">{m.primeira_semana ? fmtTokens(m.tokens_total_T) : '—'}</div>
          <div className="d">{m.primeira_semana ? `desde a semana de ${fD(m.primeira_semana)}` : 'sem semana completa com volume'}</div>
        </div>
        <div className="m">
          <div className="k">Semanas no top 10</div>
          <div className="v">{m.semanas_top10}</div>
          <div className="d">de {m.semanas_com_volume} {m.semanas_com_volume === 1 ? 'semana' : 'semanas'} com volume</div>
        </div>
      </div>

      <div className="mp-grid">
        <Cartao id="modelo-share">
          {semanas.length >= 2 ? (
            <GraficoShare semanas={semanas} valores={valores} pico={pico} nome={m.nome} />
          ) : semanas.length === 1 ? (
            <p className="vazio">Só uma semana completa até agora: {pct(valores[0])} do volume na semana de {fD(semanas[0])}. O gráfico aparece a partir da segunda semana.</p>
          ) : (
            <p className="vazio">Nenhuma semana completa com volume ainda. O share dos últimos 7 dias, acima, vem da janela diária.</p>
          )}
          {semanas.length >= 2 && pico && ultimo != null && (
            <p className="leitura">
              Estreou na semana de <b>{fD(semanas[0])}</b> e chegou ao pico de <b>{pct(pico.v)}</b>{' '}
              {semanasAtePico === 0 ? 'logo na primeira semana' : <>{semanasAtePico} {semanasAtePico === 1 ? 'semana' : 'semanas'} depois</>}.
              {' '}{pico.semana === semanas.at(-1)
                ? 'A última semana completa é o pico até aqui.'
                : ultimo > 0 ? <>Na última semana completa ficou em {pct(ultimo)}, {Math.round((100 * ultimo) / pico.v)}% do pico.</>
                : <>Na última semana completa não teve volume registrado.</>}
              {m.share_7d != null && m.share_7d > pico.v && <> Nos últimos 7 dias, que já entram na semana em curso, está em {pct(m.share_7d)}, acima do pico semanal.</>}
            </p>
          )}
        </Cartao>

        <Cartao id="modelo-tarefas" novo>
          {!T ? (
            <p className="vazio">A foto de finalidade ainda não foi arquivada.</p>
          ) : m.tarefas.length ? (
            <>
              <div className="mp-tar" role="img" aria-label={`Tarefas em que ${m.nome} está entre os líderes: ` + m.tarefas.map(t => `${t.nome} ${pct(t.share_na_tarefa)}`).join(', ')}>
                <div className="ln cab" aria-hidden="true"><span>Tarefa</span><span /><span>fatia</span><span>peso</span></div>
                {m.tarefas.slice(0, 12).map(t => (
                  <FragTarefa key={t.tag} t={t} max={maxTar} />
                ))}
              </div>
              {m.tarefas.length > 12 && <p className="nota">E mais {m.tarefas.length - 12} tarefas com fatia menor.</p>}
              <p className="leitura">
                Está entre os líderes de <b>{m.tarefas.length}</b> das {nTarefas} tarefas classificadas. A maior fatia é em <b>{m.tarefas[0].nome.toLowerCase()}</b>, {pct(m.tarefas[0].share_na_tarefa)} dos tokens da tarefa
                {maiorPeso && maiorPeso.tag !== m.tarefas[0].tag && <>; na tarefa de maior peso em que aparece, {maiorPeso.nome.toLowerCase()} ({pct(maiorPeso.peso_da_tarefa)} do volume classificado), fica com {pct(maiorPeso.share_na_tarefa)}</>}.
              </p>
            </>
          ) : (
            <p className="vazio">Este modelo não aparece entre os líderes de nenhuma das {nTarefas} tarefas classificadas na foto de {fD(T.as_of)}. Isso não quer dizer que não seja usado para nada: a fonte só lista os maiores de cada tarefa.</p>
          )}
          {T && <p className="nota">Foto da janela móvel de {T.janela_dias} dias até {fD(T.as_of)}. Fatia: tokens do modelo na tarefa sobre os tokens da tarefa. Peso: a tarefa no volume classificado.</p>}
        </Cartao>
      </div>

      <div className="mp-grid">
        <Cartao id="modelo-provedores">
          {P.length ? (
            <>
              <div className="tabwrap" style={{ maxHeight: 340, overflowY: 'auto' }}>
                <table className="t mp-prov">
                  <thead><tr><th>Provedor</th><th className="num">Entrada</th><th className="num">Saída</th><th className="num">Contexto</th><th>Quantização</th><th>Retenção zero</th></tr></thead>
                  <tbody>{P.map((p, i) => (
                    <tr key={i}>
                      <td className="nm">{p.provedor}</td>
                      <td className="num">{fmtPreco(p.entrada)}</td>
                      <td className="num">{fmtPreco(p.saida)}</td>
                      <td className="num">{fmtCtx(p.contexto)}</td>
                      <td>{p.quantizacao && p.quantizacao !== 'unknown' ? p.quantizacao : <span style={{ color: 'var(--ink-3)' }}>não informada</span>}</td>
                      <td>{p.zdr ? 'sim' : <span style={{ color: 'var(--ink-3)' }}>não</span>}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              <p className="leitura">
                <b>{P.length}</b> {P.length === 1 ? 'endpoint' : 'endpoints'} em {nProv} {nProv === 1 ? 'provedor' : 'provedores'}
                {entradas.length > 1 && Math.min(...entradas) !== Math.max(...entradas) && <>, com entrada de {fmtPreco(Math.min(...entradas))} a {fmtPreco(Math.max(...entradas))} por 1M de tokens</>}.
                {' '}{nZdr ? <>{nZdr} com retenção zero de dados.</> : 'Nenhum declara retenção zero de dados.'}
              </p>
              <p className="nota">Preços em dólar por milhão de tokens, do catálogo de endpoints mais recente arquivado.</p>
            </>
          ) : (
            <p className="vazio">{m.ativo_no_catalogo === false || semCatalogo
              ? 'Nenhum endpoint no catálogo arquivado: o modelo saiu do catálogo da fonte ou nunca teve ficha nele.'
              : 'Nenhum endpoint listado para este modelo no catálogo arquivado.'}</p>
          )}
        </Cartao>

        <Cartao id="modelo-avaliacoes">
          {temAA || avals.length ? (
            <>
              <div className="mp-aa">
                {MEDIDAS_AA.map(({ k, rot }) => {
                  const p = posAA(k);
                  return (
                    <div key={k}>
                      <div className="k">{rot}</div>
                      {p ? <><div className="v">{fmtIdx(p.v)}</div><div className="d">{ord(p.pos)} de {p.n}</div></> : <><div className="v sem">sem índice</div><div className="d">não publicado</div></>}
                    </div>
                  );
                })}
              </div>
              {avals.length ? avals.map(a => (
                <div className="mp-ev" key={a.tipo}>
                  <h4>{nomeAvaliacao(a.tipo)} <span>{a.score != null ? pct(100 * a.score) : '—'}</span></h4>
                  {a.score != null && (
                    <div className="trilho" role="img" aria-label={`Acerto ${pct(100 * a.score)}; mediana dos ${a.n} avaliados ${pct(100 * (a.medScore ?? 0))}`}>
                      <i style={{ width: `${(100 * a.score).toFixed(1)}%` }} />
                      {a.medScore != null && <b style={{ left: `calc(${(100 * a.medScore).toFixed(1)}% - 1px)` }} />}
                    </div>
                  )}
                  <p>
                    {a.custo_tarefa != null && <>{fmtCusto(a.custo_tarefa)} por tarefa{a.tarefas ? `, ${a.tarefas} tarefas` : ''}. </>}
                    {a.pos != null && <>{ord(a.pos)} de {a.n} avaliados. </>}
                    Mediana dos avaliados: {a.medScore != null ? pct(100 * a.medScore) : '—'}{a.medCusto != null && <>, {fmtCusto(a.medCusto)} por tarefa</>}.
                  </p>
                </div>
              )) : <p className="nota">A fonte não rodou as próprias avaliações neste modelo.</p>}
              <p className="nota">Índices da Artificial Analysis, expostos pelo catálogo; avaliações rodadas pela fonte{Mc.benchmarks ? ` e arquivadas em ${fD(Mc.benchmarks.as_of)}` : ''}. A marca cinza é a mediana dos avaliados.</p>
            </>
          ) : (
            <p className="vazio">Sem índice da Artificial Analysis e sem avaliação rodada pela fonte para este modelo. Ausência de avaliação não é nota baixa.</p>
          )}
        </Cartao>
      </div>

      <Cartao id="modelo-comparacao">
        <div className="tabwrap">
          <table className="t mp-comp">
            <thead><tr>
              <th>Modelo</th><th className="col-lab">Laboratório</th><th className="num">Share 7 dias</th><th className="num">Preço misto</th><th className="num">Contexto</th>
              <th className="num">Inteligência</th><th className="num">Semanas no top 10</th>
            </tr></thead>
            <tbody>{grupos.map(g => (
              <FragGrupo key={g.rot} rot={g.rot} itens={g.itens} atual={m.slug} />
            ))}</tbody>
          </table>
        </div>
        <p className="nota">Share dos últimos 7 dias ({fD(j7[0])} a {fD(j7[1])}). Preço misto em dólar por milhão de tokens, com 75% de entrada e 25% de saída. Traço é número não publicado, não zero.</p>
      </Cartao>

      <div className="nao" style={{ marginTop: 18 }}>
        <b>O que esta página não diz.</b> Share aqui é fatia do tráfego de um roteador, onde a decisão costuma ser preço por token. Não é participação de mercado, de receita nem de usuários, e não diz qual modelo serve para a sua carga.
      </div>
    </>
  );
}

function FragTarefa({ t, max }: { t: Modelo['tarefas'][number]; max: number }) {
  return (
    <div className="ln">
      <span className="nm" title={t.nome}><i style={{ background: `var(${slotMacro(t.macro)})` }} /><span>{t.nome}</span></span>
      <span className="br"><i style={{ width: `${((100 * t.share_na_tarefa) / max).toFixed(1)}%`, background: `var(${slotMacro(t.macro)})` }} /></span>
      <span className="v">{pct(t.share_na_tarefa)}</span>
      <span className="p">{pct(t.peso_da_tarefa)}</span>
    </div>
  );
}

function FragGrupo({ rot, itens, atual }: { rot: string; itens: Modelo[]; atual: string }) {
  return (
    <>
      <tr className="grp"><td colSpan={7}>{rot}</td></tr>
      {itens.map(x => (
        <tr key={x.slug} className={x.slug === atual ? 'eu' : undefined} aria-current={x.slug === atual ? 'page' : undefined}>
          <td className="nm">{x.slug === atual ? x.nome : <a href={urlModelo(x.slug)}>{x.nome}</a>}{x.slug === atual && <span className="pill">esta página</span>}<small className="lab">{x.lab}</small></td>
          <td className="col-lab">{x.lab}</td>
          <td className="num">{x.share_7d && x.share_7d > 0 ? pct(x.share_7d) : '—'}</td>
          <td className="num">{x.preco_misto == null ? '—' : fmtPreco(x.preco_misto)}</td>
          <td className="num">{fmtCtx(x.contexto)}</td>
          <td className="num">{fmtIdx(valorAA(x, 'aa_inteligencia'))}</td>
          <td className="num">{x.semanas_top10}</td>
        </tr>
      ))}
    </>
  );
}
