'use client';
/**
 * Seção 11: o que mudou entre o último período e quatro semanas (ou um mês)
 * antes. Porte de mudou() e varia() da v1, lendo R.mudancas: responde à
 * janela, ao agrupamento e aos filtros. Cor por direção (--s3 alta, --s2
 * queda), nunca verde e vermelho: a página não torce por lado nenhum.
 */
import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import * as d3 from 'd3';
import type { Mercado } from '@/lib/tipos';
import { Cartao, Secao } from '@/components/shell/Cartao';
import { useHistorico } from '@/components/shell/Historico';
import { cor } from '@/components/graficos/base';
import type { Recorte, Variacao } from '@/lib/engine';
import { br, curto, fPer, fmtP, fmtVez, urlModelo } from '@/lib/format';
import { rotulador } from './s09-nomes';

const pp = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '') + br(Math.abs(v).toFixed(1)) + ' pp';
const periodo = (R: Recorte, n: number) => R.estado.gran === 'mes' ? (n === 1 ? 'mês' : 'meses') : (n === 1 ? 'semana' : 'semanas');

/** Um rotulador para a seção inteira: a mesma versão tem o mesmo nome nas duas listas. */
const rotDe = (M: Recorte['mudancas']) => rotulador([...M.entraram, ...M.sairam, ...M.subiram.map(v => v.s), ...M.cairam.map(v => v.s), ...M.estreantes.map(e => e.s)]);

function NomeModelo({ s, rot }: { s: string; rot: (s: string) => string }) {
  return <Link prefetch={false} href={urlModelo(s)} className="mono" style={{ color: 'var(--ink)', textDecoration: 'none', fontSize: 12 }} title={s}>{rot(s)}</Link>;
}

// ------------------------------------------------------------------ entradas e saídas

function Grupo({ titulo, slot, total, itens, vazio, rodape, largo, rot }: {
  titulo: string; slot: string; total: number; itens: { s: string; val: ReactNode }[]; vazio: string; rodape?: ReactNode; largo?: boolean; rot: (s: string) => string;
}) {
  return (
    <div style={{ minWidth: 0, gridColumn: largo ? '1 / -1' : undefined, borderTop: `3px solid ${cor(slot)}`, background: 'var(--surface-2)', borderRadius: '0 0 9px 9px', padding: '9px 11px 10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-2)', fontFamily: 'var(--font-mono),monospace' }}>{titulo}</span>
        <b style={{ fontSize: 17, fontVariantNumeric: 'tabular-nums' }}>{total}</b>
      </div>
      {itens.length
        ? <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: largo ? 'repeat(auto-fill,minmax(min(100%,190px),1fr))' : 'minmax(0,1fr)', gap: '5px 18px' }}>
          {itens.map(it => (
            <li key={it.s} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline', minWidth: 0 }}>
              <span style={{ minWidth: 0, overflowWrap: 'anywhere', lineHeight: 1.3 }}><NomeModelo rot={rot} s={it.s} /></span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>{it.val}</span>
            </li>
          ))}
        </ul>
        : <p style={{ fontSize: 12, color: 'var(--ink-3)' }}>{vazio}</p>}
      {rodape && <p style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6 }}>{rodape}</p>}
    </div>
  );
}

