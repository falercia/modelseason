'use client';
/**
 * Seção 01, "Para que o mercado usa". A fonte de finalidade só publica a janela
 * móvel dos últimos dias e não guarda passado: o site arquiva uma foto por dia,
 * e esta seção mostra a foto mais recente. Não responde à janela nem aos
 * filtros do Histórico, de propósito, e diz isso no subtítulo.
 */
import { useMemo, useRef, useState } from 'react';
import type { Mercado } from '@/lib/tipos';
import { Cartao, Modos, Secao } from '@/components/shell/Cartao';
import { cor, useLargura } from '@/components/graficos/base';
import { slotMacro } from '@/components/modelo/comum';
import { useIdioma } from '@/components/shell/Idioma';

type Medida = 'token' | 'usage';
type Classe = NonNullable<Mercado['tarefas']>['classificacoes'][number];
const N_TAREFAS = 12;

const CSS = `
.s01-pilha{display:flex; gap:2px; height:30px; border-radius:5px; overflow:hidden; margin:4px 0 8px}
.s01-pilha>span{position:relative; min-width:0; display:flex; align-items:center; padding:0 8px; color:#fff; font-size:11.5px; font-weight:600;
  white-space:nowrap; overflow:hidden; cursor:pointer; border:0}
.s01-pilha>span[data-apagado="1"]{opacity:.28}
.s01-leg{display:flex; flex-wrap:wrap; gap:4px 14px; margin-bottom:12px; font-size:12px}
.s01-leg button{border:0; background:transparent; padding:2px 0; display:inline-flex; gap:6px; align-items:baseline; color:var(--ink-2); cursor:pointer; text-align:left}
.s01-leg button i{width:10px; height:10px; border-radius:2px; align-self:center; flex:0 0 10px}
.s01-leg button b{color:var(--ink); font-weight:600; font-variant-numeric:tabular-nums}
.s01-leg button small{color:var(--ink-3); font-family:var(--font-mono),monospace; font-size:10.5px}
.s01-leg button[aria-pressed="true"]{color:var(--ink); text-decoration:underline; text-underline-offset:3px}
.s01-cab,.s01-linha{display:grid; grid-template-columns:minmax(0,190px) minmax(0,1fr) 52px 46px; gap:0 10px; align-items:center}
.s01-cab{font-size:10px; letter-spacing:.07em; text-transform:uppercase; color:var(--ink-3); padding:0 6px 5px; border-bottom:1px solid var(--grid)}
.s01-cab span:nth-child(n+3){text-align:right}
.s01-linha{width:100%; border:0; background:transparent; padding:5px 6px; border-radius:6px; cursor:pointer; text-align:left; font-size:12.5px; color:var(--ink)}
.s01-linha:hover{background:var(--surface-2)}
.s01-linha[aria-pressed="true"]{background:var(--surface-2); box-shadow:inset 2px 0 0 var(--ink)}
.s01-linha .nm{display:flex; gap:7px; align-items:center; min-width:0}
.s01-linha .nm span{overflow:hidden; text-overflow:ellipsis; white-space:nowrap}
.s01-linha .nm i{width:8px; height:8px; border-radius:2px; flex:0 0 8px}
.s01-linha .br{display:block; height:8px; background:var(--grid); border-radius:2px; overflow:hidden}
.s01-linha .br i{display:block; height:100%; border-radius:2px}
.s01-linha .v{text-align:right; font-family:var(--font-mono),monospace; font-size:12px; color:var(--ink-2)}
.s01-linha .r{text-align:right; font-family:var(--font-mono),monospace; font-size:11px; color:var(--ink-3)}
.s01-sel{font:inherit; font-size:13px; padding:5px 9px; border-radius:8px; border:1px solid var(--axis); background:var(--ground); color:var(--ink); max-width:100%; min-width:0}
.s01-resumo{display:flex; flex-wrap:wrap; gap:4px 12px; align-items:baseline; margin:10px 0 12px; font-size:12px; color:var(--ink-3)}
.s01-resumo b{color:var(--ink); font-weight:600}
.s01-mod{display:grid; grid-template-columns:18px minmax(0,1fr) minmax(0,1fr) 48px; gap:7px 10px; align-items:center; font-size:12.5px}
.s01-mod .p{font-family:var(--font-mono),monospace; font-size:11px; color:var(--ink-3); text-align:right}
.s01-mod .quem{min-width:0}
.s01-mod .quem a{display:block; color:var(--ink); text-decoration:none; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap}
.s01-mod .quem a:hover{text-decoration:underline}
.s01-mod .quem small{display:block; font-size:10.5px; color:var(--ink-3)}
.s01-mod .br{display:block; height:8px; background:var(--grid); border-radius:2px; overflow:hidden}
.s01-mod .br i{display:block; height:100%; border-radius:2px}
.s01-mod .v{text-align:right; font-family:var(--font-mono),monospace; font-size:12px; color:var(--ink-2)}
.s01-arq{display:flex; gap:8px; align-items:baseline; flex-wrap:wrap; margin-top:12px; font-size:12px; color:var(--ink-2)}
@media (max-width:560px){
  .s01-cab,.s01-linha{grid-template-columns:minmax(0,1fr) 48px 40px; gap:0 8px}
  .s01-cab span:nth-child(2){display:none}
  .s01-linha .br{grid-column:1/-1; grid-row:2; margin-top:5px}
  .s01-linha .nm{grid-column:1; grid-row:1} .s01-linha .v{grid-column:2; grid-row:1} .s01-linha .r{grid-column:3; grid-row:1}
  .s01-mod{grid-template-columns:16px minmax(0,1.4fr) minmax(0,1fr) 44px}
}
`;

