'use client';
/**
 * Seção 03: share por laboratório. Porte do stackedShare('vendor') e do board()
 * da v1. A área dobra em quatro laboratórios nomeados, com cor fixa por
 * entidade, e Outros em cinza: a paleta validada tem quatro cores, não cinco.
 */
import { useMemo } from 'react';
import type { Mercado } from '@/lib/tipos';
import { rotuloLab, type Recorte, type Series } from '@/lib/engine';
import { Cartao, Secao } from '@/components/shell/Cartao';
import { useHistorico } from '@/components/shell/Historico';
import { cor, Legenda, Temporal, TabelaSerie, useLargura, useOcultos, type ItemSerie, type LinhaTip } from '@/components/graficos/base';
import { fmtP, fmtPP, fmtT, fPer } from '@/lib/format';
import { LAB_SLOT, ORIGEM_SLOT } from '@/lib/cores';
import { indiceBase, indiceFim, Leitura, LinkModelo, P, per, qtdPer, quando, tipSemanas, useNomes } from './s02-comum';

/** Os quatro laboratórios com cor própria, na ordem de empilhamento (de baixo para cima). */
const VENDOR_HUES = Object.keys(LAB_SLOT).filter(k => k !== 'Outros');
const NOMES_HUES = VENDOR_HUES.map(k => rotuloLab(k).replace(/ \(.*\)$/, '')).join(', ').replace(/, ([^,]*)$/, ' e $1');

/** Dobra as séries além das quatro fixas em "Outros", somando os valores (dobrar() da v1). */
function dobrar(series: Series, manter: string[]): Series {
  const out: Series = {};
  manter.forEach(k => { if (series[k]) out[k] = series[k].slice(); });
  const n = (Object.values(series)[0] || []).length;
  const outros = new Array(n).fill(0); let houve = false;
  Object.keys(series).forEach(k => {
    if (manter.includes(k)) return; houve = true;
    series[k].forEach((v, i) => (outros[i] += v || 0));
  });
  if (houve) out['Outros'] = outros.map(v => Math.round(v * 100) / 100);
  return out;
}

/** Share de TODOS os laboratórios, não só dos oito do motor: quem desabou para fora do top 8 também conta. */
function shareTodos(R: Recorte): Series {
  const tot = R.weekly_total_T, out: Series = {};
  for (const k in R.vendor_abs) {
    if (k === 'Outros') continue;
    out[k] = R.vendor_share[k] ?? R.vendor_abs[k].map((v, i) => (tot[i] ? (100 * v) / tot[i] : 0));
  }
  return out;
}

/** Tudo o que cai em Outros no gráfico: laboratórios fora dos quatro com cor e a linha agregada da fonte. */
function dentroDeOutros(R: Recorte) {
  const sh = shareTodos(R), tot = R.weekly_total_T;
  const lista = Object.keys(sh).filter(k => !VENDOR_HUES.includes(k)).map(k => ({ k, rot: rotuloLab(k), v: sh[k] }));
  if (R.vendor_abs['Outros']) lista.push({ k: 'Outros', rot: 'linha agregada da fonte', v: R.vendor_abs['Outros'].map((v, i) => (tot[i] ? (100 * v) / tot[i] : 0)) });
  return lista;
}

