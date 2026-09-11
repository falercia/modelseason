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
import { useIdioma } from '@/components/shell/Idioma';
import { cor } from '@/components/graficos/base';
import type { Recorte, Variacao } from '@/lib/engine';
import type { Fmt } from '@/lib/format';
import { rotulador } from './s09-nomes';
import { usePeriodo } from './s02-comum';

/** Um rotulador para a seção inteira: a mesma versão tem o mesmo nome nas duas listas. */
const rotDe = (M: Recorte['mudancas'], f: Fmt) => rotulador([...M.entraram, ...M.sairam, ...M.subiram.map(v => v.s), ...M.cairam.map(v => v.s), ...M.estreantes.map(e => e.s)], f);

/** Período de uma data do eixo em inglês: "week of Aug 31, 2026" ou "Aug 2026". */
const quandoEn = (f: Fmt, s: string, mes: boolean) => (mes ? f.fMes(s) : `week of ${f.fD(s)}`);

function NomeModelo({ s, rot }: { s: string; rot: (s: string) => string }) {
  const { modelo } = useIdioma();
  return <Link prefetch={false} href={modelo(s)} className="mono" style={{ color: 'var(--ink)', textDecoration: 'none', fontSize: 12 }} title={s}>{rot(s)}</Link>;
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
  const { t, f } = useIdioma();
  const { per, qtdPer } = usePeriodo();
  const M = R.mudancas, gran = R.estado.gran, mes = gran === 'mes';
  const rot = rotDe(M, f);
  const passo = mes ? 1 : 4;
  const pos = new Map(R.qualidade.map((q, i) => [q.slug, { rank: i + 1, share: q.share }]));
  const agora = (s: string) => { const p = pos.get(s); return p ? <>#{p.rank} · {f.fmtP(p.share)}</> : t({ pt: 'sem volume', en: 'no volume' }); };
  const A = f.fPer(M.comparada, gran), B = f.fPer(M.semana, gran);
  const sub = mes
    ? t({ pt: <>Mês de {B} contra o de {A}</>, en: <>{B} vs. {A}</> })
    : t({ pt: <>Semana de {B} contra a de {A}</>, en: <>Week of {B} vs. week of {A}</> });
  const sub0 = M.subiram.find(v => v.delta > 0), cai0 = M.cairam.find(v => v.delta < 0);
  const periodo = (n: number) => (n === 1 ? per(R).um : per(R).n);
  return (
    <Cartao id="mudou" subtitulo={sub}>
      {M.distancia === 0
        ? <p className="vazio">{t({
          pt: 'A janela tem um período só, e não há com o que comparar. Escolha uma janela maior.',
          en: 'The window has only one period, so there is nothing to compare against. Pick a longer window.',
        })}</p>
        : <>
          <style href="s11-grupos" precedence="default">{'.s11-grupos{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}@media (max-width:520px){.s11-grupos{grid-template-columns:minmax(0,1fr)}}'}</style>
          <div className="s11-grupos">
            <Grupo rot={rot} titulo={t({ pt: 'Entraram no top 10', en: 'Entered the top 10' })} slot="--s3" total={M.entraram.length}
              vazio={t({ pt: 'nenhum: o top 10 é o mesmo', en: 'none: the top 10 is unchanged' })}
              itens={M.entraram.map(s => ({ s, val: agora(s) }))} />
            <Grupo rot={rot} titulo={t({ pt: 'Saíram do top 10', en: 'Left the top 10' })} slot="--s2" total={M.sairam.length}
              vazio={t({ pt: 'nenhum', en: 'none' })}
              itens={M.sairam.map(s => ({ s, val: agora(s) }))} />
            <Grupo rot={rot} largo titulo={t({ pt: 'Estrearam no ranking', en: 'Debuted in the ranking' })} slot="--s1" total={M.n_estreantes}
              vazio={t({ pt: 'nenhuma estreia no período', en: 'no debuts in the period' })}
              itens={M.estreantes.map(e => ({ s: e.s, val: f.fmtP(e.share) }))}
              rodape={M.n_estreantes > M.estreantes.length
                ? t({ pt: `os ${M.estreantes.length} maiores, de ${M.n_estreantes}`, en: `the ${M.estreantes.length} largest of ${M.n_estreantes}` })
                : undefined} />
          </div>
          <p className="nota" style={{ marginTop: 8 }}>{t({
            pt: 'Ao lado de cada nome, a posição e o share no último período. Estreante é quem não tinha volume nenhum até o período de comparação.',
            en: 'Next to each name, the rank and share in the last period. A debut is a model that had no volume at all up to the comparison period.',
          })}</p>
          <p className="leitura">
            {t({
              pt: <>Entre {A} e {B}, <b>{M.entraram.length}</b> {M.entraram.length === 1 ? 'modelo entrou' : 'modelos entraram'} no top 10 e <b>{M.sairam.length}</b> {M.sairam.length === 1 ? 'saiu' : 'saíram'}; <b>{M.n_estreantes}</b> {M.n_estreantes === 1 ? 'estreou' : 'estrearam'} no ranking.</>,
              en: <>{mes ? `Between ${A} and ${B}` : `Between the weeks of ${A} and ${B}`}, <b>{M.entraram.length}</b> {M.entraram.length === 1 ? 'model' : 'models'} entered the top 10 and <b>{M.sairam.length}</b> left; <b>{M.n_estreantes}</b> debuted in the ranking.</>,
            })}
            {sub0 && t({
              pt: <> Maior alta: <NomeModelo rot={rot} s={sub0.s} />, {f.fmtPP(sub0.delta)}, de {f.fmtP(sub0.de)} para {f.fmtP(sub0.para)}.</>,
              en: <> Biggest gain: <NomeModelo rot={rot} s={sub0.s} />, {f.fmtPP(sub0.delta)}, from {f.fmtP(sub0.de)} to {f.fmtP(sub0.para)}.</>,
            })}
            {cai0 && t({
              pt: <> Maior queda: <NomeModelo rot={rot} s={cai0.s} />, {f.fmtPP(cai0.delta)}, de {f.fmtP(cai0.de)} para {f.fmtP(cai0.para)}.</>,
              en: <> Biggest drop: <NomeModelo rot={rot} s={cai0.s} />, {f.fmtPP(cai0.delta)}, from {f.fmtP(cai0.de)} to {f.fmtP(cai0.para)}.</>,
            })}
            {M.distancia < passo && t({
              pt: <> A janela é curta: a comparação é com o início dela, {M.distancia} {periodo(M.distancia)} antes, e não {passo} {periodo(passo)}.</>,
              en: <> The window is short: the comparison is with its start, {qtdPer(R, M.distancia)} earlier, not {qtdPer(R, passo)}.</>,
            })}
            {' '}{t({
              pt: 'Um retrato histórico muda pouco de um dia para o outro; a rotatividade do topo, não.',
              en: 'A historical snapshot barely changes from one day to the next; turnover at the top does.',
            })}
          </p>
        </>}
    </Cartao>
  );
}

// ------------------------------------------------------------------ variações

function CartaoVaria({ R }: { R: Recorte }) {
  const { t, f, modelo, valor } = useIdioma();
  const { per, qtdPer } = usePeriodo();
  const M = R.mudancas, gran = R.estado.gran, mes = gran === 'mes';
  const rot = rotDe(M, f);
  const [hv, setHv] = useState<{ i: number; top: number } | null>(null);
  const linhas: Variacao[] = [...M.subiram.filter(v => v.delta > 0), ...M.cairam.filter(v => v.delta < 0).reverse()]
    .filter((r, i, a) => a.findIndex(z => z.s === r.s) === i);
  // O valor mora numa coluna própria à direita: a barra pode usar a meia pista inteira sem empurrar o rótulo para fora.
  const max = d3.max(linhas, r => Math.abs(r.delta)) || 1;
  const larg = (d: number) => `${(48 * Math.abs(d) / max).toFixed(2)}%`;
  const periodo = (n: number) => (n === 1 ? per(R).um : per(R).n);
  const dist = `${M.distancia} ${periodo(M.distancia)}`;
  const altas = linhas.filter(r => r.delta > 0);
  const deZero = altas.filter(r => r.de === 0).length;
  // Em pp o grande ganha visibilidade; a razão mostra quem multiplicou de base pequena.
  const relativo = altas.filter(r => r.de >= 0.1).map(r => ({ ...r, x: r.para / r.de })).sort((a, b) => b.x - a.x)[0];
  const h = hv ? linhas[hv.i] : null;
  const A = f.fPer(M.comparada, gran), B = f.fPer(M.semana, gran);
  const shareEm = (d: string) => t({ pt: `Share em ${f.fPer(d, gran)}`, en: `Share, ${quandoEn(f, d, mes)}` });
  // Em inglês, "em A" depende do agrupamento: "in the week of Aug 3, 2026" / "in Aug 2026".
  const emA = `in ${mes ? '' : 'the '}${quandoEn(f, M.comparada, mes)}`;
  return (
    <Cartao id="varia" subtitulo={t({
      pt: <>Diferença de share em pontos percentuais {M.distancia === 1 ? `no último ${periodo(1)}` : `nos últimos ${dist}`}, até {B}</>,
      en: <>Share change in percentage points over the last {M.distancia === 1 ? per(R).um : qtdPer(R, M.distancia)}, through {B}</>,
    })}>
      {!linhas.length
        ? <p className="vazio">{t({ pt: 'Nenhuma variação relevante de share no recorte atual.', en: 'No meaningful share change in the current filtered view.' })}</p>
        : <>
          <div className="legenda">
            <span className="item"><i style={{ background: cor('--s3') }} />{t({ pt: 'Ganhou share', en: 'Gained share' })}</span>
            <span className="item"><i style={{ background: cor('--s2') }} />{t({ pt: 'Perdeu share', en: 'Lost share' })}</span>
          </div>
          <div className="plot" role="group" onPointerLeave={() => setHv(null)}
            aria-label={t({
              pt: `Maiores variações de share em ${dist}: ${linhas.map(r => `${rot(r.s)} ${f.fmtPP(r.delta)}`).join(', ')}.`,
              en: `Largest share changes over ${qtdPer(R, M.distancia)}: ${linhas.map(r => `${rot(r.s)} ${f.fmtPP(r.delta)}`).join(', ')}.`,
            })}>
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
                    <span className="mono" style={{ fontSize: 11, color: 'var(--ink-2)', whiteSpace: 'nowrap', textAlign: 'right' }} onPointerEnter={entra}>{f.fmtPP(r.delta)}</span>
                  </div>
                );
              })}
            </div>
            {h && hv && (
              <div className="tip" style={{ right: 0, top: hv.top + 22 }}>
                <div className="t">{rot(h.s)}</div>
                <div className="r"><span>{shareEm(M.comparada)}</span><b>{f.fmtP(h.de, 2)}</b></div>
                <div className="r"><span>{shareEm(M.semana)}</span><b>{f.fmtP(h.para, 2)}</b></div>
                <div className="r"><span><i style={{ background: cor(h.delta > 0 ? '--s3' : '--s2') }} />{t({ pt: 'Variação', en: 'Change' })}</span><b>{f.fmtPP(h.delta)}</b></div>
                <div className="r"><span>{t({ pt: 'Origem', en: 'Origin' })}</span><b>{valor(h.origin)}</b></div>
              </div>
            )}
          </div>
          <details className="tab">
            <summary>{t({ pt: 'Ver os números', en: 'See the numbers' })}</summary>
            <div className="tabwrap">
              <table className="t">
                <thead><tr>
                  <th>{t({ pt: 'Modelo', en: 'Model' })}</th><th className="num">{shareEm(M.comparada)}</th><th className="num">{shareEm(M.semana)}</th>
                  <th className="num">{t({ pt: 'Variação', en: 'Change' })}</th>
                </tr></thead>
                <tbody>{linhas.map(r => (
                  <tr key={r.s}><td><Link prefetch={false} href={modelo(r.s)}>{rot(r.s)}</Link></td><td className="num">{f.fmtP(r.de, 2)}</td><td className="num">{f.fmtP(r.para, 2)}</td><td className="num">{f.fmtPP(r.delta)}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </details>
          <p className="leitura">
            {altas.length > 0 && deZero > 0 && t({
              pt: <>{altas.length === 1 ? 'A maior alta é' : deZero === altas.length ? `Todas as ${altas.length} maiores altas são` : `${deZero} das ${altas.length} maiores altas são`} de modelos que partiram de share praticamente nulo em {A}: a alta é estreia, não virada. </>,
              en: <>{altas.length === 1 ? 'The biggest gain comes from a model' : deZero === altas.length ? `All ${altas.length} biggest gains come from models` : `${deZero} of the ${altas.length} biggest gains come from models`} that started from near-zero share {emA}: the gain is a debut, not a turnaround. </>,
            })}
            {relativo && relativo.x >= 1.5 && t({
              pt: <>Em termos relativos, <NomeModelo rot={rot} s={relativo.s} /> multiplicou o share por {f.fmtVez(relativo.x)}, de {f.fmtP(relativo.de, 2)} para {f.fmtP(relativo.para, 2)}. </>,
              en: <>In relative terms, <NomeModelo rot={rot} s={relativo.s} /> multiplied its share by {f.fmtVez(relativo.x)}, from {f.fmtP(relativo.de, 2)} to {f.fmtP(relativo.para, 2)}. </>,
            })}
            {t({
              pt: 'Ponto percentual favorece quem já é grande: para modelos pequenos, a variação relativa conta mais história.',
              en: 'Percentage points favor models that are already large: for small models, the relative change tells more of the story.',
            })}
          </p>
        </>}
    </Cartao>
  );
}

export default function S11(_: { M: Mercado }) {
  const { R } = useHistorico();
  const { t } = useIdioma();
  const mes = R.estado.gran === 'mes';
  return (
    <Secao id="s11" n="11" titulo={t({ pt: 'O que mudou', en: 'What changed' })}
      sub={t({
        pt: <>O último período contra {mes ? 'o mês anterior' : 'quatro semanas antes'}: quem entrou e saiu do top 10, quem estreou e quem mais ganhou e perdeu share. Responde à janela, ao agrupamento e aos filtros.</>,
        en: <>The last period against {mes ? 'the previous month' : 'four weeks earlier'}: who entered and left the top 10, who debuted and who gained and lost the most share. Responds to the window, the grouping and the filters.</>,
      })}>
      <div className="grid2">
        <CartaoMudou R={R} />
        <CartaoVaria R={R} />
      </div>
    </Secao>
  );
}
