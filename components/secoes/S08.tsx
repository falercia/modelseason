'use client';
/**
 * Seção 08: qualidade contra adoção.
 *
 * Cartão `quality`: porte do quality() da v1. Um ponto por modelo com volume no
 * último período do recorte (R.qualidade), eixo vertical linear em share (como
 * na v1), horizontal no Índice de Inteligência ou no preço (log). Modelo sem o
 * atributo fica fora do gráfico, nunca no zero, e a cobertura vai no subtítulo.
 *
 * Cartão `custo-tarefa`, novo: acurácia contra custo médio por tarefa nas
 * avaliações publicadas pela OpenRouter (M.benchmarks.evals), com a fronteira de
 * eficiência. É foto do dia da avaliação e não responde à janela nem ao filtro.
 */
import { useMemo, useState } from 'react';
import * as d3 from 'd3';
import type { Mercado } from '@/lib/tipos';
import type { Recorte } from '@/lib/engine';
import type { Texto } from '@/lib/i18n';
import { Cartao, Modos, Secao } from '@/components/shell/Cartao';
import { useHistorico } from '@/components/shell/Historico';
import { useIdioma } from '@/components/shell/Idioma';
import { Legenda, type LinhaTip } from '@/components/graficos/base';
import { ORIGEM_SLOT } from '@/lib/cores';
import { curto, type Fmt } from '@/lib/format';
import { Dispersao, fmtCusto, type PontoD } from './s08-dispersao';

type Q = Recorte['qualidade'][number];

function Pill() {
  const { t } = useIdioma();
  return <span className="pill" style={{ marginLeft: 0, marginRight: 6 }}>{t({ pt: 'recorte', en: 'filtered' })}</span>;
}
function Mod({ s }: { s: string }) {
  const { modelo } = useIdioma();
  return <a className="mono" href={modelo(s)} style={{ color: 'var(--ink)' }}>{s}</a>;
}

/**
 * Nome curto que continua único: dois "deepseek-v4-flash" ganham a data do slug,
 * "16/04" em português e "Apr 16" em inglês (data numérica nunca em inglês).
 */
function rotulador(slugs: string[], f: Fmt) {
  const conta: Record<string, number> = {};
  slugs.forEach(s => { const k = curto(s); conta[k] = (conta[k] || 0) + 1; });
  return (s: string) => {
    const base = curto(s), dt = (s.split(':')[0].match(/-20(\d{6})$/) || [])[1];
    const data = dt && (f.lang === 'pt'
      ? `${dt.slice(4, 6)}/${dt.slice(2, 4)}`
      : f.marcaDia(new Date(2000 + +dt.slice(0, 2), +dt.slice(2, 4) - 1, +dt.slice(4, 6))));
    return (conta[base] > 1 && data ? `${base} ${data}` : base).slice(0, 28);
  };
}

/** Marcas de eixo da seção, no idioma de f. */
function eixos(f: Fmt) {
  const fmtPrecoEixo = (d: number) => '$' + (d >= 1 ? f.dec(d3.format('~f')(d)) : f.dec(d.toFixed(d < 0.1 ? 3 : 2).replace(/0+$/, '').replace(/\.$/, '')));
  const fmtShareEixo = (v: number) => f.fmtNum(v, 2) + '%';
  const fmtCustoEixo = (v: number) => '$' + f.dec(String(+v.toPrecision(2)));
  return { fmtPrecoEixo, fmtShareEixo, fmtCustoEixo };
}
// Inteiro sem passar por fmtNum(v, 0), que corta zero significativo (30 vira 3).
const fmtInt = (v: number) => String(Math.round(v));

// ------------------------------------------------------------------ qualidade contra adoção

