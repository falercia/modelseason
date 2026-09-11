'use client';
/**
 * Seção 12: comparar dois modelos. Porte do comparador() da v1, com três
 * mudanças: a série de share respeita janela, agrupamento e filtro (a v1 usava
 * sempre o histórico inteiro no gráfico), a linha "Para que usam" cruza com a
 * foto de tarefas, e o custo mediano por sessão entra quando os dois modelos
 * aparecem no mesmo harness e faixa de turnos.
 */
import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import * as d3 from 'd3';
import type { Mercado } from '@/lib/tipos';
import { seriesSemanais, rotuloLab, type DadosV1, type Estado, type ModeloMatriz, type Recorte } from '@/lib/engine';
import { useHistorico } from '@/components/shell/Historico';
import { Cartao, Secao } from '@/components/shell/Cartao';
import { Legenda, TabelaSerie, Temporal, cor } from '@/components/graficos/base';
import { br, curto, fD, fPer, fmtCtx, fmtNum, fmtP, fmtT, fmtUSD, fmtVez, urlModelo } from '@/lib/format';
import { Combobox, type OpcaoModelo } from './s12-combobox';
import s from './s12.module.css';

const SLOT_A = '--s1', SLOT_B = '--s2';

/** Nome de exibição: o catálogo traz "Laboratório: Nome"; sem nome, o slug encurtado. */
export const nomeModelo = (slug: string, n: string | null | undefined) => (n ? n.replace(/^[^:]+:\s*/, '') : curto(slug));
const pct = (v: number | null | undefined) => (v == null ? '—' : fmtP(v, v > 0 && v < 1 ? 2 : 1));

interface Cand extends OpcaoModelo {
  i: number; preco: number | null; pp: number | null; pc: number | null; ctx: number | null; aa: number | null;
  lanc: string | null; T: number; origem: string; pesos: string;
}

/**
 * O mesmo critério de filtro do motor (lib/engine.ts, passa()): sem filtro
 * entra tudo; com filtro, só modelo com metadado e que passa em todas as
 * dimensões. Replicado aqui porque o motor não expõe a série por modelo.
 */
function criterio(D: DadosV1, estado: Estado) {
  const MX = D.matriz, DIMI: Record<string, number> = {};
  MX.dims.forEach((d, i) => (DIMI[d] = i));
  const FIL = Object.entries(estado.filtros).filter(([, v]) => v?.length).map(([d, v]) => [DIMI[d], new Set(v)] as const);
  return (m: ModeloMatriz) => !FIL.length || (m.m && FIL.every(([k, set]) => set.has(m.d[k])));
}

/** Semana de cada coluna da matriz mapeada no período do eixo recortado (ou -1 fora da janela). */
function baldes(D: DadosV1, R: Recorte) {
  const pos = new Map(R.eixo.map((e, i) => [e, i]));
  return D.matriz.semanas.map(w => pos.get(R.estado.gran === 'mes' ? w.slice(0, 7) + '-01' : w) ?? -1);
}

/** Pico e semanas no top 10 sobre o histórico inteiro, mesma regra do pipeline (a linha other fora do ranking, dentro do denominador). */
function vidaCompleta(D: DadosV1, SS: number[][]) {
  const MX = D.matriz, NW = MX.semanas.length;
  const tot = new Array(NW).fill(0);
  SS.forEach(sr => sr.forEach((v, w) => (tot[w] += v)));
  const top10 = new Array(MX.modelos.length).fill(0);
  for (let w = 0; w < NW; w++) {
    SS.map((sr, i) => [sr[w], i]).filter(([v, i]) => v > 0 && MX.modelos[i].s !== 'other')
      .sort((a, b) => b[0] - a[0]).slice(0, 10).forEach(([, i]) => top10[i]++);
  }
  return MX.modelos.map((_, i) => {
    let pico = 0, sem = '';
    SS[i].forEach((v, w) => { const sh = tot[w] ? (100 * v) / tot[w] : 0; if (sh > pico) { pico = sh; sem = MX.semanas[w]; } });
    return { pico: +pico.toFixed(2), semana: sem, top10: top10[i] };
  });
}