function LeituraVendor({ R, b }: { R: Recorte; b: number }) {
  const u = indiceFim(R.weekly_total_T), tot = R.weekly_total_T;
  const sh = shareTodos(R);
  const labs = Object.keys(sh);
  if (!labs.length) return <Leitura R={R}><p>Nenhum laboratório nomeado no recorte atual.</p></Leitura>;
  const lider = (i: number) => labs.reduce((m, k) => (sh[k][i] > sh[m][i] ? k : m), labs[0]);
  const ord = labs.slice().sort((x, y) => sh[y][u] - sh[x][u]);
  const l0 = lider(b);
  // Rodízio da liderança dentro da janela: quantas trocas, e há quanto tempo o líder atual está lá.
  const seq: string[] = []; for (let i = b; i <= u; i++) if (tot[i] > 0) seq.push(lider(i));
  let trocas = 0, maiorRun = 0, runLab = seq[0], run = 0;
  const distintos = new Set(seq);
  seq.forEach((k, j) => {
    if (j && k !== seq[j - 1]) { trocas++; run = 0; }
    run++; if (run > maiorRun) { maiorRun = run; runLab = k; }
  });
  let atual = 0; for (let j = seq.length - 1; j >= 0 && seq[j] === ord[0]; j--) atual++;
  const delta = labs.map(k => ({ k, d: sh[k][u] - sh[k][b] })).sort((x, y) => y.d - x.d);
  const ganhou = delta[0]?.d > 0.05 ? delta[0] : null;
  const perdeu = delta.at(-1)!.d < -0.05 ? delta.at(-1)! : null;
  const novos = ord.filter(k => sh[k][b] < 0.5 && sh[k][u] >= 1);
  const somaNovos = novos.reduce((s, k) => s + sh[k][u], 0);
  const L = rotuloLab, mes = R.estado.gran === 'mes';
  const dentroU = dentroDeOutros(R).map(d => ({ k: d.k, rot: d.rot, v: d.v[u] ?? 0 })).filter(d => d.v >= 0.5).sort((x, y) => y.v - x.v).slice(0, 3);
  const somaOutros = dobrar(R.vendor_share, VENDOR_HUES)['Outros']?.[u] ?? 0;
  return (
    <Leitura R={R}>
      <p>
        {b < u && <>No início da janela ({quando(R, b)}), o maior era <b>{L(l0)}</b>, com {fmtP(sh[l0][b])}. </>}
        No fim ({quando(R, u)}), o líder é <b>{L(ord[0])} ({fmtP(sh[ord[0]][u])})</b>
        {ord[1] && sh[ord[1]][u] > 0 && <>, seguido de {L(ord[1])} ({fmtP(sh[ord[1]][u])})</>}
        {ord[2] && sh[ord[2]][u] > 0 && <> e {L(ord[2])} ({fmtP(sh[ord[2]][u])})</>}.
      </p>
      {(ganhou || perdeu) && b < u && (
        <P>
          {ganhou && <>Quem mais ganhou espaço foi <b>{L(ganhou.k)}</b>, {fmtPP(ganhou.d)} (de {fmtP(sh[ganhou.k][b])} para {fmtP(sh[ganhou.k][u])}). </>}
          {perdeu && <>Quem mais perdeu foi <b>{L(perdeu.k)}</b>, {fmtPP(perdeu.d)} (de {fmtP(sh[perdeu.k][b])} para {fmtP(sh[perdeu.k][u])}).</>}
        </P>
      )}
      {novos.length > 0 && b < u && (
        <P>{novos.length === 1 ? 'Laboratório que não tinha' : 'Laboratórios que não tinham'} share relevante no início da janela: {novos.slice(0, 5).map(L).join(', ')}. Hoje {novos.length === 1 ? 'soma' : 'somam'} <b>{fmtP(somaNovos)}</b>.</P>
      )}
      {dentroU.length > 0 && (
        <P>Outros soma <b>{fmtP(somaOutros)}</b> no último período. Os maiores lá dentro: {dentroU.map((d, j) => <span key={d.k}>{j ? (j === dentroU.length - 1 ? ' e ' : ', ') : ''}{d.rot} ({fmtP(d.v)})</span>)}. Passe o mouse no gráfico para ver quem estava em Outros em cada período.</P>
      )}
      {seq.length > 1 && (
        <P>
          {trocas === 0
            ? <><b>{L(ord[0])}</b> liderou {mes ? 'todos os' : 'todas as'} {qtdPer(R, seq.length)} da janela.</>
            : <>Na janela, a liderança trocou de mãos <b>{trocas} {trocas === 1 ? 'vez' : 'vezes'}</b> entre {distintos.size} laboratórios. {L(ord[0])} está no topo há {qtdPer(R, atual)}{atual > 1 ? (mes ? ' seguidos' : ' seguidas') : ''}{runLab !== ord[0] || maiorRun > atual ? <>; a sequência mais longa foi de {L(runLab)}, com {qtdPer(R, maiorRun)}</> : null}.</>}
        </P>
      )}
    </Leitura>
  );
}