function Qualidade() {
  const { R } = useHistorico();
  const { t, f, valor: rotValor, modelo } = useIdioma();
  const { fmtPrecoEixo, fmtShareEixo } = eixos(f);
  const [modo, setModo] = useState<'aa' | 'preco'>('aa');
  const g = R.estado.gran, u = R.N - 1;
  const ult = g === 'mes' ? t({ pt: 'no último mês', en: 'in the last month' }) : t({ pt: 'na última semana', en: 'in the last week' });
  const campo = modo;
  const valor = (r: Q) => (campo === 'aa' ? r.aa : r.preco);
  const cobertura = R.qualidade.filter(r => r.share > 0);
  const pts = cobertura.filter(r => { const v = valor(r); return v != null && v > 0; });
  const base = modo === 'aa'
    ? t({ pt: 'Índice de Inteligência da Artificial Analysis, exposto pela API do OpenRouter.', en: "Artificial Analysis Intelligence Index, as exposed by the router's API." })
    : t({ pt: 'Preço misto por 1M de tokens contra adoção.', en: 'Blended price per 1M tokens against adoption.' });
  // "têm o índice" / "have an index score"; "tem o índice publicado" / "has a published index score"
  const atributo = modo === 'aa' ? t({ pt: 'o índice', en: 'an index score' }) : t({ pt: 'preço', en: 'a price' });
  const publicado = modo === 'aa'
    ? t({ pt: 'o índice publicado', en: 'a published index score' })
    : t({ pt: 'preço publicado', en: 'a published price' });
  const sub = cobertura.length === 0
    ? t({ pt: `${base} Nenhum modelo com volume no recorte atual.`, en: `${base} No model has volume in the current view.` })
    : pts.length === 0
      ? t({ pt: `${base} Nenhum dos ${cobertura.length} modelos do recorte tem ${publicado}.`, en: `${base} None of the ${cobertura.length} models in the view has ${publicado}.` })
      : t({
          pt: `${base} ${pts.length} de ${cobertura.length} modelos com volume ${ult} da janela (${f.fPer(R.eixo[u], g)}) têm ${atributo}; os outros ficam fora.`,
          en: `${base} ${pts.length} of ${cobertura.length} models with volume ${ult} of the window (${f.fPer(R.eixo[u], g)}) have ${atributo}; the rest are left out.`,
        });

  const med = pts.length ? { x: d3.median(pts, p => valor(p) as number)!, y: d3.median(pts, p => p.share)! } : null;
  const rot = rotulador(pts.map(p => p.slug), f);
  const maxT = d3.max(pts, p => p.T) ?? 1;
  const r = d3.scaleSqrt().domain([0, maxT]).range([3, 18]);
  // casos da leitura: qualidade sem adoção e adoção sem qualidade (só no modo índice)
  const subusado = modo === 'aa' && med ? pts.filter(p => (p.aa as number) > med.x && p.share < med.y).sort((a, b) => (b.aa as number) - (a.aa as number))[0] : undefined;
  const sobreusado = modo === 'aa' && med ? pts.filter(p => (p.aa as number) < med.x && p.share > med.y).sort((a, b) => b.share - a.share)[0] : undefined;
  const caroUsado = modo === 'preco' && med ? pts.filter(p => (p.preco as number) > med.x).sort((a, b) => b.share - a.share)[0] : undefined;
  const topo10 = [...pts].sort((a, b) => b.share - a.share).slice(0, 10);
  const baratosTopo = med ? topo10.filter(p => (p.preco as number) < med.x).length : 0;

  const prio: Record<string, number> = {};
  [...pts].sort((a, b) => b.share - a.share).slice(0, 5).forEach((p, i) => (prio[p.slug] = i));
  const melhor = [...pts].sort((a, b) => (valor(b) as number) - (valor(a) as number))[0];
  if (melhor && prio[melhor.slug] == null) prio[melhor.slug] = 5;
  [subusado, sobreusado, caroUsado].forEach((p, i) => { if (p && prio[p.slug] == null) prio[p.slug] = 6 + i; });

  const pontos: PontoD[] = pts.map(p => {
    const linhas: LinhaTip[] = [
      { cor: ORIGEM_SLOT[p.origin] ?? '--s0', rot: t({ pt: 'Origem', en: 'Origin' }), val: rotValor(p.origin) },
      { rot: 'Share', val: f.fmtP(p.share, p.share < 0.1 ? 2 : 1) },
      { rot: t({ pt: 'Tokens por semana', en: 'Tokens per week' }), val: f.fmtT(p.T) },
    ];
    if (p.aa != null) linhas.push({ rot: t({ pt: 'Índice de Inteligência', en: 'Intelligence Index' }), val: f.fmtNum(p.aa, 1) });
    if (p.elo != null) linhas.push({ rot: t({ pt: 'Elo (arena de modelos)', en: 'Elo (model arena)' }), val: String(Math.round(p.elo)) });
    if (p.preco != null) linhas.push({ rot: t({ pt: 'Preço por 1M', en: 'Price per 1M' }), val: f.fmtUSD(p.preco) + (p.slug.endsWith(':free') ? t({ pt: ' (endpoint grátis)', en: ' (free endpoint)' }) : '') });
    if (p.ctx) linhas.push({ rot: t({ pt: 'Contexto', en: 'Context' }), val: f.fmtCtx(p.ctx) });
    if (p.lanc) linhas.push({ rot: t({ pt: 'Lançamento', en: 'Launch' }), val: f.fD(p.lanc) });
    return {
      key: p.slug, x: valor(p) as number, y: p.share, r: r(p.T), slot: ORIGEM_SLOT[p.origin] ?? '--s0', opacidade: 0.66,
      href: modelo(p.slug), rotulo: rot(p.slug), prioridade: prio[p.slug], titulo: p.slug, linhas,
    };
  });
  const origens = Object.keys(ORIGEM_SLOT).filter(o => pts.some(p => p.origin === o));
  const quad: [string, string, string, string] = modo === 'aa'
    ? t({
        pt: ['índice abaixo da mediana, muito usado', 'índice acima da mediana, muito usado', 'abaixo da mediana, pouco usado', 'acima da mediana, pouco usado'],
        en: ['index below median, heavily used', 'index above median, heavily used', 'below median, lightly used', 'above median, lightly used'],
      })
    : t({
        pt: ['mais barato que a mediana, muito usado', 'mais caro que a mediana, muito usado', 'mais barato, pouco usado', 'mais caro, pouco usado'],
        en: ['cheaper than median, heavily used', 'pricier than median, heavily used', 'cheaper, lightly used', 'pricier, lightly used'],
      });
  const quadCurto: [string, string, string, string] = modo === 'aa'
    ? t({
        pt: ['índice menor, muito uso', 'índice maior, muito uso', 'menor, pouco uso', 'maior, pouco uso'],
        en: ['lower index, high use', 'higher index, high use', 'lower, low use', 'higher, low use'],
      })
    : t({
        pt: ['mais barato, muito uso', 'mais caro, muito uso', 'mais barato, pouco uso', 'mais caro, pouco uso'],
        en: ['cheaper, high use', 'pricier, high use', 'cheaper, low use', 'pricier, low use'],
      });
  const nomeX = modo === 'aa'
    ? t({ pt: 'Índice de Inteligência', en: 'Intelligence Index' })
    : t({ pt: 'preço por milhão de tokens', en: 'price per million tokens' });

  return (
    <Cartao id="quality" subtitulo={sub}
      acoes={<Modos valor={modo} onChange={setModo} rotulo={t({ pt: 'Eixo horizontal', en: 'Horizontal axis' })}
        opcoes={[['aa', t({ pt: 'Inteligência', en: 'Intelligence' })], ['preco', t({ pt: 'Preço', en: 'Price' })]]} />}>
      {pts.length < 4 ? (
        <p className="vazio">{pts.length
          ? t({
              pt: `Apenas ${pts.length} ${pts.length === 1 ? 'modelo tem' : 'modelos têm'} ${atributo} no recorte atual: poucos pontos para uma dispersão. A tabela abaixo continua disponível.`,
              en: `Only ${pts.length} ${pts.length === 1 ? 'model has' : 'models have'} ${atributo} in the current view: too few points for a scatter plot. The table below is still available.`,
            })
          : t({ pt: `Nenhum modelo do recorte atual tem ${publicado}.`, en: `No model in the current view has ${publicado}.` })}</p>
      ) : (
        <>
          <Legenda itens={origens.map(o => ({ key: o, label: rotValor(o), slot: ORIGEM_SLOT[o] }))} />
          <Dispersao pontos={pontos} escalaX={modo === 'preco' ? 'log' : 'lin'} medianas={med!} quadrantes={quad} quadrantesCurtos={quadCurto}
            fmtX={modo === 'preco' ? fmtPrecoEixo : fmtInt} fmtY={fmtShareEixo}
            tituloX={modo === 'aa'
              ? t({ pt: 'Índice de Inteligência →', en: 'Intelligence Index →' })
              : t({ pt: 'US$ por 1M de tokens, escala log →', en: '$ per 1M tokens, log scale →' })}
            tituloY={t({ pt: `share ${ult.replace('na ', 'da ').replace('no ', 'do ')} →`, en: `share ${ult} →` })}
            rotuloAria={t({
              pt: `Dispersão de ${pts.length} modelos: share de tokens ${ult} contra ${nomeX}. Medianas: ${modo === 'aa' ? f.fmtNum(med!.x, 1) : f.fmtUSD(med!.x)} e ${f.fmtP(med!.y)} de share.`,
              en: `Scatter plot of ${pts.length} models: token share ${ult} against ${nomeX}. Medians: ${modo === 'aa' ? f.fmtNum(med!.x, 1) : f.fmtUSD(med!.x)} and ${f.fmtP(med!.y)} share.`,
            })} />
          <p className="nota" style={{ marginTop: 2 }}>{t({
            pt: 'Cor: origem do laboratório. Tamanho da bolha: tokens no período. Linhas tracejadas: medianas dos modelos no gráfico. Clique num ponto para abrir a página do modelo.',
            en: "Color: lab origin. Bubble size: tokens in the period. Dashed lines: medians of the models in the chart. Click a point to open the model's page.",
          })}</p>
          <div className="leitura">
            {R.cobertura.filtrando && <Pill />}
            {t({
              pt: <>Dos {cobertura.length} modelos com volume {ult}, <b>{pts.length}</b> têm {atributo}. A mediana {modo === 'aa' ? <>do índice é <b>{f.fmtNum(med!.x, 1)}</b></> : <>de preço é <b>{f.fmtUSD(med!.x)}</b> por 1M</>} e a de share é {f.fmtP(med!.y, 2)}.</>,
              en: <>Of the {cobertura.length} models with volume {ult}, <b>{pts.length}</b> have {atributo}. The median {modo === 'aa' ? <>index score is <b>{f.fmtNum(med!.x, 1)}</b></> : <>price is <b>{f.fmtUSD(med!.x)}</b> per 1M</>} and the median share is {f.fmtP(med!.y, 2)}.</>,
            })}
            {subusado && t({
              pt: <> O caso mais claro de qualidade sem adoção é <Mod s={subusado.slug} />: índice {f.fmtNum(subusado.aa, 1)}, share de {f.fmtP(subusado.share, 2)}.</>,
              en: <> The clearest case of quality without adoption is <Mod s={subusado.slug} />: index {f.fmtNum(subusado.aa, 1)}, share {f.fmtP(subusado.share, 2)}.</>,
            })}
            {sobreusado && t({
              pt: <> O inverso, adoção sem índice alto: <Mod s={sobreusado.slug} />, índice {f.fmtNum(sobreusado.aa, 1)} e share de {f.fmtP(sobreusado.share)}.</>,
              en: <> The reverse, adoption without a high index: <Mod s={sobreusado.slug} />, index {f.fmtNum(sobreusado.aa, 1)} and share {f.fmtP(sobreusado.share)}.</>,
            })}
            {modo === 'preco' && t({
              pt: <> Dos {topo10.length} mais usados com preço, <b>{baratosTopo}</b> custam menos que a mediana.</>,
              en: <> Of the {topo10.length} most used models with a price, <b>{baratosTopo}</b> cost less than the median.</>,
            })}
            {caroUsado && t({
              pt: <> O mais usado entre os mais caros que a mediana é <Mod s={caroUsado.slug} />, a {f.fmtUSD(caroUsado.preco)} por 1M e {f.fmtP(caroUsado.share)} de share.</>,
              en: <> The most used among those pricier than the median is <Mod s={caroUsado.slug} />, at {f.fmtUSD(caroUsado.preco)} per 1M with {f.fmtP(caroUsado.share)} share.</>,
            })}
            {' '}{t({
              pt: 'Benchmark diz o que o modelo consegue fazer; share diz o que as pessoas escolheram rodar. Quando divergem, o modo Preço ajuda a ver se a diferença é custo.',
              en: 'Benchmarks say what a model can do; share says what people chose to run. When they diverge, Price mode helps show whether the gap is cost.',
            })}
          </div>
        </>
      )}
      <details className="tab">
        <summary>{t({ pt: 'Ver os números', en: 'See the numbers' })}</summary>
        <div className="tabwrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
          <table className="t">
            <thead><tr>
              <th>{t({ pt: 'Modelo', en: 'Model' })}</th><th>{t({ pt: 'Origem', en: 'Origin' })}</th><th className="num">Share</th>
              <th className="num">{t({ pt: 'Tokens/sem', en: 'Tokens/wk' })}</th><th className="num">{t({ pt: 'Inteligência', en: 'Intelligence' })}</th><th className="num">Elo</th>
              <th className="num">{t({ pt: 'US$/1M', en: '$/1M' })}</th><th className="num">{t({ pt: 'Contexto', en: 'Context' })}</th><th className="num">{t({ pt: 'Lançamento', en: 'Launch' })}</th>
            </tr></thead>
            <tbody>{cobertura.map(p => (
              <tr key={p.slug}>
                <td><a className="mono" href={modelo(p.slug)}>{p.slug}</a></td><td>{rotValor(p.origin)}</td>
                <td className="num">{f.fmtP(p.share, 2)}</td><td className="num">{f.fmtT(p.T)}</td><td className="num">{p.aa == null ? '—' : f.fmtNum(p.aa, 1)}</td>
                <td className="num">{p.elo == null ? '—' : Math.round(p.elo)}</td><td className="num">{f.fmtUSD(p.preco)}</td><td className="num">{f.fmtCtx(p.ctx)}</td>
                <td className="num">{p.lanc ? f.fD(p.lanc) : '—'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </details>
    </Cartao>
  );
}

// ------------------------------------------------------------------ custo por tarefa

type Ev = NonNullable<Mercado['benchmarks']>['evals'][number];
const MIN_AVAL = 8; // avaliação com menos modelos que isso não vira modo: poucos pontos para uma fronteira
const NOME_AVAL: Record<string, Texto> = {
  tau_bench_verified_airline: { pt: 'τ-bench, companhia aérea', en: 'τ-bench, airline' },
  gpqa_diamond: { pt: 'GPQA Diamond', en: 'GPQA Diamond' },
  search_browsecomp: { pt: 'BrowseComp', en: 'BrowseComp' },
  search_dsqa: { pt: 'DSQA', en: 'DSQA' },
  search_hle: { pt: 'HLE com busca', en: 'HLE with search' },
  search_widesearch: { pt: 'WideSearch', en: 'WideSearch' },
};

/** Fronteira de eficiência: ninguém mais barato (ou igual) acerta mais. Ordena por custo e guarda quem bate o recorde de acurácia. */
function fronteiraDe(pts: Ev[]) {
  const ord = [...pts].sort((a, b) => (a.custo_tarefa as number) - (b.custo_tarefa as number) || (b.score as number) - (a.score as number));
  const f: Ev[] = []; let rec = -Infinity;
  for (const p of ord) if ((p.score as number) > rec) { f.push(p); rec = p.score as number; }
  return f;
}

function CustoTarefa({ M }: { M: Mercado }) {
  const { D } = useHistorico();
  const { t, f, modelo, nomeLab } = useIdioma();
  const { fmtCustoEixo } = eixos(f);
  const custo = (v: number | null | undefined) => fmtCusto(v, f);
  const nomeAval = (k: string) => { const n = NOME_AVAL[k]; return n ? t(n) : k.replace(/_/g, ' '); };
  const B = M.benchmarks;
  const comPagina = useMemo(() => new Set(D.matriz.modelos.map(m => m.s.split(':')[0])), [D]);
  const validos = (B?.evals ?? []).filter(e => e.score != null && e.custo_tarefa != null && e.custo_tarefa > 0);
  const porTipo = d3.group(validos, e => e.tipo);
  const tipos = [...porTipo.keys()].filter(k => porTipo.get(k)!.length >= MIN_AVAL).sort((a, b) => porTipo.get(b)!.length - porTipo.get(a)!.length);
  const pequenos = [...porTipo.keys()].filter(k => !tipos.includes(k));
  const [escolha, setTipo] = useState<string | null>(null);
  const tipo = escolha && tipos.includes(escolha) ? escolha : tipos[0];
  const sub = B
    ? t({
        pt: `Avaliações da OpenRouter em ${f.fD(B.as_of)}. Foto do dia: não responde à janela nem aos filtros.`,
        en: `Evaluations published by the router on ${f.fD(B.as_of)}. A snapshot of that day: it does not respond to the window or the filters.`,
      })
    : t({ pt: 'Sem avaliações nesta publicação.', en: 'No evaluations in this version of the data.' });

  if (!B || !tipo) return <Cartao id="custo-tarefa" novo subtitulo={sub}><p className="vazio">{t({
    pt: `Nenhuma avaliação com acurácia e custo por tarefa para pelo menos ${MIN_AVAL} modelos nesta publicação.`,
    en: `No evaluation has accuracy and cost per task for at least ${MIN_AVAL} models in this version of the data.`,
  })}</p></Cartao>;

  const pts = porTipo.get(tipo)!;
  const fr = fronteiraDe(pts);
  const naFr = new Set(fr);
  const tarefas = pts.map(p => p.tarefas).filter((v): v is number => v != null);
  const link = (s: string) => (comPagina.has(s.split(':')[0]) ? modelo(s) : undefined);
  const naFronteira = t({ pt: 'Na fronteira de eficiência', en: 'On the efficiency frontier' });
  const foraFronteira = t({ pt: 'Fora da fronteira', en: 'Off the frontier' });
  // prioridade de rótulo: pontas da fronteira primeiro, depois o meio
  const prio = new Map<Ev, number>();
  fr.forEach((p, i) => prio.set(p, i === 0 || i === fr.length - 1 ? i === 0 ? 0 : 1 : 2 + Math.abs(i - fr.length / 2)));
  const pontos: PontoD[] = pts.map((p, i) => ({
    key: p.slug + '#' + i, x: p.custo_tarefa as number, y: 100 * (p.score as number), r: naFr.has(p) ? 5 : 3.6,
    slot: naFr.has(p) ? '--ink' : '--s0', opacidade: naFr.has(p) ? 0.95 : 0.6, forte: naFr.has(p),
    href: link(p.slug), rotulo: naFr.has(p) ? p.nome : undefined, prioridade: prio.get(p), titulo: p.nome,
    linhas: [
      { rot: t({ pt: 'Laboratório', en: 'Lab' }), val: nomeLab(p.lab) },
      { rot: t({ pt: 'Acurácia', en: 'Accuracy' }), val: f.fmtP(100 * (p.score as number)) },
      { rot: t({ pt: 'Custo médio por tarefa', en: 'Average cost per task' }), val: custo(p.custo_tarefa) },
      { rot: t({ pt: 'Tarefas avaliadas', en: 'Tasks evaluated' }), val: p.tarefas == null ? '—' : String(p.tarefas) },
      { rot: naFr.has(p) ? naFronteira : foraFronteira, val: '' },
      ...(link(p.slug) ? [] : [{ rot: t({ pt: 'Sem página: sem volume no histórico', en: 'No page: no volume in the history' }), val: '' }]),
    ],
  }));
  const ys = pts.map(p => 100 * (p.score as number));
  const yLo = Math.max(0, (d3.min(ys) ?? 0) - 4), yHi = Math.min(100, (d3.max(ys) ?? 100) + 4);
  // leitura
  const barato = fr[0], topo = fr[fr.length - 1];
  const mult = barato && topo && barato !== topo ? (topo.custo_tarefa as number) / (barato.custo_tarefa as number) : null;
  const dominado = pts.filter(p => !naFr.has(p)).sort((a, b) => (b.custo_tarefa as number) - (a.custo_tarefa as number))[0];
  const quemDomina = dominado ? fr.find(e => (e.score as number) >= (dominado.score as number) && (e.custo_tarefa as number) <= (dominado.custo_tarefa as number)) : undefined;
  const NomeLink = ({ e }: { e: Ev }) => (link(e.slug) ? <a href={link(e.slug)} style={{ color: 'var(--ink)' }}>{e.nome}</a> : <>{e.nome}</>);
  const aval = nomeAval(tipo);
  const multTxt = mult ? (mult >= 10 ? String(Math.round(mult)) : f.dec(mult.toFixed(1))) : '';
  const ganho = barato && topo ? f.fmtNum(100 * ((topo.score as number) - (barato.score as number)), 1) : '';

  return (
    <Cartao id="custo-tarefa" novo subtitulo={t({
      pt: <>{sub} {pts.length} modelos com acurácia e custo em {aval}{tarefas.length ? `, de ${d3.min(tarefas)} a ${d3.max(tarefas)} tarefas por modelo` : ''}.</>,
      en: <>{sub} {pts.length} models with accuracy and cost on {aval}{tarefas.length ? `, from ${d3.min(tarefas)} to ${d3.max(tarefas)} tasks per model` : ''}.</>,
    })}
      >
      {/* Seletor no corpo, não no cabeçalho: os nomes das avaliações são longos e espremeriam o título em tela estreita. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <Legenda itens={[{ key: 'f', label: naFronteira, slot: '--ink' }, { key: 'o', label: foraFronteira, slot: '--s0' }]} />
        {tipos.length > 1 && <Modos valor={tipo} onChange={setTipo} rotulo={t({ pt: 'Avaliação', en: 'Evaluation' })} opcoes={tipos.map(k => [k, nomeAval(k)] as [string, string])} />}
      </div>
      <Dispersao pontos={pontos} escalaX="log" fronteira={fr.map(p => ({ x: p.custo_tarefa as number, y: 100 * (p.score as number) }))}
        fmtX={fmtCustoEixo} fmtY={v => fmtInt(v) + '%'} dominioY={[yLo, yHi]} altura={380} maxRotulos={7}
        tituloX={t({ pt: 'custo médio por tarefa, US$, escala log →', en: 'average cost per task, $, log scale →' })}
        tituloY={t({ pt: 'acurácia →', en: 'accuracy →' })}
        rotuloAria={t({
          pt: `Dispersão de ${pts.length} modelos na avaliação ${aval}: acurácia contra custo médio por tarefa. ${fr.length} modelos na fronteira de eficiência, de ${barato?.nome} a ${topo?.nome}.`,
          en: `Scatter plot of ${pts.length} models on the ${aval} evaluation: accuracy against average cost per task. ${fr.length} models on the efficiency frontier, from ${barato?.nome} to ${topo?.nome}.`,
        })} />
      <div className="leitura">
        {t({
          pt: <>Na {aval}, <b>{fr.length}</b> dos {pts.length} modelos formam a fronteira: nenhum outro é ao mesmo tempo mais barato e mais preciso que eles.</>,
          en: <>On {aval}, <b>{fr.length}</b> of the {pts.length} models form the frontier: no other model is both cheaper and more accurate than they are.</>,
        })}
        {barato && topo && barato !== topo && t({
          pt: <> Ela vai de <NomeLink e={barato} /> ({f.fmtP(100 * (barato.score as number))}, {custo(barato.custo_tarefa)} por tarefa) a <NomeLink e={topo} /> ({f.fmtP(100 * (topo.score as number))}, {custo(topo.custo_tarefa)}){mult ? <>: {ganho} pontos de acurácia a mais custam <b>{multTxt} vezes</b> mais por tarefa</> : null}.</>,
          en: <> It runs from <NomeLink e={barato} /> ({f.fmtP(100 * (barato.score as number))}, {custo(barato.custo_tarefa)} per task) to <NomeLink e={topo} /> ({f.fmtP(100 * (topo.score as number))}, {custo(topo.custo_tarefa)}){mult ? <>: {ganho} more points of accuracy cost <b>{multTxt} times</b> as much per task</> : null}.</>,
        })}
        {dominado && quemDomina && t({
          pt: <> O mais caro fora da fronteira é <NomeLink e={dominado} />, a {custo(dominado.custo_tarefa)} por tarefa com {f.fmtP(100 * (dominado.score as number))}; <NomeLink e={quemDomina} /> acerta {f.fmtP(100 * (quemDomina.score as number))} por {custo(quemDomina.custo_tarefa)}.</>,
          en: <> The priciest model off the frontier is <NomeLink e={dominado} />, at {custo(dominado.custo_tarefa)} per task with {f.fmtP(100 * (dominado.score as number))}; <NomeLink e={quemDomina} /> scores {f.fmtP(100 * (quemDomina.score as number))} for {custo(quemDomina.custo_tarefa)}.</>,
        })}
      </div>
      <div className="tabwrap" style={{ marginTop: 10 }}>
        <table className="t">
          <caption className="sr">{t({ pt: 'Modelos na fronteira de eficiência, do mais barato ao mais preciso', en: 'Models on the efficiency frontier, from cheapest to most accurate' })}</caption>
          <thead><tr>
            <th>{t({ pt: 'Na fronteira', en: 'On the frontier' })}</th><th>{t({ pt: 'Laboratório', en: 'Lab' })}</th><th className="num">{t({ pt: 'Acurácia', en: 'Accuracy' })}</th>
            <th className="num">{t({ pt: 'Custo por tarefa', en: 'Cost per task' })}</th><th className="num">{t({ pt: 'Tarefas', en: 'Tasks' })}</th>
          </tr></thead>
          <tbody>{fr.map(p => (
            <tr key={p.slug}>
              <td>{link(p.slug) ? <a href={link(p.slug)}>{p.nome}</a> : p.nome}</td><td>{nomeLab(p.lab)}</td>
              <td className="num">{f.fmtP(100 * (p.score as number))}</td><td className="num">{custo(p.custo_tarefa)}</td><td className="num">{p.tarefas ?? '—'}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {pequenos.length > 0 && (
        <p className="nota">{t({ pt: 'Fora do seletor por terem poucos modelos: ', en: 'Left out of the selector for having too few models: ' })}{pequenos.map(k => `${nomeAval(k)} (${porTipo.get(k)!.length})`).join(', ')}.</p>
      )}
    </Cartao>
  );
}

export default function S08({ M }: { M: Mercado }) {
  const { t } = useIdioma();
  return (
    <Secao id="s08" n="08" titulo={t({ pt: 'Qualidade contra adoção', en: 'Quality vs. adoption' })}
      sub={t({
        pt: 'Capacidade medida por terceiros contra o que o tráfego escolhe. O primeiro cartão responde à janela e aos filtros; o segundo é foto do dia da avaliação.',
        en: 'Capability measured by third parties against what traffic actually picks. The first card responds to the window and the filters; the second is a snapshot from the evaluation date.',
      })}>
      <Qualidade />
      <div style={{ marginTop: 14 }}><CustoTarefa M={M} /></div>
    </Secao>
  );
}