type Melhor = 'maior' | 'menor' | null;
interface Celula { t: ReactNode; txt: string; n: number | null; sub?: ReactNode }

function Linha({ rot, nota, a, b, melhor }: { rot: string; nota?: string; a: Celula; b: Celula; melhor: Melhor }) {
  // Só destaca quando a diferença aparece no próprio texto: marcar 1048576 como
  // melhor que 1050000, os dois exibidos como "1M", seria ruído. E sem dado de
  // um dos lados não há comparação, então não há destaque.
  let ma = false, mb = false;
  if (melhor && a.n != null && b.n != null && a.txt !== b.txt) {
    ma = melhor === 'maior' ? a.n > b.n : a.n < b.n;
    mb = melhor === 'maior' ? b.n > a.n : b.n < a.n;
  }
  const cel = (c: Celula, w: boolean) => (
    <td>
      <b className={w ? s.win : undefined}>{c.t}{w && <span className="sr"> (melhor)</span>}</b>
      {c.sub && <small className={s.sub}>{c.sub}</small>}
    </td>
  );
  return <tr><td>{rot}{nota && <small>{nota}</small>}</td>{cel(a, ma)}{cel(b, mb)}</tr>;
}

export default function S12({ M }: { M: Mercado }) {
  const { D, R, estado } = useHistorico();
  const SS = useMemo(() => seriesSemanais(D), [D]);
  const vida = useMemo(() => vidaCompleta(D, SS), [D, SS]);
  const idx = useMemo(() => new Map(D.matriz.modelos.map((m, i) => [m.s, i])), [D]);
  const [escolha, setEscolha] = useState<[string | null, string | null]>([null, null]);

  // Candidatos: quem tem volume no último período (R.qualidade, na ordem de share)
  // e, depois, quem passa no filtro e teve volume em algum ponto da janela.
  const { cand, passa, balde } = useMemo(() => {
    const MX = D.matriz, DIMI: Record<string, number> = {};
    MX.dims.forEach((d, i) => (DIMI[d] = i));
    const passa = criterio(D, estado), balde = baldes(D, R);
    const mk = (m: ModeloMatriz, i: number, share: number, T: number): Cand => ({
      i, slug: m.s, nome: nomeModelo(m.s, m.n), lab: rotuloLab(MX.dic.vendor[m.d[DIMI.vendor]]), share, T, ativo: T > 0,
      preco: m.p, pp: m.pp, pc: m.pc, ctx: m.c, aa: m.q, lanc: m.l,
      origem: MX.dic.origin[m.d[DIMI.origin]], pesos: MX.dic.pesos[m.d[DIMI.pesos]],
    });
    const vistos = new Set<string>();
    const cand: Cand[] = [];
    for (const q of R.qualidade) {
      const i = idx.get(q.slug); if (i == null) continue;
      cand.push(mk(MX.modelos[i], i, q.share, q.T)); vistos.add(q.slug);
    }
    MX.modelos.forEach((m, i) => {
      if (vistos.has(m.s) || m.s === 'other' || !passa(m)) return;
      if (SS[i].some((v, w) => v > 0 && balde[w] >= 0)) cand.push(mk(m, i, 0, 0));
    });
    return { cand, passa, balde };
  }, [D, R, estado, SS, idx]);

  const porSlug = useMemo(() => new Map(cand.map(c => [c.slug, c])), [cand]);

  // Denominador de cada período: o total do recorte, somado com o mesmo critério do motor.
  const totBalde = useMemo(() => {
    const t = new Array(R.N).fill(0);
    D.matriz.modelos.forEach((m, i) => { if (!passa(m)) return; SS[i].forEach((v, w) => { if (balde[w] >= 0) t[balde[w]] += v; }); });
    return t;
  }, [D, SS, passa, balde, R.N]);

  if (cand.length < 2) {
    return (
      <Secao id="s12" n="12" titulo="Comparar dois modelos">
        <Cartao id="comparar"><p className="vazio">Menos de dois modelos com volume no recorte atual. Afrouxe o filtro ou aumente a janela para comparar.</p></Cartao>
      </Secao>
    );
  }

  const A = (escolha[0] && porSlug.get(escolha[0])) || cand[0];
  let B = (escolha[1] && porSlug.get(escolha[1])) || cand[1];
  if (B.slug === A.slug) B = cand.find(c => c.slug !== A.slug)!;

  // Série de share por período, dentro da janela e do filtro. Semana sem volume
  // registrado fica vazia, não zero: fora do top 50 diário o volume é desconhecido.
  const serie = (c: Cand) => {
    const num = new Array(R.N).fill(0);
    SS[c.i].forEach((v, w) => { if (balde[w] >= 0) num[balde[w]] += v; });
    return num.map((v, k) => (v > 0 && totBalde[k] ? +((100 * v) / totBalde[k]).toFixed(3) : null));
  };
  const shA = serie(A), shB = serie(B);
  const vA = D.life.find(l => l.model === A.slug), vB = D.life.find(l => l.model === B.slug);
  const hA = vA ? { pico: vA.peak_share, semana: vA.peak_week, top10: vA.weeks_in_top10 } : vida[A.i];
  const hB = vB ? { pico: vB.peak_share, semana: vB.peak_week, top10: vB.weeks_in_top10 } : vida[B.i];

  // Para que usam: as três tarefas em que o modelo põe mais volume (peso da
  // tarefa vezes a fatia dele nela). Variante de endpoint conta no modelo base.
  const T = M.tarefas;
  const tarefas = (c: Cand) => {
    if (!T) return null;
    const base = c.slug.split(':')[0];
    return T.classificacoes.flatMap(cl => cl.modelos.filter(m => m.slug.split(':')[0] === base)
      .map(m => ({ tag: cl.tag, nome: cl.nome, na: m.token_share, peso: cl.token_share * m.token_share })))
      .sort((x, y) => y.peso - x.peso).slice(0, 3);
  };
  const usoCel = (c: Cand): Celula => {
    const l = tarefas(c);
    if (l == null) return { t: '—', txt: '—', n: null };
    return {
      txt: '', n: null,
      t: l.length ? (
        <ul className={s.tarefas}>{l.map(x => <li key={x.tag}>{x.nome}<span>{br(x.na.toFixed(1))}%</span></li>)}</ul>
      ) : <span className={s.fora}>fora do top de tarefas</span>,
    };
  };

  // Custo mediano por sessão: só compara no mesmo harness e na mesma faixa de turnos.
  const sessao = (() => {
    const SE = M.sessoes; if (!SE) return null;
    const ba = A.slug.split(':')[0], bb = B.slug.split(':')[0];
    for (const r of SE.resumo) {
      const h = SE.harness.find(x => x.nome === r.harness); if (!h) continue;
      const ca = h.celulas.find(c => c.turnos === r.turnos && c.slug.split(':')[0] === ba);
      const cb = h.celulas.find(c => c.turnos === r.turnos && c.slug.split(':')[0] === bb);
      if (ca && cb) return { rot: `${r.harness}, ${r.turnos_nome}`, ca: ca.custo, cb: cb.custo };
    }
    return null;
  })();

  const ult = R.eixo[R.N - 1];
  const per = fPer(ult, estado.gran);
  const c = (t: string, n: number | null, sub?: ReactNode): Celula => ({ t, txt: t, n, sub });
  const precoSub = (x: Cand) => (x.pp != null && x.pc != null ? `entrada ${fmtUSD(x.pp)} · saída ${fmtUSD(x.pc)}` : undefined);
  const aaTxt = (v: number | null) => (v == null ? '—' : fmtNum(v, 1));

  // Leitura montada do dado.
  const frases: ReactNode[] = [];
  if (A.share > 0 && B.share > 0) {
    const [maior, menor] = A.share >= B.share ? [A, B] : [B, A];
    const r = fmtVez(maior.share / menor.share);
    if (r && r !== '1,0') frases.push(<span key="sh"><b>{maior.nome}</b> teve {r} vezes o share de {menor.nome} em {per}. </span>);
    else frases.push(<span key="sh">Os dois tiveram share praticamente igual em {per}. </span>);
  } else if (A.share > 0 || B.share > 0) {
    const [com, sem] = A.share > 0 ? [A, B] : [B, A];
    frases.push(<span key="sh"><b>{sem.nome}</b> não teve volume registrado em {per}; {com.nome} teve {pct(com.share)}. </span>);
  }
  if (A.preco && B.preco && A.preco !== B.preco) {
    const [caro, barato] = A.preco > B.preco ? [A, B] : [B, A];
    const r = fmtVez(caro.preco! / barato.preco!);
    if (r) frases.push(<span key="pr">Por 1M tokens na mistura declarada, {caro.nome} custa {r} vezes {barato.nome}. </span>);
  }
  if (hA.top10 !== hB.top10) {
    const [mais, menos] = hA.top10 > hB.top10 ? [[A, hA], [B, hB]] as const : [[B, hB], [A, hA]] as const;
    frases.push(<span key="t10">No histórico inteiro, {mais[0].nome} passou {mais[1].top10} {mais[1].top10 === 1 ? 'semana' : 'semanas'} no top 10, contra {menos[1].top10} de {menos[0].nome}.</span>);
  }

  const eixoMax = d3.max([...shA, ...shB].filter((v): v is number => v != null)) ?? 1;
  // O gráfico começa um período antes da primeira aparição de qualquer dos dois:
  // numa janela longa, dois modelos recentes ocupariam só a borda direita.
  const prim = [shA, shB].map(sr => sr.findIndex(v => v != null)).filter(k => k >= 0);
  const ini = prim.length ? Math.max(0, Math.min(Math.min(...prim) - 1, R.N - 2)) : 0;
  const eixoG = R.eixo.slice(ini), gA = shA.slice(ini), gB = shB.slice(ini);
  const cabeca = (x: Cand, slot: string) => (
    <th scope="col">
      <i style={{ background: cor(slot) }} aria-hidden="true" />
      <Link href={urlModelo(x.slug)}>{x.nome}</Link>
      <small>{x.lab}</small>
    </th>
  );

  return (
    <Secao id="s12" n="12" titulo="Comparar dois modelos"
      sub={<>Dois modelos lado a lado. Adoção e trajetória respondem à janela e ao filtro; pico e semanas no top 10 são do histórico inteiro, e as tarefas vêm da foto mais recente da fonte.</>}>
      <Cartao id="comparar">
        <div className={s.sel}>
          <Combobox rotulo="Modelo A" slot={SLOT_A} valor={A} opcoes={cand.filter(x => x.slug !== B.slug)} onEscolher={v => setEscolha([v, B.slug])} />
          <Combobox rotulo="Modelo B" slot={SLOT_B} valor={B} opcoes={cand.filter(x => x.slug !== A.slug)} onEscolher={v => setEscolha([A.slug, v])} />
        </div>
        <div className={s.corpo}>
          <div className="tabwrap">
            <table className={'t ' + s.tab}>
              <caption className="sr">Comparação entre {A.nome} e {B.nome}. O melhor valor de cada linha está marcado.</caption>
              <thead><tr><th scope="col"><span className="sr">Indicador</span></th>{cabeca(A, SLOT_A)}{cabeca(B, SLOT_B)}</tr></thead>
              <tbody>
                <Linha rot="Share" nota={per} a={c(pct(A.ativo ? A.share : null), A.ativo ? A.share : null)} b={c(pct(B.ativo ? B.share : null), B.ativo ? B.share : null)} melhor="maior" />
                <Linha rot={estado.gran === 'mes' ? 'Tokens por semana' : 'Tokens na semana'} nota={estado.gran === 'mes' ? `média de ${per}` : per}
                  a={c(A.ativo ? fmtT(A.T) : '—', A.ativo ? A.T : null)} b={c(B.ativo ? fmtT(B.T) : '—', B.ativo ? B.T : null)} melhor="maior" />
                <Linha rot="Preço por 1M" nota="mistura declarada" a={c(fmtUSD(A.preco), A.preco, precoSub(A))} b={c(fmtUSD(B.preco), B.preco, precoSub(B))} melhor="menor" />
                <Linha rot="Janela de contexto" a={c(fmtCtx(A.ctx), A.ctx || null)} b={c(fmtCtx(B.ctx), B.ctx || null)} melhor="maior" />
                <Linha rot="Índice de Inteligência" a={c(aaTxt(A.aa), A.aa)} b={c(aaTxt(B.aa), B.aa)} melhor="maior" />
                <Linha rot="Lançamento" a={c(A.lanc ? fD(A.lanc) : '—', null)} b={c(B.lanc ? fD(B.lanc) : '—', null)} melhor={null} />
                <Linha rot="Semanas no top 10" nota="histórico inteiro" a={c(String(hA.top10), hA.top10)} b={c(String(hB.top10), hB.top10)} melhor="maior" />
                <Linha rot="Pico de share" nota="histórico inteiro"
                  a={c(pct(hA.pico || null), hA.pico || null, hA.semana ? `semana de ${fD(hA.semana)}` : undefined)}
                  b={c(pct(hB.pico || null), hB.pico || null, hB.semana ? `semana de ${fD(hB.semana)}` : undefined)} melhor="maior" />
                {sessao && <Linha rot="Custo mediano por sessão" nota={sessao.rot} a={c(fmtUSD(sessao.ca), sessao.ca)} b={c(fmtUSD(sessao.cb), sessao.cb)} melhor="menor" />}
                <Linha rot="Para que usam" nota={T ? `foto de ${fD(T.as_of)}, ${T.janela_dias} dias; % é a fatia do modelo na tarefa` : undefined} a={usoCel(A)} b={usoCel(B)} melhor={null} />
                <Linha rot="Origem e pesos" a={c(`${A.origem} · ${A.pesos}`, null)} b={c(`${B.origem} · ${B.pesos}`, null)} melhor={null} />
              </tbody>
            </table>
          </div>
          <div>
            <Legenda itens={[{ key: 'a', label: A.nome, slot: SLOT_A }, { key: 'b', label: B.nome, slot: SLOT_B }]} />
            {eixoG.length >= 2 ? (
              <Temporal eixo={eixoG} gran={estado.gran} altura={280} ymax={eixoMax * 1.12 || 1}
                series={[{ key: 'a', label: A.nome, values: gA, slot: SLOT_A }, { key: 'b', label: B.nome, values: gB, slot: SLOT_B }]}
                fmt={v => pct(v)} fmtEixo={v => fmtNum(v, 2) + '%'}
                rotuloAria={`Share ${estado.gran === 'mes' ? 'mensal' : 'semanal'} de ${A.nome} e ${B.nome}, de ${fPer(eixoG[0], estado.gran)} a ${per}. Pico na janela: ${pct(d3.max(shA.filter((v): v is number => v != null)))} e ${pct(d3.max(shB.filter((v): v is number => v != null)))}.`} />
            ) : <p className="vazio">A janela tem um período só; a trajetória precisa de pelo menos dois.</p>}
            <p className="nota">Share {estado.gran === 'mes' ? 'mensal' : 'semanal'} dentro do recorte{ini > 0 ? `, a partir de ${fPer(eixoG[0], estado.gran)}, um período antes da primeira aparição de um dos dois` : ''}. Período sem volume registrado fica em branco, não em zero: fora do top 50 diário da fonte o volume do modelo é desconhecido.</p>
            <TabelaSerie eixo={eixoG} gran={estado.gran} series={[{ label: A.nome, values: gA }, { label: B.nome, values: gB }]} fmt={v => pct(v)} />
          </div>
        </div>
        {frases.length > 0 && <p className="leitura">{frases}</p>}
      </Cartao>
    </Secao>
  );
}
