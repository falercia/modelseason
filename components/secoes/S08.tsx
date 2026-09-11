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
import { Cartao, Modos, Secao } from '@/components/shell/Cartao';
import { useHistorico } from '@/components/shell/Historico';
import { Legenda, type LinhaTip } from '@/components/graficos/base';
import { ORIGEM_SLOT } from '@/lib/cores';
import { br, curto, fD, fPer, fmtCtx, fmtNum, fmtP, fmtT, fmtUSD, urlModelo } from '@/lib/format';
import { Dispersao, fmtCusto, type PontoD } from './s08-dispersao';

type Q = Recorte['qualidade'][number];
const Pill = () => <span className="pill" style={{ marginLeft: 0, marginRight: 6 }}>recorte</span>;
const Mod = ({ s }: { s: string }) => <a className="mono" href={urlModelo(s)} style={{ color: 'var(--ink)' }}>{s}</a>;

/** Nome curto que continua único: dois "deepseek-v4-flash" ganham a data (dd/mm) do slug. */
function rotulador(slugs: string[]) {
  const conta: Record<string, number> = {};
  slugs.forEach(s => { const k = curto(s); conta[k] = (conta[k] || 0) + 1; });
  return (s: string) => {
    const base = curto(s), dt = (s.split(':')[0].match(/-20(\d{6})$/) || [])[1];
    return (conta[base] > 1 && dt ? `${base} ${dt.slice(4, 6)}/${dt.slice(2, 4)}` : base).slice(0, 28);
  };
}

const fmtPrecoEixo = (d: number) => '$' + (d >= 1 ? br(d3.format('~f')(d)) : br(d.toFixed(d < 0.1 ? 3 : 2).replace(/0+$/, '').replace(/\.$/, '')));
const fmtShareEixo = (v: number) => fmtNum(v, 2) + '%';
// Inteiro sem passar por fmtNum(v, 0), que corta zero significativo (30 vira 3).
const fmtInt = (v: number) => String(Math.round(v));
const fmtCustoEixo = (v: number) => '$' + String(+v.toPrecision(2)).replace('.', ',');

// ------------------------------------------------------------------ qualidade contra adoção