export default function S01({ M }: { M: Mercado }) {
  const { t, f, pt, modelo, nomeLab, tarefa, macro: nomeMacro } = useIdioma();
  const T = M.tarefas;
  const [medida, setMedida] = useState<Medida>('token');
  const [macro, setMacro] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [dica, setDica] = useState<string | null>(null);
  const cartao2 = useRef<HTMLDivElement>(null);
  const [refPilha, wPilha] = useLargura<HTMLDivElement>();

  const classes = useMemo(() => T?.classificacoes ?? [], [T]);
  const val = (c: { token_share: number; usage_share: number }) => (medida === 'token' ? c.token_share : c.usage_share);
  const linhas = useMemo(
    () => classes.filter(c => !macro || c.macro === macro).sort((a, b) => val(b) - val(a)).slice(0, N_TAREFAS),
    [classes, macro, medida], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const titulo = t({ pt: 'Para que o mercado usa', en: 'What the market uses it for' });

  if (!T || !classes.length) {
    return (
      <Secao id="s01" n="01" titulo={titulo}>
        <p className="vazio">{t({
          pt: 'A foto de finalidade ainda não foi arquivada. A seção aparece no primeiro dia em que o pipeline conseguir ler a fonte.',
          en: 'The use-case snapshot has not been archived yet. This section appears on the first day the pipeline manages to read the source.',
        })}</p>
      </Secao>
    );
  }

  const { pct, fmtVezes, fD } = f;
  const macros = T.macro;
  const somaMacro = macros.reduce((s, m) => s + val(m), 0) || 1;
  const maxLinha = Math.max(...linhas.map(val), 0) || 1;
  const razao = (c: { token_share: number; usage_share: number }) => (c.usage_share > 0 ? c.token_share / c.usage_share : null);
  // Nome de tarefa no meio da frase. Em inglês só desce a primeira palavra comum:
  // "Workflow execution" vira "workflow execution", mas "SQL and databases" e "DevOps configuration" ficam.
  const minuscula = (s: string) => (pt ? s.toLowerCase() : s.replace(/^[A-Z][a-z]*(?=\s|$)/, w => w.toLowerCase()));

  // tarefa escolhida: clique na lista, ou o seletor; por padrão a de mais tokens
  const porTokens = [...classes].sort((a, b) => b.token_share - a.token_share);
  const atual: Classe = classes.find(c => c.tag === sel) ?? porTokens[0];
  const escolher = (tag: string) => {
    setSel(tag);
    const el = cartao2.current;
    if (el && typeof window !== 'undefined' && window.innerWidth < 760) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // leitura montada do dado
  const lidTok = [...macros].sort((a, b) => b.token_share - a.token_share)[0];
  const lidReq = [...macros].sort((a, b) => b.usage_share - a.usage_share)[0];
  const topo = porTokens.slice(0, N_TAREFAS).filter(c => razao(c) != null);
  const pesada = [...topo].sort((a, b) => razao(b)! - razao(a)!)[0];
  const leve = [...topo].sort((a, b) => razao(a)! - razao(b)!)[0];

  const modelosAtual = [...atual.modelos].sort((a, b) => b.token_share - a.token_share);
  const maxMod = Math.max(...modelosAtual.map(m => m.token_share), 0) || 1;
  const somaMod = modelosAtual.reduce((s, m) => s + m.token_share, 0);
  const slotAtual = slotMacro(atual.macro);
  const grupos = macros.map(m => ({ ...m, itens: porTokens.filter(c => c.macro === m.key) })).filter(g => g.itens.length);
  const n = T.fotos_arquivadas;
  const porTok = medida === 'token';
  const nomeAtual = tarefa(atual);
  const lider0 = modelosAtual[0];

  return (
    <Secao id="s01" n="01" titulo={titulo}
      sub={t({
        pt: <>Foto da janela móvel de {T.janela_dias} dias publicada pela fonte, terminando em <b>{fD(T.as_of)}</b>. É a mesma para qualquer recorte: esta seção <b>não responde à janela nem aos filtros do Histórico</b>. A fonte não guarda passado, então a série desta seção só existe porque o site arquiva uma foto por dia.</>,
        en: <>Snapshot of the source&apos;s rolling {T.janela_dias}-day window, ending <b>{fD(T.as_of)}</b>. It is the same for any filtered view: this section <b>does not respond to the History window or filters</b>. The source keeps no history, so this section&apos;s series exists only because the site archives one snapshot a day.</>,
      })}>
      <style href="s01-css" precedence="medium">{CSS}</style>
      <div className="grid2">
        <Cartao id="tarefas" novo
          subtitulo={t({
            pt: `Share ${porTok ? 'dos tokens classificados' : 'das requisições classificadas'}, por finalidade, nos ${T.janela_dias} dias até ${fD(T.as_of)}`,
            en: `Share of classified ${porTok ? 'tokens' : 'requests'} by use case, over the ${T.janela_dias} days through ${fD(T.as_of)}`,
          })}
          acoes={<Modos valor={medida} onChange={setMedida} rotulo={t({ pt: 'Medir por', en: 'Measure by' })}
            opcoes={[['token', 'Tokens'], ['usage', t({ pt: 'Requisições', en: 'Requests' })]]} />}>
          <div className="plot" onPointerLeave={() => setDica(null)}>
            <div className="s01-pilha" ref={refPilha} role="img"
              aria-label={t({
                pt: `Repartição ${porTok ? 'dos tokens' : 'das requisições'} por macro categoria: `,
                en: `Breakdown of ${porTok ? 'tokens' : 'requests'} by macro category: `,
              }) + macros.map(m => `${nomeMacro(m.key)} ${pct(val(m))}`).join(', ')}>
              {macros.map(m => {
                // rótulo só dentro do segmento quando cabe inteiro (estimativa de 6,9 px por caractere, mais o recuo)
                const px = ((wPilha - 2 * (macros.length - 1)) * val(m)) / somaMacro;
                const cabe = (s: string) => s.length * 6.9 + 16 <= px;
                const longo = `${nomeMacro(m.key)} ${pct(val(m))}`, curto = pct(val(m));
                return (
                  <span key={m.key} data-apagado={macro && macro !== m.key ? '1' : undefined}
                    style={{ flex: `${val(m)} 1 0`, background: cor(slotMacro(m.key)) }}
                    onPointerEnter={() => setDica(m.key)} onClick={() => setMacro(x => (x === m.key ? null : m.key))}>
                    {cabe(longo) ? longo : cabe(curto) ? curto : ''}
                  </span>
                );
              })}
            </div>
            {dica && (() => {
              const m = macros.find(x => x.key === dica)!;
              return (
                <div className="tip" style={{ left: 0, top: 38 }}>
                  <div className="t">{nomeMacro(m.key)}</div>
                  <div className="r"><span>tokens</span><b>{pct(m.token_share)}</b></div>
                  <div className="r"><span>{t({ pt: 'requisições', en: 'requests' })}</span><b>{pct(m.usage_share)}</b></div>
                  <div className="r"><span>{t({ pt: 'tokens ÷ requisições', en: 'tokens ÷ requests' })}</span><b>{fmtVezes(razao(m))}</b></div>
                </div>
              );
            })()}
          </div>
          <div className="s01-leg" role="group" aria-label={t({ pt: 'Macro categorias: clique para ver só as tarefas de uma', en: 'Macro categories: click one to see only its tasks' })}>
            {macros.map(m => (
              <button key={m.key} type="button" aria-pressed={macro === m.key} onClick={() => setMacro(x => (x === m.key ? null : m.key))}
                title={macro === m.key
                  ? t({ pt: 'Mostrar todas as tarefas', en: 'Show all tasks' })
                  : t({ pt: `Mostrar só as tarefas de ${nomeMacro(m.key)}`, en: `Show only ${nomeMacro(m.key)} tasks` })}>
                <i style={{ background: cor(slotMacro(m.key)) }} />{nomeMacro(m.key)} <b>{pct(val(m))}</b>
                <small>{porTok ? `${pct(m.usage_share)} req.` : `${pct(m.token_share)} tok.`}</small>
              </button>
            ))}
          </div>
          <div className="s01-cab" aria-hidden="true">
            <span>{macro
              ? t({ pt: `Tarefas de ${nomeMacro(macro)}`, en: `${nomeMacro(macro)} tasks` })
              : t({ pt: `As ${linhas.length} maiores tarefas`, en: `The ${linhas.length} largest tasks` })}</span><span />
            <span>{porTok ? '% tok.' : '% req.'}</span><span title={t({ pt: 'tokens ÷ requisições', en: 'tokens ÷ requests' })}>tok÷req</span>
          </div>
          <div role="group" aria-label={t({ pt: 'Tarefas: clique para ver os modelos líderes', en: 'Tasks: click one to see its leading models' })}>
            {linhas.map(c => (
              <button key={c.tag} type="button" className="s01-linha" aria-pressed={atual.tag === c.tag} onClick={() => escolher(c.tag)}
                title={t({
                  pt: `${tarefa(c)}: ${pct(c.token_share)} dos tokens, ${pct(c.usage_share)} das requisições. Clique para ver os modelos líderes.`,
                  en: `${tarefa(c)}: ${pct(c.token_share)} of tokens, ${pct(c.usage_share)} of requests. Click to see the leading models.`,
                })}>
                <span className="nm"><i style={{ background: cor(slotMacro(c.macro)) }} /><span>{tarefa(c)}</span></span>
                <span className="br"><i style={{ width: `${((100 * val(c)) / maxLinha).toFixed(1)}%`, background: cor(slotMacro(c.macro)) }} /></span>
                <span className="v">{pct(val(c))}</span>
                <span className="r">{fmtVezes(razao(c))}</span>
              </button>
            ))}
          </div>
          <p className="leitura">
            {t({
              pt: <>Por tokens, <b>{nomeMacro(lidTok.key)}</b> lidera com {pct(lidTok.token_share)}; por requisições, {lidReq.key === lidTok.key ? 'também' : <b>{nomeMacro(lidReq.key)}</b>}, com {pct(lidReq.usage_share)}.</>,
              en: <>By tokens, <b>{nomeMacro(lidTok.key)}</b> leads with {pct(lidTok.token_share)}; {lidReq.key === lidTok.key ? 'it also leads by requests' : <>by requests, <b>{nomeMacro(lidReq.key)}</b> leads</>}, with {pct(lidReq.usage_share)}.</>,
            })}
            {pesada && leve && pesada.tag !== leve.tag && t({
              pt: <> Entre as {topo.length} maiores tarefas, a carga mais pesada é <b>{tarefa(pesada)}</b>: {pct(pesada.token_share)} dos tokens com {pct(pesada.usage_share)} das requisições ({fmtVezes(razao(pesada))}). A mais leve é <b>{tarefa(leve)}</b>, com {pct(leve.usage_share)} das requisições e {pct(leve.token_share)} dos tokens.</>,
              en: <> Among the {topo.length} largest tasks, the heaviest workload is <b>{tarefa(pesada)}</b>: {pct(pesada.token_share)} of tokens from {pct(pesada.usage_share)} of requests ({fmtVezes(razao(pesada))}). The lightest is <b>{tarefa(leve)}</b>, with {pct(leve.usage_share)} of requests and {pct(leve.token_share)} of tokens.</>,
            })}
          </p>
          <details className="tab">
            <summary>{t({ pt: `Ver as ${classes.length} tarefas`, en: `See all ${classes.length} tasks` })}</summary>
            <div className="tabwrap" style={{ maxHeight: 300, overflowY: 'auto' }}>
              <table className="t">
                <thead><tr>
                  <th>{t({ pt: 'Tarefa', en: 'Task' })}</th><th>Macro</th><th className="num">% tokens</th><th className="num">% req.</th><th className="num">tok÷req</th>
                  <th>{t({ pt: 'Líder', en: 'Leader' })}</th>
                </tr></thead>
                <tbody>{porTokens.map(c => {
                  const l = [...c.modelos].sort((a, b) => b.token_share - a.token_share)[0];
                  return (
                    <tr key={c.tag}>
                      <td>{tarefa(c)}</td><td>{nomeMacro(c.macro)}</td>
                      <td className="num">{pct(c.token_share)}</td><td className="num">{pct(c.usage_share)}</td><td className="num">{fmtVezes(razao(c))}</td>
                      <td>{l ? <a href={modelo(l.slug)}>{l.nome}</a> : '—'}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          </details>
        </Cartao>

        <div ref={cartao2} style={{ scrollMarginTop: 'calc(var(--top-h) + 12px)', minWidth: 0 }}>
          <Cartao id="tarefas-modelos" novo subtitulo={t({ pt: 'Clique numa tarefa no cartão ao lado, ou escolha aqui', en: 'Click a task in the adjacent card, or pick one here' })}>
            <label className="sr" htmlFor="s01-tarefa">{t({ pt: 'Tarefa', en: 'Task' })}</label>
            <select id="s01-tarefa" className="s01-sel" value={atual.tag} onChange={e => setSel(e.target.value)}>
              {grupos.map(g => (
                <optgroup key={g.key} label={nomeMacro(g.key)}>
                  {g.itens.map(c => <option key={c.tag} value={c.tag}>{tarefa(c)} ({pct(c.token_share)})</option>)}
                </optgroup>
              ))}
            </select>
            <div className="s01-resumo">
              <span><i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: cor(slotAtual), marginRight: 6 }} />{nomeMacro(atual.macro)}</span>
              <span>{t({ pt: <><b>{pct(atual.token_share)}</b> dos tokens</>, en: <><b>{pct(atual.token_share)}</b> of tokens</> })}</span>
              <span>{t({ pt: <><b>{pct(atual.usage_share)}</b> das requisições</>, en: <><b>{pct(atual.usage_share)}</b> of requests</> })}</span>
              {atual.nome_fonte !== nomeAtual && <span className="mono" style={{ fontSize: 10.5 }}>{t({ pt: 'fonte', en: 'source' })}: {atual.nome_fonte}</span>}
            </div>
            {modelosAtual.length ? (
              <div className="plot" role="img" aria-label={t({ pt: `Modelos líderes em ${nomeAtual}: `, en: `Leading models in ${nomeAtual}: ` }) + modelosAtual.map(m => `${m.nome} ${pct(m.token_share)}`).join(', ')}>
                <div className="s01-mod">
                  {modelosAtual.map((m, i) => (
                    <FragmentoModelo key={m.slug} i={i} m={m} max={maxMod} slot={slotAtual} />
                  ))}
                </div>
              </div>
            ) : <p className="vazio">{t({
              pt: `A fonte não listou modelos para esta tarefa na foto de ${fD(T.as_of)}.`,
              en: `The source listed no models for this task in the ${fD(T.as_of)} snapshot.`,
            })}</p>}
            {lider0 && (
              <p className="leitura">{t({
                pt: <><b>{lider0.nome}</b> ({nomeLab(lider0.lab)}) leva {pct(lider0.token_share)} dos tokens de {minuscula(nomeAtual)}.
                  {' '}Os {modelosAtual.length} listados somam {pct(somaMod)}; o resto se divide entre modelos que a fonte não lista.</>,
                en: <><b>{lider0.nome}</b> ({nomeLab(lider0.lab)}) takes {pct(lider0.token_share)} of the tokens in {minuscula(nomeAtual)}.
                  {' '}{modelosAtual.length === 1 ? 'The one model listed accounts for' : `The ${modelosAtual.length} models listed add up to`} {pct(somaMod)}; the rest is split among models the source does not list.</>,
              })}</p>
            )}
            <p className="nota">{t({
              pt: 'Share dentro da tarefa: tokens do modelo nesta tarefa divididos pelos tokens classificados nela. A fonte lista só os maiores de cada tarefa.',
              en: "Share within the task: the model's tokens in this task divided by all tokens classified in it. The source lists only the largest models in each task.",
            })}</p>
          </Cartao>
        </div>
      </div>

      <p className="s01-arq">
        <span className="pill" style={{ marginLeft: 0 }}>{t({ pt: 'arquivo', en: 'archive' })}</span>
        <span>{t({
          pt: <><b>{n} {n === 1 ? 'foto arquivada' : 'fotos arquivadas'}</b> até agora. {n === 1
            ? 'Esta é a primeira; a série histórica de finalidade aparece aqui à medida que o arquivo cresce.'
            : 'A série histórica de finalidade aparece aqui à medida que o arquivo cresce.'}</>,
          en: <><b>{n} {n === 1 ? 'snapshot' : 'snapshots'} archived</b> so far. {n === 1
            ? 'This is the first; the use-case time series builds up here as the archive grows.'
            : 'The use-case time series builds up here as the archive grows.'}</>,
        })}</span>
      </p>
      <p className="nota">{t({
        pt: <>Amostra classificada pela fonte: só entra o tráfego que ela consegue atribuir a uma finalidade, e o balde <span className="mono">other</span> fica fora do denominador. Janelas móveis de {T.janela_dias} dias se sobrepõem, então duas fotos seguidas compartilham quase todo o volume.</>,
        en: <>A sample classified by the source: only traffic it can attribute to a use case counts, and the <span className="mono">other</span> bucket stays out of the denominator. Rolling {T.janela_dias}-day windows overlap, so two consecutive snapshots share almost all of their volume.</>,
      })}</p>
    </Secao>
  );
}

function FragmentoModelo({ i, m, max, slot }: { i: number; m: Classe['modelos'][number]; max: number; slot: string }) {
  const { f, modelo, nomeLab } = useIdioma();
  return (
    <>
      <span className="p">{i + 1}</span>
      <span className="quem"><a href={modelo(m.slug)}>{m.nome}</a><small>{nomeLab(m.lab)}</small></span>
      <span className="br"><i style={{ width: `${((100 * m.token_share) / max).toFixed(1)}%`, background: cor(slot) }} /></span>
      <span className="v">{f.pct(m.token_share)}</span>
    </>
  );
}