function Vendor({ R }: { R: Recorte }) {
  const { ocultos, alternar } = useOcultos();
  const u = R.N - 1, tot = R.weekly_total_T, gran = R.estado.gran;
  const b = indiceBase(tot);
  const dob = dobrar(R.vendor_share, VENDOR_HUES);
  // Período sem volume nenhum (filtro que ainda não existia) fica vazio, não vira 100% de Outros.
  const mascara = (v: number[]) => v.map((x, i) => (tot[i] > 0 ? x : null));
  const todas: ItemSerie[] = Object.keys(dob).map(k => ({ key: k, label: rotuloLab(k), values: mascara(dob[k]), slot: LAB_SLOT[k] ?? '--s0' }));
  const vis = todas.filter(s => !ocultos.has(s.key));
  const series = vis.length ? vis : todas;
  const legenda = todas.slice().sort((x, y) => (dob[y.key][u] ?? 0) - (dob[x.key][u] ?? 0))
    .map(s => ({ key: s.key, label: `${s.label} ${fmtP(dob[s.key][u])}`, slot: s.slot }));
  // Outros esconde laboratórios grandes (e a linha agregada da fonte): o tooltip abre os três maiores lá dentro.
  const dentro = dentroDeOutros(R);
  const tip = (i: number): LinhaTip[] => {
    const top = dentro.map(d => ({ ...d, v: d.v[i] ?? 0 })).filter(d => d.v >= 0.1 && tot[i] > 0).sort((x, y) => y.v - x.v).slice(0, 3);
    return [...(top.length && !ocultos.has('Outros') ? [{ rot: 'dentro de Outros', val: '' }, ...top.map(d => ({ rot: '↳ ' + d.rot, val: fmtP(d.v) }))] : []), ...tipSemanas(R)(i)];
  };
  return (
    <Cartao id="vendor" titulo={`Fatia ${per(R).adj} de tokens por laboratório`}
      subtitulo={`${NOMES_HUES} com cor fixa, a mesma em toda a página; os demais somados em Outros, que o tooltip abre`}>
      {b < 0 ? <p className="vazio">Nenhum volume no recorte atual.</p> : (
        <>
          <Legenda itens={legenda} ocultos={ocultos} alternar={alternar} />
          <Temporal eixo={R.eixo} gran={gran} modo="empilhada" series={series} fmt={v => fmtP(v)} fmtEixo={v => v + '%'} ymax={100} altura={280}
            tipExtra={tip}
            rotuloAria={`Área empilhada do share de tokens por laboratório, de ${fPer(R.eixo[0], gran)} a ${fPer(R.eixo[u], gran)}. No último período: ${legenda.map(l => l.label).join(', ')}.`} />
          <TabelaSerie eixo={R.eixo} gran={gran} fmt={v => fmtP(v)} series={todas.map(s => ({ label: s.label, values: s.values }))} />
          <LeituraVendor R={R} b={b} />
        </>
      )}
    </Cartao>
  );
}

