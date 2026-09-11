/**
 * Página de modelo, renderizada no servidor. Tudo sai de modelos.json, agora.json
 * e mercado.json; o que depende de interação (o gráfico) é o único componente
 * de cliente. A comparação vai pronta no HTML, sem carregar nada no clique.
 *
 * Componente de servidor: o idioma chega por lang e o kit sai de idioma(lang).
 * Os filhos cliente (Cartao, GraficoShare) leem o idioma do contexto.
 */
import type { Lang } from '@/lib/i18n';
import type { Agora, Mercado, Modelo, Modelos } from '@/lib/tipos';
import { idioma, type Idioma } from '@/lib/idioma';
import { Cartao } from '@/components/shell/Cartao';
import { GraficoShare } from './GraficoShare';
import { slotMacro } from './comum';

const MEDIDAS_AA = [
  { k: 'aa_inteligencia', rot: { pt: 'Inteligência', en: 'Intelligence' } },
  { k: 'aa_codigo', rot: { pt: 'Código', en: 'Coding' } },
  { k: 'aa_agentes', rot: { pt: 'Agentes', en: 'Agents' } },
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
const fmtIdx = (v: number | null, I: Idioma) => (v == null ? '—' : I.f.dec(v.toFixed(1)));
const fmtTokens = (v: number, I: Idioma) => (v >= 0.01 ? I.f.fmtT(v) : v > 0 ? '<' + I.f.dec('0.01') + 'T' : '0T');
/** Preço de tabela: duas casas no mínimo, três abaixo de 1 dólar quando a terceira existe. */
const fmtPreco = (v: number | null | undefined, I: Idioma) => {
  if (v == null || !isFinite(v)) return '—';
  if (v === 0) return I.t({ pt: 'grátis', en: 'free' });
  if (v >= 1) return I.f.fmtUSD(v);
  const s = v.toFixed(3);
  return I.t({ pt: 'US$ ', en: '$' }) + I.f.dec(s.endsWith('0') ? s.slice(0, -1) : s);
};
/** Nome de tarefa no meio da frase. Em inglês, sigla e caixa interna ficam ("SQL and databases", "DevOps configuration"). */
const noMeio = (s: string, I: Idioma) => {
  if (I.pt) return s.toLowerCase();
  return /[A-Z]/.test(s.split(' ')[0].slice(1)) ? s : s.charAt(0).toLowerCase() + s.slice(1);
};

export function PaginaModelo({ m, MS, A, Mc, vendorFiltravel, lang }: { m: Modelo; MS: Modelos; A: Agora; Mc: Mercado; vendorFiltravel: boolean; lang: Lang }) {
  const I = idioma(lang);
  const { t, f } = I;
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
  const maxTar = Math.max(...m.tarefas.map(x => x.share_na_tarefa), 0) || 1;
  const nTarefas = T?.classificacoes.length ?? 0;
  const maiorPeso = [...m.tarefas].sort((a, b) => b.peso_da_tarefa - a.peso_da_tarefa)[0];
  const tar0 = m.tarefas[0];
  const nMais = m.tarefas.length - 12;

  // provedores
  const P = m.provedores;
  const nProv = new Set(P.map(p => p.provedor)).size;
  const entradas = P.map(p => p.entrada).filter((v): v is number => v != null);
  const nZdr = P.filter(p => p.zdr).length;
  const eMin = Math.min(...entradas), eMax = Math.max(...entradas);
  const faixaEntrada = entradas.length > 1 && eMin !== eMax;

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
  // (pesos é a chave do dado; rot é o que aparece)
  const porShare = [...todos].filter(x => (x.share_7d ?? 0) > 0).sort((a, b) => (b.share_7d ?? 0) - (a.share_7d ?? 0));
  const grupos = [
    { rot: t({ pt: 'Proprietários', en: 'Proprietary' }), pesos: 'Proprietário', itens: porShare.filter(x => x.pesos === 'Proprietário').slice(0, 5) },
    { rot: t({ pt: 'Pesos abertos', en: 'Open weights' }), pesos: 'Open-weights', itens: porShare.filter(x => x.pesos === 'Open-weights').slice(0, 5) },
  ];
  const incluido = grupos.some(g => g.itens.some(x => x.slug === m.slug));
  if (!incluido) {
    const g = grupos.find(g => g.pesos === m.pesos);
    if (g) g.itens = [...g.itens, m].sort((a, b) => (b.share_7d ?? 0) - (a.share_7d ?? 0));
    else grupos.push({ rot: t({ pt: 'Licença não identificada', en: 'Unknown license' }), pesos: m.pesos, itens: [m] });
  }

  const lab = I.nomeLab(m.lab);
  const crumbLab = vendorFiltravel
    ? <a href={I.url(`/?vendor=${encodeURIComponent(m.vendor)}#historico`)} title={t({ pt: `Histórico filtrado por ${lab}`, en: `History filtered by ${lab}` })}>{lab}</a>
    : <span>{lab}</span>;
  const semCatalogo = m.model_id === undefined;
  const naoInformado = t({ pt: 'não informado', en: 'not reported' });
  const semSemana = t({ pt: 'sem semana completa com volume', en: 'no full week with volume' });

  return (
    <>
      <style href="mp-css" precedence="medium">{CSS}</style>
      <div className="mp-top">
        <div>
          <nav className="crumb" aria-label={t({ pt: 'Você está em', en: 'You are here' })}><a href={I.url('/')}>Model Season</a> / {crumbLab} /</nav>
          <h1>{m.nome}</h1>
          <div className="mp-slug">{m.slug}</div>
          <div className="mp-tags">
            <span className="pill">{lab}</span>
            <span className="pill">{I.valor(m.origem)}</span>
            <span className="pill">{I.pesos(m.pesos)}</span>
            {m.ativo_no_catalogo === false && <span className="pill">{t({ pt: 'fora do catálogo atual', en: 'not in the current catalog' })}</span>}
            {semCatalogo && <span className="pill">{t({ pt: 'sem ficha no catálogo', en: 'no catalog entry' })}</span>}
          </div>
          <p className="mp-lead">
            {m.rank_7d && m.share_7d ? t({
              pt: <><b>{f.ord(m.rank_7d)}</b> modelo mais usado no roteador nos últimos 7 dias, com <b>{f.pct(m.share_7d)}</b> dos tokens.</>,
              en: <>The {m.rank_7d === 1 ? <b>most-used</b> : <><b>{f.ord(m.rank_7d)}</b> most-used</>} model on the router over the last 7 days, with <b>{f.pct(m.share_7d)}</b> of tokens.</>,
            }) : t({ pt: <>Sem volume nos últimos 7 dias.</>, en: <>No volume over the last 7 days.</> })}
            {' '}{pico ? t({
              pt: <>Pico semanal de {f.pct(pico.v)} na semana de {f.fD(pico.semana)}{m.primeira_semana ? <>, e {fmtTokens(m.tokens_total_T, I)} processados desde {f.fD(m.primeira_semana)}</> : null}.</>,
              en: <>Weekly share peaked at {f.pct(pico.v)} in the week of {f.fD(pico.semana)}{m.primeira_semana ? <>, with {fmtTokens(m.tokens_total_T, I)} tokens processed since {f.fD(m.primeira_semana)}</> : null}.</>,
            }) : null}
          </p>
        </div>
        <div className="mp-ficha">
          <dl className="ficha">
            <dt>{t({ pt: 'Lançamento', en: 'Launch' })}</dt><dd>{m.lancamento ? f.fD(m.lancamento) : naoInformado}</dd>
            <dt>{t({ pt: 'Contexto', en: 'Context' })}</dt><dd>{m.contexto ? `${f.fmtCtx(m.contexto)} tokens` : naoInformado}</dd>
            <dt>{t({ pt: 'Modalidade', en: 'Modality' })}</dt><dd>{f.fmtModalidade(m.modalidade) ?? t({ pt: 'não informada', en: 'not reported' })}</dd>
            <dt>{t({ pt: 'Raciocínio', en: 'Reasoning' })}</dt><dd>{m.raciocinio == null ? naoInformado : m.raciocinio ? t({ pt: 'sim', en: 'yes' }) : t({ pt: 'não', en: 'no' })}</dd>
            <dt>{t({ pt: 'Licença', en: 'License' })}</dt><dd>{I.pesos(m.pesos)}</dd>
            <dt>{t({ pt: 'Entrada', en: 'Input' })}</dt><dd>{m.preco_entrada == null ? naoInformado : `${fmtPreco(m.preco_entrada, I)} / 1M`}</dd>
            <dt>{t({ pt: 'Saída', en: 'Output' })}</dt><dd>{m.preco_saida == null ? naoInformado : `${fmtPreco(m.preco_saida, I)} / 1M`}</dd>
          </dl>
        </div>
      </div>

      <div className="tiles4 mp-tiles">
        <div className="m">
          <div className="k">{t({ pt: 'Share nos últimos 7 dias', en: 'Share, last 7 days' })}</div>
          <div className="v">{m.share_7d && m.share_7d > 0 ? f.pct(m.share_7d) : '—'}</div>
          <div className="d">{m.rank_7d
            ? t({ pt: `${f.ord(m.rank_7d)} de ${ativos7} · ${f.fD(j7[0])} a ${f.fD(j7[1])}`, en: `${f.ord(m.rank_7d)} of ${ativos7} · ${f.fD(j7[0])} to ${f.fD(j7[1])}` })
            : t({ pt: 'sem volume nos últimos 7 dias', en: 'no volume over the last 7 days' })}</div>
        </div>
        <div className="m">
          <div className="k">{t({ pt: 'Pico de share semanal', en: 'Peak weekly share' })}</div>
          <div className="v">{pico ? f.pct(pico.v) : '—'}</div>
          <div className="d">{pico ? t({ pt: `semana de ${f.fD(pico.semana)}`, en: `week of ${f.fD(pico.semana)}` }) : semSemana}</div>
        </div>
        <div className="m">
          <div className="k">{t({ pt: 'Tokens acumulados', en: 'Cumulative tokens' })}</div>
          <div className="v">{m.primeira_semana ? fmtTokens(m.tokens_total_T, I) : '—'}</div>
          <div className="d">{m.primeira_semana
            ? t({ pt: `desde a semana de ${f.fD(m.primeira_semana)}`, en: `since the week of ${f.fD(m.primeira_semana)}` })
            : semSemana}</div>
        </div>
        <div className="m">
          <div className="k">{t({ pt: 'Semanas no top 10', en: 'Weeks in the top 10' })}</div>
          <div className="v">{m.semanas_top10}</div>
          <div className="d">{t({
            pt: `de ${m.semanas_com_volume} ${m.semanas_com_volume === 1 ? 'semana' : 'semanas'} com volume`,
            en: `of ${m.semanas_com_volume} ${m.semanas_com_volume === 1 ? 'week' : 'weeks'} with volume`,
          })}</div>
        </div>
      </div>

      <div className="mp-grid">
        <Cartao id="modelo-share">
          {semanas.length >= 2 ? (
            <GraficoShare semanas={semanas} valores={valores} pico={pico} nome={m.nome} />
          ) : semanas.length === 1 ? (
            <p className="vazio">{t({
              pt: <>Só uma semana completa até agora: {f.pct(valores[0])} do volume na semana de {f.fD(semanas[0])}. O gráfico aparece a partir da segunda semana.</>,
              en: <>Only one full week so far: {f.pct(valores[0])} of volume in the week of {f.fD(semanas[0])}. The chart appears from the second week on.</>,
            })}</p>
          ) : (
            <p className="vazio">{t({
              pt: 'Nenhuma semana completa com volume ainda. O share dos últimos 7 dias, acima, vem da janela diária.',
              en: 'No full week with volume yet. The last-7-days share above comes from the daily window.',
            })}</p>
          )}
          {semanas.length >= 2 && pico && ultimo != null && (
            <p className="leitura">
              {t({
                pt: <>Estreou na semana de <b>{f.fD(semanas[0])}</b> e chegou ao pico de <b>{f.pct(pico.v)}</b>{' '}{semanasAtePico === 0 ? 'logo na primeira semana' : <>{semanasAtePico} {semanasAtePico === 1 ? 'semana' : 'semanas'} depois</>}.</>,
                en: <>Debuted in the week of <b>{f.fD(semanas[0])}</b> and peaked at <b>{f.pct(pico.v)}</b>{' '}{semanasAtePico === 0 ? 'in its first week' : <>{semanasAtePico} {semanasAtePico === 1 ? 'week' : 'weeks'} later</>}.</>,
              })}
              {' '}{pico.semana === semanas.at(-1)
                ? t({ pt: 'A última semana completa é o pico até aqui.', en: 'The latest full week is the peak so far.' })
                : ultimo > 0 ? t({
                  pt: <>Na última semana completa ficou em {f.pct(ultimo)}, {Math.round((100 * ultimo) / pico.v)}% do pico.</>,
                  en: <>The latest full week came in at {f.pct(ultimo)}, {Math.round((100 * ultimo) / pico.v)}% of peak.</>,
                })
                : t({ pt: 'Na última semana completa não teve volume registrado.', en: 'No volume was recorded in the latest full week.' })}
              {m.share_7d != null && m.share_7d > pico.v && t({
                pt: <> Nos últimos 7 dias, que já entram na semana em curso, está em {f.pct(m.share_7d)}, acima do pico semanal.</>,
                en: <> Over the last 7 days, which already reach into the current week, it stands at {f.pct(m.share_7d)}, above the weekly peak.</>,
              })}
            </p>
          )}
        </Cartao>

        <Cartao id="modelo-tarefas" novo>
          {!T ? (
            <p className="vazio">{t({ pt: 'A foto de finalidade ainda não foi arquivada.', en: 'The use-case snapshot has not been archived yet.' })}</p>
          ) : m.tarefas.length ? (
            <>
              <div className="mp-tar" role="img" aria-label={t({ pt: `Tarefas em que ${m.nome} está entre os líderes: `, en: `Tasks where ${m.nome} ranks among the leaders: ` })
                + m.tarefas.map(x => `${I.tarefa(x)} ${f.pct(x.share_na_tarefa)}`).join(', ')}>
                <div className="ln cab" aria-hidden="true">
                  <span>{t({ pt: 'Tarefa', en: 'Task' })}</span><span /><span>{t({ pt: 'fatia', en: 'share' })}</span><span>{t({ pt: 'peso', en: 'weight' })}</span>
                </div>
                {m.tarefas.slice(0, 12).map(x => (
                  <FragTarefa key={x.tag} x={x} max={maxTar} I={I} />
                ))}
              </div>
              {nMais > 0 && <p className="nota">{t({
                pt: `E mais ${nMais} ${nMais === 1 ? 'tarefa' : 'tarefas'} com fatia menor.`,
                en: `Plus ${nMais} more ${nMais === 1 ? 'task' : 'tasks'} with a smaller share.`,
              })}</p>}
              <p className="leitura">
                {t({
                  pt: <>Está entre os líderes de <b>{m.tarefas.length}</b> das {nTarefas} tarefas classificadas. A maior fatia é em <b>{noMeio(I.tarefa(tar0), I)}</b>, {f.pct(tar0.share_na_tarefa)} dos tokens da tarefa</>,
                  en: <>Ranks among the leaders in <b>{m.tarefas.length}</b> of the {nTarefas} classified tasks. Its largest share is in <b>{noMeio(I.tarefa(tar0), I)}</b>, {f.pct(tar0.share_na_tarefa)} of the task&apos;s tokens</>,
                })}
                {maiorPeso && maiorPeso.tag !== tar0.tag && t({
                  pt: <>; na tarefa de maior peso em que aparece, {noMeio(I.tarefa(maiorPeso), I)} ({f.pct(maiorPeso.peso_da_tarefa)} do volume classificado), fica com {f.pct(maiorPeso.share_na_tarefa)}</>,
                  en: <>; in the heaviest task where it appears, {noMeio(I.tarefa(maiorPeso), I)} ({f.pct(maiorPeso.peso_da_tarefa)} of classified volume), it holds {f.pct(maiorPeso.share_na_tarefa)}</>,
                })}.
              </p>
            </>
          ) : (
            <p className="vazio">{t({
              pt: `Este modelo não aparece entre os líderes de nenhuma das ${nTarefas} tarefas classificadas na foto de ${f.fD(T.as_of)}. Isso não quer dizer que não seja usado para nada: a fonte só lista os maiores de cada tarefa.`,
              en: `This model is not among the leaders in any of the ${nTarefas} tasks classified in the ${f.fD(T.as_of)} snapshot. That does not mean it goes unused: the source lists only the largest models in each task.`,
            })}</p>
          )}
          {T && <p className="nota">{t({
            pt: `Foto da janela móvel de ${T.janela_dias} dias até ${f.fD(T.as_of)}. Fatia: tokens do modelo na tarefa sobre os tokens da tarefa. Peso: a tarefa no volume classificado.`,
            en: `Snapshot of the rolling ${T.janela_dias}-day window through ${f.fD(T.as_of)}. Share: the model's tokens in the task over the task's total tokens. Weight: the task's share of classified volume.`,
          })}</p>}
        </Cartao>
      </div>

      <div className="mp-grid">
        <Cartao id="modelo-provedores">
          {P.length ? (
            <>
              <div className="tabwrap" style={{ maxHeight: 340, overflowY: 'auto' }}>
                <table className="t mp-prov">
                  <thead><tr>
                    <th>{t({ pt: 'Provedor', en: 'Provider' })}</th><th className="num">{t({ pt: 'Entrada', en: 'Input' })}</th>
                    <th className="num">{t({ pt: 'Saída', en: 'Output' })}</th><th className="num">{t({ pt: 'Contexto', en: 'Context' })}</th>
                    <th>{t({ pt: 'Quantização', en: 'Quantization' })}</th><th>{t({ pt: 'Retenção zero', en: 'Zero retention' })}</th>
                  </tr></thead>
                  <tbody>{P.map((p, i) => (
                    <tr key={i}>
                      <td className="nm">{p.provedor}</td>
                      <td className="num">{fmtPreco(p.entrada, I)}</td>
                      <td className="num">{fmtPreco(p.saida, I)}</td>
                      <td className="num">{f.fmtCtx(p.contexto)}</td>
                      <td>{p.quantizacao && p.quantizacao !== 'unknown' ? p.quantizacao : <span style={{ color: 'var(--ink-3)' }}>{t({ pt: 'não informada', en: 'not reported' })}</span>}</td>
                      <td>{p.zdr ? t({ pt: 'sim', en: 'yes' }) : <span style={{ color: 'var(--ink-3)' }}>{t({ pt: 'não', en: 'no' })}</span>}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              <p className="leitura">
                {t({
                  pt: <><b>{P.length}</b> {P.length === 1 ? 'endpoint' : 'endpoints'} em {nProv} {nProv === 1 ? 'provedor' : 'provedores'}{faixaEntrada && <>, com entrada de {fmtPreco(eMin, I)} a {fmtPreco(eMax, I)} por 1M de tokens</>}.</>,
                  en: <><b>{P.length}</b> {P.length === 1 ? 'endpoint' : 'endpoints'} across {nProv} {nProv === 1 ? 'provider' : 'providers'}{faixaEntrada && <>, with input from {fmtPreco(eMin, I)} to {fmtPreco(eMax, I)} per 1M tokens</>}.</>,
                })}
                {' '}{nZdr
                  ? t({ pt: `${nZdr} com retenção zero de dados.`, en: `${nZdr} ${nZdr === 1 ? 'offers' : 'offer'} zero data retention.` })
                  : t({ pt: 'Nenhum declara retenção zero de dados.', en: 'None declares zero data retention.' })}
              </p>
              <p className="nota">{t({
                pt: 'Preços em dólar por milhão de tokens, do catálogo de endpoints mais recente arquivado.',
                en: 'Prices in US dollars per million tokens, from the latest archived endpoint catalog.',
              })}</p>
            </>
          ) : (
            <p className="vazio">{m.ativo_no_catalogo === false || semCatalogo
              ? t({
                pt: 'Nenhum endpoint no catálogo arquivado: o modelo saiu do catálogo da fonte ou nunca teve ficha nele.',
                en: "No endpoints in the archived catalog: the model has left the source's catalog or never had an entry in it.",
              })
              : t({
                pt: 'Nenhum endpoint listado para este modelo no catálogo arquivado.',
                en: 'No endpoints listed for this model in the archived catalog.',
              })}</p>
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
                      <div className="k">{t(rot)}</div>
                      {p ? <>
                        <div className="v">{fmtIdx(p.v, I)}</div>
                        <div className="d">{t({ pt: `${f.ord(p.pos)} de ${p.n}`, en: `${f.ord(p.pos)} of ${p.n}` })}</div>
                      </> : <>
                        <div className="v sem">{t({ pt: 'sem índice', en: 'no index' })}</div>
                        <div className="d">{t({ pt: 'não publicado', en: 'not published' })}</div>
                      </>}
                    </div>
                  );
                })}
              </div>
              {avals.length ? avals.map(a => (
                <div className="mp-ev" key={a.tipo}>
                  <h4>{f.nomeAvaliacao(a.tipo)} <span>{a.score != null ? f.pct(100 * a.score) : '—'}</span></h4>
                  {a.score != null && (
                    <div className="trilho" role="img" aria-label={t({
                      pt: `Acerto ${f.pct(100 * a.score)}; mediana dos ${a.n} avaliados ${f.pct(100 * (a.medScore ?? 0))}`,
                      en: `Accuracy ${f.pct(100 * a.score)}; median across ${a.n} evaluated models: ${f.pct(100 * (a.medScore ?? 0))}`,
                    })}>
                      <i style={{ width: `${(100 * a.score).toFixed(1)}%` }} />
                      {a.medScore != null && <b style={{ left: `calc(${(100 * a.medScore).toFixed(1)}% - 1px)` }} />}
                    </div>
                  )}
                  <p>
                    {a.custo_tarefa != null && t({
                      pt: `${f.fmtCusto(a.custo_tarefa)} por tarefa${a.tarefas ? `, ${a.tarefas} ${a.tarefas === 1 ? 'tarefa' : 'tarefas'}` : ''}. `,
                      en: `${f.fmtCusto(a.custo_tarefa)} per task${a.tarefas ? `, ${a.tarefas} ${a.tarefas === 1 ? 'task' : 'tasks'}` : ''}. `,
                    })}
                    {a.pos != null && t({ pt: `${f.ord(a.pos)} de ${a.n} avaliados. `, en: `${f.ord(a.pos)} of ${a.n} evaluated. ` })}
                    {t({
                      pt: `Mediana dos avaliados: ${a.medScore != null ? f.pct(100 * a.medScore) : '—'}${a.medCusto != null ? `, ${f.fmtCusto(a.medCusto)} por tarefa` : ''}.`,
                      en: `Median of evaluated models: ${a.medScore != null ? f.pct(100 * a.medScore) : '—'}${a.medCusto != null ? `, ${f.fmtCusto(a.medCusto)} per task` : ''}.`,
                    })}
                  </p>
                </div>
              )) : <p className="nota">{t({ pt: 'A fonte não rodou as próprias avaliações neste modelo.', en: 'The source has not run its own benchmarks on this model.' })}</p>}
              <p className="nota">{t({
                pt: `Índices da Artificial Analysis, expostos pelo catálogo; avaliações rodadas pela fonte${Mc.benchmarks ? ` e arquivadas em ${f.fD(Mc.benchmarks.as_of)}` : ''}. A marca cinza é a mediana dos avaliados.`,
                en: `Artificial Analysis indexes, exposed by the catalog; benchmarks run by the source${Mc.benchmarks ? ` and archived on ${f.fD(Mc.benchmarks.as_of)}` : ''}. The gray mark is the median of evaluated models.`,
              })}</p>
            </>
          ) : (
            <p className="vazio">{t({
              pt: 'Sem índice da Artificial Analysis e sem avaliação rodada pela fonte para este modelo. Ausência de avaliação não é nota baixa.',
              en: 'No Artificial Analysis index and no source-run benchmark for this model. A missing benchmark is not a low score.',
            })}</p>
          )}
        </Cartao>
      </div>

      <Cartao id="modelo-comparacao">
        <div className="tabwrap">
          <table className="t mp-comp">
            <thead><tr>
              <th>{t({ pt: 'Modelo', en: 'Model' })}</th><th className="col-lab">{t({ pt: 'Laboratório', en: 'Lab' })}</th>
              <th className="num">{t({ pt: 'Share 7 dias', en: '7-day share' })}</th><th className="num">{t({ pt: 'Preço misto', en: 'Blended price' })}</th>
              <th className="num">{t({ pt: 'Contexto', en: 'Context' })}</th>
              <th className="num">{t({ pt: 'Inteligência', en: 'Intelligence' })}</th><th className="num">{t({ pt: 'Semanas no top 10', en: 'Weeks in top 10' })}</th>
            </tr></thead>
            <tbody>{grupos.map(g => (
              <FragGrupo key={g.pesos} rot={g.rot} itens={g.itens} atual={m.slug} I={I} />
            ))}</tbody>
          </table>
        </div>
        <p className="nota">{t({
          pt: `Share dos últimos 7 dias (${f.fD(j7[0])} a ${f.fD(j7[1])}). Preço misto em dólar por milhão de tokens, com 75% de entrada e 25% de saída. Traço é número não publicado, não zero.`,
          en: `Share over the last 7 days (${f.fD(j7[0])} to ${f.fD(j7[1])}). Blended price in US dollars per million tokens, weighted 75% input and 25% output. A dash means the number is not published, not zero.`,
        })}</p>
      </Cartao>

      <div className="nao" style={{ marginTop: 18 }}>
        {t({
          pt: <><b>O que esta página não diz.</b> Share aqui é fatia do tráfego de um roteador, onde a decisão costuma ser preço por token. Não é participação de mercado, de receita nem de usuários, e não diz qual modelo serve para a sua carga.</>,
          en: <><b>What this page doesn&apos;t say.</b> Share here is a slice of one router&apos;s traffic, where the deciding factor is usually price per token. It is not market, revenue or user share, and it does not tell you which model fits your workload.</>,
        })}
      </div>
    </>
  );
}