function CartaoMudou({ R }: { R: Recorte }) {
  const M = R.mudancas, gran = R.estado.gran, mes = gran === 'mes';
  const rot = rotDe(M);
  const passo = mes ? 1 : 4;
  const pos = new Map(R.qualidade.map((q, i) => [q.slug, { rank: i + 1, share: q.share }]));
  const agora = (s: string) => { const p = pos.get(s); return p ? <>#{p.rank} · {fmtP(p.share)}</> : 'sem volume'; };
  const sub = mes ? <>Mês de {fPer(M.semana, gran)} contra o de {fPer(M.comparada, gran)}</> : <>Semana de {fPer(M.semana, gran)} contra a de {fPer(M.comparada, gran)}</>;
  const sub0 = M.subiram.find(v => v.delta > 0), cai0 = M.cairam.find(v => v.delta < 0);
  return (
    <Cartao id="mudou" subtitulo={sub}>
      {M.distancia === 0
        ? <p className="vazio">A janela tem um período só, e não há com o que comparar. Escolha uma janela maior.</p>
        : <>
          <style href="s11-grupos" precedence="default">{'.s11-grupos{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}@media (max-width:520px){.s11-grupos{grid-template-columns:minmax(0,1fr)}}'}</style>
          <div className="s11-grupos">
            <Grupo rot={rot} titulo="Entraram no top 10" slot="--s3" total={M.entraram.length} vazio="nenhum: o top 10 é o mesmo"
              itens={M.entraram.map(s => ({ s, val: agora(s) }))} />
            <Grupo rot={rot} titulo="Saíram do top 10" slot="--s2" total={M.sairam.length} vazio="nenhum"
              itens={M.sairam.map(s => ({ s, val: agora(s) }))} />
            <Grupo rot={rot} largo titulo="Estrearam no ranking" slot="--s1" total={M.n_estreantes} vazio="nenhuma estreia no período"
              itens={M.estreantes.map(e => ({ s: e.s, val: fmtP(e.share) }))}
              rodape={M.n_estreantes > M.estreantes.length ? `os ${M.estreantes.length} maiores, de ${M.n_estreantes}` : undefined} />
          </div>
          <p className="nota" style={{ marginTop: 8 }}>Ao lado de cada nome, a posição e o share no último período. Estreante é quem não tinha volume nenhum até o período de comparação.</p>
          <p className="leitura">
            Entre {fPer(M.comparada, gran)} e {fPer(M.semana, gran)}, <b>{M.entraram.length}</b> {M.entraram.length === 1 ? 'modelo entrou' : 'modelos entraram'} no top 10 e <b>{M.sairam.length}</b> {M.sairam.length === 1 ? 'saiu' : 'saíram'}; <b>{M.n_estreantes}</b> {M.n_estreantes === 1 ? 'estreou' : 'estrearam'} no ranking.
            {sub0 && <> Maior alta: <NomeModelo rot={rot} s={sub0.s} />, {pp(sub0.delta)}, de {fmtP(sub0.de)} para {fmtP(sub0.para)}.</>}
            {cai0 && <> Maior queda: <NomeModelo rot={rot} s={cai0.s} />, {pp(cai0.delta)}, de {fmtP(cai0.de)} para {fmtP(cai0.para)}.</>}
            {M.distancia < passo && <> A janela é curta: a comparação é com o início dela, {M.distancia} {periodo(R, M.distancia)} antes, e não {passo} {periodo(R, passo)}.</>}
            {' '}Um retrato histórico muda pouco de um dia para o outro; a rotatividade do topo, não.
          </p>
        </>}
    </Cartao>
  );
}

// ------------------------------------------------------------------ variações

function CartaoVaria({ R }: { R: Recorte }) {
  const M = R.mudancas, gran = R.estado.gran;
  const rot = rotDe(M);
  const [hv, setHv] = useState<{ i: number; top: number } | null>(null);
  const linhas: Variacao[] = [...M.subiram.filter(v => v.delta > 0), ...M.cairam.filter(v => v.delta < 0).reverse()]
    .filter((r, i, a) => a.findIndex(z => z.s === r.s) === i);
  // O valor mora numa coluna própria à direita: a barra pode usar a meia pista inteira sem empurrar o rótulo para fora.
  const max = d3.max(linhas, r => Math.abs(r.delta)) || 1;
  const larg = (d: number) => `${(48 * Math.abs(d) / max).toFixed(2)}%`;
  const dist = `${M.distancia} ${periodo(R, M.distancia)}`;
  const altas = linhas.filter(r => r.delta > 0);
  const deZero = altas.filter(r => r.de === 0).length;
  // Em pp o grande ganha visibilidade; a razão mostra quem multiplicou de base pequena.
  const relativo = altas.filter(r => r.de >= 0.1).map(r => ({ ...r, x: r.para / r.de })).sort((a, b) => b.x - a.x)[0];
  const h = hv ? linhas[hv.i] : null;
  return (
    <Cartao id="varia" subtitulo={<>Diferença de share em pontos percentuais {M.distancia === 1 ? `no último ${periodo(R, 1)}` : `nos últimos ${dist}`}, até {fPer(M.semana, gran)}</>}>
      {!linhas.length
        ? <p className="vazio">Nenhuma variação relevante de share no recorte atual.</p>
        : <>
          <div className="legenda">
            <span className="item"><i style={{ background: cor('--s3') }} />Ganhou share</span>
            <span className="item"><i style={{ background: cor('--s2') }} />Perdeu share</span>
          </div>
          <div className="plot" role="group" onPointerLeave={() => setHv(null)}
            aria-label={`Maiores variações de share em ${dist}: ${linhas.map(r => `${rot(r.s)} ${pp(r.delta)}`).join(', ')}.`}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,min(200px,38%)) minmax(0,1fr) auto', gap: '5px 10px', alignItems: 'center' }}>
              {linhas.map((r, i) => {
                const sobe = r.delta > 0;
                const entra = (e: React.PointerEvent<HTMLElement>) => setHv({ i, top: e.currentTarget.offsetTop });
                return (
                  <div key={r.s} style={{ display: 'contents' }}>
                    <span style={{ minWidth: 0, overflowWrap: 'anywhere', lineHeight: 1.3 }} onPointerEnter={entra}><NomeModelo rot={rot} s={r.s} /></span>
                    <span style={{ position: 'relative', display: 'block', height: 18 }} onPointerEnter={entra} onPointerDown={entra}>
                      <span aria-hidden="true" style={{ position: 'absolute', left: '50%', top: -3, bottom: -3, width: 1, background: 'var(--axis)' }} />
                      <i style={{ position: 'absolute', top: 4, height: 10, borderRadius: 3, background: cor(sobe ? '--s3' : '--s2'),
                        left: sobe ? '50%' : `calc(50% - ${larg(r.delta)})`, width: `max(2px, ${larg(r.delta)})`, opacity: hv == null || hv.i === i ? 1 : 0.45 }} />
                    </span>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--ink-2)', whiteSpace: 'nowrap', textAlign: 'right' }} onPointerEnter={entra}>{pp(r.delta)}</span>
                  </div>
                );
              })}
            </div>
            {h && hv && (
              <div className="tip" style={{ right: 0, top: hv.top + 22 }}>
                <div className="t">{rot(h.s)}</div>
                <div className="r"><span>Share em {fPer(M.comparada, gran)}</span><b>{fmtP(h.de, 2)}</b></div>
                <div className="r"><span>Share em {fPer(M.semana, gran)}</span><b>{fmtP(h.para, 2)}</b></div>
                <div className="r"><span><i style={{ background: cor(h.delta > 0 ? '--s3' : '--s2') }} />Variação</span><b>{pp(h.delta)}</b></div>
                <div className="r"><span>Origem</span><b>{h.origin}</b></div>
              </div>
            )}
          </div>
          <details className="tab">
            <summary>Ver os números</summary>
            <div className="tabwrap">
              <table className="t">
                <thead><tr><th>Modelo</th><th className="num">Share em {fPer(M.comparada, gran)}</th><th className="num">Share em {fPer(M.semana, gran)}</th><th className="num">Variação</th></tr></thead>
                <tbody>{linhas.map(r => (
                  <tr key={r.s}><td><Link prefetch={false} href={urlModelo(r.s)}>{rot(r.s)}</Link></td><td className="num">{fmtP(r.de, 2)}</td><td className="num">{fmtP(r.para, 2)}</td><td className="num">{pp(r.delta)}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </details>
          <p className="leitura">
            {altas.length > 0 && deZero > 0 && <>{altas.length === 1 ? 'A maior alta é' : deZero === altas.length ? `Todas as ${altas.length} maiores altas são` : `${deZero} das ${altas.length} maiores altas são`} de modelos que partiram de share praticamente nulo em {fPer(M.comparada, gran)}: a alta é estreia, não virada. </>}
            {relativo && relativo.x >= 1.5 && <>Em termos relativos, <NomeModelo rot={rot} s={relativo.s} /> multiplicou o share por {fmtVez(relativo.x)}, de {fmtP(relativo.de, 2)} para {fmtP(relativo.para, 2)}. </>}
            Ponto percentual favorece quem já é grande: para modelos pequenos, a variação relativa conta mais história.
          </p>
        </>}
    </Cartao>
  );
}

export default function S11(_: { M: Mercado }) {
  const { R } = useHistorico();
  const mes = R.estado.gran === 'mes';
  return (
    <Secao id="s11" n="11" titulo="O que mudou"
      sub={<>O último período contra {mes ? 'o mês anterior' : 'quatro semanas antes'}: quem entrou e saiu do top 10, quem estreou e quem mais ganhou e perdeu share. Responde à janela, ao agrupamento e aos filtros.</>}>
      <div className="grid2">
        <CartaoMudou R={R} />
        <CartaoVaria R={R} />
      </div>
    </Secao>
  );
}