function Qualidade() {
  const { R } = useHistorico();
  const [modo, setModo] = useState<'aa' | 'preco'>('aa');
  const g = R.estado.gran, u = R.N - 1;
  const ult = g === 'mes' ? 'no último mês' : 'na última semana';
  const campo = modo;
  const valor = (r: Q) => (campo === 'aa' ? r.aa : r.preco);
  const cobertura = R.qualidade.filter(r => r.share > 0);
  const pts = cobertura.filter(r => { const v = valor(r); return v != null && v > 0; });
  const base = modo === 'aa'
    ? 'Índice de Inteligência da Artificial Analysis, exposto pela API do OpenRouter.'
    : 'Preço misto por 1M de tokens contra adoção.';
  const atributo = modo === 'aa' ? 'o índice' : 'preço';
  const sub = cobertura.length === 0 ? `${base} Nenhum modelo com volume no recorte atual.`
    : pts.length === 0 ? `${base} Nenhum dos ${cobertura.length} modelos do recorte tem ${atributo} publicado.`
    : `${base} ${pts.length} de ${cobertura.length} modelos com volume ${ult} da janela (${fPer(R.eixo[u], g)}) têm ${atributo}; os outros ficam fora.`;

  const med = pts.length ? { x: d3.median(pts, p => valor(p) as number)!, y: d3.median(pts, p => p.share)! } : null;
  const rot = rotulador(pts.map(p => p.slug));
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
      { cor: ORIGEM_SLOT[p.origin] ?? '--s0', rot: 'Origem', val: p.origin },
      { rot: 'Share', val: fmtP(p.share, p.share < 0.1 ? 2 : 1) },
      { rot: `Tokens por semana`, val: fmtT(p.T) },
    ];
    if (p.aa != null) linhas.push({ rot: 'Índice de Inteligência', val: fmtNum(p.aa, 1) });
    if (p.elo != null) linhas.push({ rot: 'Elo (arena de modelos)', val: String(Math.round(p.elo)) });
    if (p.preco != null) linhas.push({ rot: 'Preço por 1M', val: fmtUSD(p.preco) + (p.slug.endsWith(':free') ? ' (endpoint grátis)' : '') });
    if (p.ctx) linhas.push({ rot: 'Contexto', val: fmtCtx(p.ctx) });
    if (p.lanc) linhas.push({ rot: 'Lançamento', val: fD(p.lanc) });
    return {
      key: p.slug, x: valor(p) as number, y: p.share, r: r(p.T), slot: ORIGEM_SLOT[p.origin] ?? '--s0', opacidade: 0.66,
      href: urlModelo(p.slug), rotulo: rot(p.slug), prioridade: prio[p.slug], titulo: p.slug, linhas,
    };
  });
  const origens = Object.keys(ORIGEM_SLOT).filter(o => pts.some(p => p.origin === o));
  const quad: [string, string, string, string] = modo === 'aa'
    ? ['índice abaixo da mediana, muito usado', 'índice acima da mediana, muito usado', 'abaixo da mediana, pouco usado', 'acima da mediana, pouco usado']
    : ['mais barato que a mediana, muito usado', 'mais caro que a mediana, muito usado', 'mais barato, pouco usado', 'mais caro, pouco usado'];
  const quadCurto: [string, string, string, string] = modo === 'aa'
    ? ['índice menor, muito uso', 'índice maior, muito uso', 'menor, pouco uso', 'maior, pouco uso']
    : ['mais barato, muito uso', 'mais caro, muito uso', 'mais barato, pouco uso', 'mais caro, pouco uso'];

  return (
    <Cartao id="quality" subtitulo={sub}
      acoes={<Modos valor={modo} onChange={setModo} rotulo="Eixo horizontal" opcoes={[['aa', 'Inteligência'], ['preco', 'Preço']]} />}>
      {pts.length < 4 ? (
        <p className="vazio">{pts.length
          ? `Apenas ${pts.length} ${pts.length === 1 ? 'modelo tem' : 'modelos têm'} ${atributo} no recorte atual: poucos pontos para uma dispersão. A tabela abaixo continua disponível.`
          : `Nenhum modelo do recorte atual tem ${atributo} publicado.`}</p>
      ) : (
        <>
          <Legenda itens={origens.map(o => ({ key: o, label: o, slot: ORIGEM_SLOT[o] }))} />
          <Dispersao pontos={pontos} escalaX={modo === 'preco' ? 'log' : 'lin'} medianas={med!} quadrantes={quad} quadrantesCurtos={quadCurto}
            fmtX={modo === 'preco' ? fmtPrecoEixo : fmtInt} fmtY={fmtShareEixo}
            tituloX={modo === 'aa' ? 'Índice de Inteligência →' : 'US$ por 1M de tokens, escala log →'} tituloY={`share ${ult.replace('na ', 'da ').replace('no ', 'do ')} →`}
            rotuloAria={`Dispersão de ${pts.length} modelos: share de tokens ${ult} contra ${modo === 'aa' ? 'Índice de Inteligência' : 'preço por milhão de tokens'}. Medianas: ${modo === 'aa' ? fmtNum(med!.x, 1) : fmtUSD(med!.x)} e ${fmtP(med!.y)} de share.`} />
          <p className="nota" style={{ marginTop: 2 }}>Cor: origem do laboratório. Tamanho da bolha: tokens no período. Linhas tracejadas: medianas dos modelos no gráfico. Clique num ponto para abrir a página do modelo.</p>
          <div className="leitura">
            {R.cobertura.filtrando && <Pill />}
            Dos {cobertura.length} modelos com volume {ult}, <b>{pts.length}</b> têm {atributo}. A mediana {modo === 'aa' ? <>do índice é <b>{fmtNum(med!.x, 1)}</b></> : <>de preço é <b>{fmtUSD(med!.x)}</b> por 1M</>} e a de share é {fmtP(med!.y, 2)}.
            {subusado && <> O caso mais claro de qualidade sem adoção é <Mod s={subusado.slug} />: índice {fmtNum(subusado.aa, 1)}, share de {fmtP(subusado.share, 2)}.</>}
            {sobreusado && <> O inverso, adoção sem índice alto: <Mod s={sobreusado.slug} />, índice {fmtNum(sobreusado.aa, 1)} e share de {fmtP(sobreusado.share)}.</>}
            {modo === 'preco' && <> Dos {topo10.length} mais usados com preço, <b>{baratosTopo}</b> custam menos que a mediana.</>}
            {caroUsado && <> O mais usado entre os mais caros que a mediana é <Mod s={caroUsado.slug} />, a {fmtUSD(caroUsado.preco)} por 1M e {fmtP(caroUsado.share)} de share.</>}
            {' '}Benchmark diz o que o modelo consegue fazer; share diz o que as pessoas escolheram rodar. Quando divergem, o modo Preço ajuda a ver se a diferença é custo.
          </div>
        </>
      )}
      <details className="tab">
        <summary>Ver os números</summary>
        <div className="tabwrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
          <table className="t">
            <thead><tr><th>Modelo</th><th>Origem</th><th className="num">Share</th><th className="num">Tokens/sem</th><th className="num">Inteligência</th><th className="num">Elo</th><th className="num">US$/1M</th><th className="num">Contexto</th><th className="num">Lançamento</th></tr></thead>
            <tbody>{cobertura.map(p => (
              <tr key={p.slug}>
                <td><a className="mono" href={urlModelo(p.slug)}>{p.slug}</a></td><td>{p.origin}</td>
                <td className="num">{fmtP(p.share, 2)}</td><td className="num">{fmtT(p.T)}</td><td className="num">{p.aa == null ? '—' : fmtNum(p.aa, 1)}</td>
                <td className="num">{p.elo == null ? '—' : Math.round(p.elo)}</td><td className="num">{fmtUSD(p.preco)}</td><td className="num">{fmtCtx(p.ctx)}</td>
                <td className="num">{p.lanc ? fD(p.lanc) : '—'}</td>
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
const NOME_AVAL: Record<string, string> = {
  tau_bench_verified_airline: 'τ-bench, companhia aérea', gpqa_diamond: 'GPQA Diamond',
  search_browsecomp: 'BrowseComp', search_dsqa: 'DSQA', search_hle: 'HLE com busca', search_widesearch: 'WideSearch',
};
const nomeAval = (t: string) => NOME_AVAL[t] ?? t.replace(/_/g, ' ');

/** Fronteira de eficiência: ninguém mais barato (ou igual) acerta mais. Ordena por custo e guarda quem bate o recorde de acurácia. */
function fronteiraDe(pts: Ev[]) {
  const ord = [...pts].sort((a, b) => (a.custo_tarefa as number) - (b.custo_tarefa as number) || (b.score as number) - (a.score as number));
  const f: Ev[] = []; let rec = -Infinity;
  for (const p of ord) if ((p.score as number) > rec) { f.push(p); rec = p.score as number; }
  return f;
}

function CustoTarefa({ M }: { M: Mercado }) {
  const { D } = useHistorico();
  const B = M.benchmarks;
  const comPagina = useMemo(() => new Set(D.matriz.modelos.map(m => m.s.split(':')[0])), [D]);
  const validos = (B?.evals ?? []).filter(e => e.score != null && e.custo_tarefa != null && e.custo_tarefa > 0);
  const porTipo = d3.group(validos, e => e.tipo);
  const tipos = [...porTipo.keys()].filter(t => porTipo.get(t)!.length >= MIN_AVAL).sort((a, b) => porTipo.get(b)!.length - porTipo.get(a)!.length);
  const pequenos = [...porTipo.keys()].filter(t => !tipos.includes(t));
  const [escolha, setTipo] = useState<string | null>(null);
  const tipo = escolha && tipos.includes(escolha) ? escolha : tipos[0];
  const sub = B ? `Avaliações da OpenRouter em ${fD(B.as_of)}. Foto do dia: não responde à janela nem aos filtros.` : 'Sem avaliações nesta publicação.';

  if (!B || !tipo) return <Cartao id="custo-tarefa" novo subtitulo={sub}><p className="vazio">Nenhuma avaliação com acurácia e custo por tarefa para pelo menos {MIN_AVAL} modelos nesta publicação.</p></Cartao>;

  const pts = porTipo.get(tipo)!;
  const fr = fronteiraDe(pts);
  const naFr = new Set(fr);
  const tarefas = pts.map(p => p.tarefas).filter((v): v is number => v != null);
  const link = (s: string) => (comPagina.has(s.split(':')[0]) ? urlModelo(s) : undefined);
  // prioridade de rótulo: pontas da fronteira primeiro, depois o meio
  const prio = new Map<Ev, number>();
  fr.forEach((p, i) => prio.set(p, i === 0 || i === fr.length - 1 ? i === 0 ? 0 : 1 : 2 + Math.abs(i - fr.length / 2)));
  const pontos: PontoD[] = pts.map((p, i) => ({
    key: p.slug + '#' + i, x: p.custo_tarefa as number, y: 100 * (p.score as number), r: naFr.has(p) ? 5 : 3.6,
    slot: naFr.has(p) ? '--ink' : '--s0', opacidade: naFr.has(p) ? 0.95 : 0.6, forte: naFr.has(p),
    href: link(p.slug), rotulo: naFr.has(p) ? p.nome : undefined, prioridade: prio.get(p), titulo: p.nome,
    linhas: [
      { rot: 'Laboratório', val: p.lab },
      { rot: 'Acurácia', val: fmtP(100 * (p.score as number)) },
      { rot: 'Custo médio por tarefa', val: fmtCusto(p.custo_tarefa) },
      { rot: 'Tarefas avaliadas', val: p.tarefas == null ? '—' : String(p.tarefas) },
      { rot: naFr.has(p) ? 'Na fronteira de eficiência' : 'Fora da fronteira', val: '' },
      ...(link(p.slug) ? [] : [{ rot: 'Sem página: sem volume no histórico', val: '' }]),
    ],
  }));
  const ys = pts.map(p => 100 * (p.score as number));
  const yLo = Math.max(0, (d3.min(ys) ?? 0) - 4), yHi = Math.min(100, (d3.max(ys) ?? 100) + 4);
  // leitura
  const barato = fr[0], topo = fr[fr.length - 1];
  const mult = barato && topo && barato !== topo ? (topo.custo_tarefa as number) / (barato.custo_tarefa as number) : null;
  const dominado = pts.filter(p => !naFr.has(p)).sort((a, b) => (b.custo_tarefa as number) - (a.custo_tarefa as number))[0];
  const quemDomina = dominado ? fr.find(f => (f.score as number) >= (dominado.score as number) && (f.custo_tarefa as number) <= (dominado.custo_tarefa as number)) : undefined;
  const NomeLink = ({ e }: { e: Ev }) => (link(e.slug) ? <a href={link(e.slug)} style={{ color: 'var(--ink)' }}>{e.nome}</a> : <>{e.nome}</>);

  return (
    <Cartao id="custo-tarefa" novo subtitulo={<>{sub} {pts.length} modelos com acurácia e custo em {nomeAval(tipo)}{tarefas.length ? `, de ${d3.min(tarefas)} a ${d3.max(tarefas)} tarefas por modelo` : ''}.</>}
      >
      {/* Seletor no corpo, não no cabeçalho: os nomes das avaliações são longos e espremeriam o título em tela estreita. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <Legenda itens={[{ key: 'f', label: 'Na fronteira de eficiência', slot: '--ink' }, { key: 'o', label: 'Fora da fronteira', slot: '--s0' }]} />
        {tipos.length > 1 && <Modos valor={tipo} onChange={setTipo} rotulo="Avaliação" opcoes={tipos.map(t => [t, nomeAval(t)] as [string, string])} />}
      </div>
      <Dispersao pontos={pontos} escalaX="log" fronteira={fr.map(p => ({ x: p.custo_tarefa as number, y: 100 * (p.score as number) }))}
        fmtX={fmtCustoEixo} fmtY={v => fmtInt(v) + '%'} dominioY={[yLo, yHi]} altura={380} maxRotulos={7}
        tituloX="custo médio por tarefa, US$, escala log →" tituloY="acurácia →"
        rotuloAria={`Dispersão de ${pts.length} modelos na avaliação ${nomeAval(tipo)}: acurácia contra custo médio por tarefa. ${fr.length} modelos na fronteira de eficiência, de ${barato?.nome} a ${topo?.nome}.`} />
      <div className="leitura">
        Na {nomeAval(tipo)}, <b>{fr.length}</b> dos {pts.length} modelos formam a fronteira: nenhum outro é ao mesmo tempo mais barato e mais preciso que eles.
        {barato && topo && barato !== topo && <> Ela vai de <NomeLink e={barato} /> ({fmtP(100 * (barato.score as number))}, {fmtCusto(barato.custo_tarefa)} por tarefa) a <NomeLink e={topo} /> ({fmtP(100 * (topo.score as number))}, {fmtCusto(topo.custo_tarefa)}){mult ? <>: {fmtNum(100 * ((topo.score as number) - (barato.score as number)), 1)} pontos de acurácia a mais custam <b>{mult >= 10 ? Math.round(mult) : br(mult.toFixed(1))} vezes</b> mais por tarefa</> : null}.</>}
        {dominado && quemDomina && <> O mais caro fora da fronteira é <NomeLink e={dominado} />, a {fmtCusto(dominado.custo_tarefa)} por tarefa com {fmtP(100 * (dominado.score as number))}; <NomeLink e={quemDomina} /> acerta {fmtP(100 * (quemDomina.score as number))} por {fmtCusto(quemDomina.custo_tarefa)}.</>}
      </div>
      <div className="tabwrap" style={{ marginTop: 10 }}>
        <table className="t">
          <caption className="sr">Modelos na fronteira de eficiência, do mais barato ao mais preciso</caption>
          <thead><tr><th>Na fronteira</th><th>Laboratório</th><th className="num">Acurácia</th><th className="num">Custo por tarefa</th><th className="num">Tarefas</th></tr></thead>
          <tbody>{fr.map(p => (
            <tr key={p.slug}>
              <td>{link(p.slug) ? <a href={link(p.slug)}>{p.nome}</a> : p.nome}</td><td>{p.lab}</td>
              <td className="num">{fmtP(100 * (p.score as number))}</td><td className="num">{fmtCusto(p.custo_tarefa)}</td><td className="num">{p.tarefas ?? '—'}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {pequenos.length > 0 && (
        <p className="nota">Fora do seletor por terem poucos modelos: {pequenos.map(t => `${nomeAval(t)} (${porTipo.get(t)!.length})`).join(', ')}.</p>
      )}
    </Cartao>
  );
}

export default function S08({ M }: { M: Mercado }) {
  return (
    <Secao id="s08" n="08" titulo="Qualidade contra adoção"
      sub="Capacidade medida por terceiros contra o que o tráfego escolhe. O primeiro cartão responde à janela e aos filtros; o segundo é foto do dia da avaliação.">
      <Qualidade />
      <div style={{ marginTop: 14 }}><CustoTarefa M={M} /></div>
    </Secao>
  );
}