function Board({ R }: { R: Recorte }) {
  const { D } = useHistorico();
  const nome = useNomes(D);
  const estreia = useMemo(() => {
    const MX = D.matriz, m = new Map<string, string>();
    MX.modelos.forEach((md, i) => { const j = MX.v[i].findIndex(v => v > 0); if (j >= 0) m.set(md.s, MX.semanas[MX.t0[i] + j]); });
    return m;
  }, [D]);
  // Abaixo de ~600px a barra desce para baixo do nome e os tokens vão para baixo do share:
  // a tabela cabe na tela sem rolagem lateral.
  const [ref, w] = useLargura<HTMLDivElement>(900);
  const compacto = w < 600;
  const linhas = R.boards.last, antes = R.boards.prev12;
  const u = R.N - 1, gran = R.estado.gran, dist = R.dist_prev;
  const pedido = gran === 'semana' ? 12 : 3;
  const rotDist = gran === 'semana' ? `Há ${dist} sem` : `Há ${dist} ${dist === 1 ? 'mês' : 'meses'}`;
  const periodo = gran === 'semana' ? `Semana de ${fPer(R.eixo[u], gran)}` : `Mês de ${fPer(R.eixo[u], gran)} (${R.semanasPorBucket[u]} ${R.semanasPorBucket[u] === 1 ? 'semana' : 'semanas'}, média semanal)`;
  if (!linhas.length) {
    return <Cartao id="board" subtitulo={periodo}><p className="vazio">Nenhum modelo nomeado com volume no último período do recorte.</p></Cartao>;
  }
  const max = linhas[0].share || 1;
  const pos = (m: string) => { const i = antes.findIndex(r => r.model === m); return i < 0 ? null : i + 1; };
  // Estreia de cada modelo no histórico (propriedade do modelo, não do recorte): separa
  // "estava lá, mas abaixo do 15º" de "nem existia ainda" na coluna de comparação.
  const kAntes = u - dist;
  const estreouDepois = (slug: string) => {
    const f = estreia.get(slug); if (!f) return false;
    return gran === 'semana' ? f > R.eixo[kAntes] : f.slice(0, 7) > R.eixo[kAntes].slice(0, 7);
  };
  const t10 = linhas.slice(0, 10);
  const cn = t10.filter(r => r.origin === 'China').length, ow = t10.filter(r => r.weights === 'Open-weights').length;
  const usProp = t10.filter(r => r.origin === 'EUA/Canadá' && r.weights === 'Proprietário').length;
  const iAn = linhas.findIndex(r => r.vendor === 'anthropic');
  const anMods = Object.entries(R.lab_modelos.anthropic ?? {}).map(([s, v]) => ({ s, T: v[u] ?? 0 })).sort((x, y) => y.T - x.T);
  const anTop = anMods[0]?.T > 0 ? anMods[0] : null;
  const novosTop = dist > 0 ? linhas.filter(r => pos(r.model) == null).length : 0;
  const naoExistiam = dist > 0 ? linhas.filter(r => pos(r.model) == null && estreouDepois(r.model)).length : 0;
  const plural = (n: number, um: string, v: string) => (n === 1 ? um : v);
  return (
    <Cartao id="board" titulo={gran === 'semana' ? 'Top 15 da última semana completa' : 'Top 15 do último mês'}
      subtitulo={`${periodo}. Share entre os modelos nomeados; cor da barra = origem do laboratório`}>
      <div className="tabwrap" ref={ref}>
        <table className="t">
          <caption className="sr">Os 15 modelos de maior volume no último período, com origem, licença, share, tokens e posição {rotDist.toLowerCase()}</caption>
          <thead><tr>
            <th className="num" style={{ width: 22 }}>#</th><th>Modelo</th>
            {!compacto && <th style={{ width: '20%' }}><span className="sr">Barra de share</span></th>}
            <th className="num">Share</th>{!compacto && <th className="num">Tokens/sem</th>}{dist > 0 && <th className="num">{rotDist}</th>}
          </tr></thead>
          <tbody>{linhas.map((r, i) => {
            const pp = pos(r.model), d = pp == null ? null : pp - (i + 1);
            const barra = (
              <span style={{ display: 'block', background: 'var(--grid)', borderRadius: 2, height: compacto ? 3 : 8, marginTop: compacto ? 5 : 0 }}>
                <i style={{ display: 'block', height: '100%', borderRadius: 2, width: `${((100 * r.share) / max).toFixed(1)}%`, background: cor(ORIGEM_SLOT[r.origin] ?? '--s0') }} />
              </span>
            );
            return (
              <tr key={r.model}>
                <td className="num" style={{ color: 'var(--ink-3)', verticalAlign: compacto ? 'top' : 'middle' }}>{i + 1}</td>
                <td style={{ minWidth: 0, whiteSpace: compacto ? 'normal' : undefined }}>
                  <LinkModelo slug={r.model} nome={nome(r.model)} />
                  <span style={{ display: compacto ? 'flex' : 'inline-flex', flexWrap: 'wrap', gap: 0, marginLeft: compacto ? -6 : 0 }}>
                    <span className="pill">{r.origin}</span><span className="pill">{r.weights}</span>
                  </span>
                  {compacto && barra}
                </td>
                {!compacto && <td>{barra}</td>}
                <td className="num" style={{ color: 'var(--ink)', verticalAlign: compacto ? 'top' : 'middle' }}>
                  {fmtP(r.share)}
                  {compacto && <span style={{ display: 'block', fontSize: 10.5, color: 'var(--ink-3)' }}>{fmtT(r.T)}</span>}
                </td>
                {!compacto && <td className="num">{fmtT(r.T)}</td>}
                {dist > 0 && (
                  <td className="num" style={{ color: 'var(--ink-3)', verticalAlign: compacto ? 'top' : 'middle' }}>
                    {pp == null
                      ? <span style={{ fontFamily: 'var(--font-sans), system-ui, sans-serif', fontSize: 11.5, whiteSpace: compacto ? 'normal' : 'nowrap' }}>{estreouDepois(r.model) ? 'estreou depois' : 'fora do top 15'}</span>
                      : <>#{pp}{d ? <span className="delta" style={{ color: 'var(--ink-2)' }} aria-label={d > 0 ? `subiu ${d}` : `caiu ${-d}`}>{d > 0 ? '↑' : '↓'}{Math.abs(d)}</span> : null}</>}
                  </td>
                )}
              </tr>
            );
          })}</tbody>
        </table>
      </div>
      <div className="legenda" style={{ marginTop: 8 }} aria-label="Cor da barra: origem do laboratório">
        {['EUA/Canadá', 'China', 'Europa', 'Coreia', 'Outros'].filter(o => linhas.some(r => (o === 'Outros' ? (ORIGEM_SLOT[r.origin] ?? '--s0') === '--s0' : r.origin === o)))
          .map(o => <span key={o} className="item"><i style={{ background: cor(ORIGEM_SLOT[o]) }} />{o === 'Outros' ? 'Outras origens' : o}</span>)}
      </div>
      {dist > 0 && dist < pedido && (
        <p className="nota">A janela é mais curta que {gran === 'semana' ? '12 semanas' : '3 meses'}, então a última coluna compara com o início dela, {qtdPer(R, dist)} antes, e não com {gran === 'semana' ? '12 semanas' : '3 meses'} atrás.</p>
      )}
      <Leitura R={R}>
        <p>
          Dos {t10.length} mais usados {gran === 'semana' ? 'na última semana' : 'no último mês'}, <b>{cn}</b> {plural(cn, 'é de laboratório chinês', 'são de laboratórios chineses')} e <b>{ow}</b> {plural(ow, 'é', 'são')} de pesos abertos. Proprietários americanos: <b>{usProp}</b>.
        </p>
        {dist > 0 && (
          <P><b>{novosTop}</b> dos {linhas.length} não {plural(novosTop, 'estava', 'estavam')} no top 15 {gran === 'semana' ? 'da ' : 'de '}{quando(R, u - dist)}, {qtdPer(R, dist)} antes{naoExistiam > 0 && <>, e {naoExistiam === novosTop ? (novosTop === 1 ? 'ele nem existia' : 'nenhum deles existia') : <>{naoExistiam} {plural(naoExistiam, 'deles nem existia', 'deles nem existiam')}</>} ainda</>}. A temporada de cada modelo no topo é curta.</P>
        )}
        <P>
          {iAn >= 0
            ? <>O modelo Anthropic mais usado (<LinkModelo slug={linhas[iAn].model} nome={nome(linhas[iAn].model)} />) está em #{iAn + 1}.</>
            : anTop ? <>Nenhum modelo Anthropic aparece neste top; o mais usado dela é <LinkModelo slug={anTop.s} nome={nome(anTop.s)} />, com {fmtT(anTop.T)} por semana.</>
              : <>Nenhum modelo Anthropic aparece neste recorte.</>}
          {' '}A métrica aqui é tokens, não receita nem qualidade: modelos de fronteira aparecem com share menor e uso de maior valor.
        </P>
      </Leitura>
    </Cartao>
  );
}

export default function S03(_: { M: Mercado }) {
  const { R } = useHistorico();
  return (
    <Secao id="s03" n="03" titulo="Share por laboratório"
      sub="Quem ganha e quem perde espaço no tráfego, e quais modelos estão no topo agora. A cor segue o laboratório ou a origem, nunca a posição no ranking.">
      <Vendor R={R} />
      <div style={{ marginTop: 14 }}><Board R={R} /></div>
    </Secao>
  );
}