function FragTarefa({ x, max, I }: { x: Modelo['tarefas'][number]; max: number; I: Idioma }) {
  const nome = I.tarefa(x);
  return (
    <div className="ln">
      <span className="nm" title={nome}><i style={{ background: `var(${slotMacro(x.macro)})` }} /><span>{nome}</span></span>
      <span className="br"><i style={{ width: `${((100 * x.share_na_tarefa) / max).toFixed(1)}%`, background: `var(${slotMacro(x.macro)})` }} /></span>
      <span className="v">{I.f.pct(x.share_na_tarefa)}</span>
      <span className="p">{I.f.pct(x.peso_da_tarefa)}</span>
    </div>
  );
}

function FragGrupo({ rot, itens, atual, I }: { rot: string; itens: Modelo[]; atual: string; I: Idioma }) {
  return (
    <>
      <tr className="grp"><td colSpan={7}>{rot}</td></tr>
      {itens.map(x => (
        <tr key={x.slug} className={x.slug === atual ? 'eu' : undefined} aria-current={x.slug === atual ? 'page' : undefined}>
          <td className="nm">
            {x.slug === atual ? x.nome : <a href={I.modelo(x.slug)}>{x.nome}</a>}
            {x.slug === atual && <span className="pill">{I.t({ pt: 'esta página', en: 'this page' })}</span>}
            <small className="lab">{I.nomeLab(x.lab)}</small>
          </td>
          <td className="col-lab">{I.nomeLab(x.lab)}</td>
          <td className="num">{x.share_7d && x.share_7d > 0 ? I.f.pct(x.share_7d) : '—'}</td>
          <td className="num">{x.preco_misto == null ? '—' : fmtPreco(x.preco_misto, I)}</td>
          <td className="num">{I.f.fmtCtx(x.contexto)}</td>
          <td className="num">{fmtIdx(valorAA(x, 'aa_inteligencia'), I)}</td>
          <td className="num">{x.semanas_top10}</td>
        </tr>
      ))}
    </>
  );
}
