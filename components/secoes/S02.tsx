'use client';
/**
 * Seção 02: tamanho e concentração do mercado. Porte do lineChart('volume') e
 * do lineChart('conc') da v1, com as leituras de readings() e tiles(). Tudo
 * sai do Recorte: janela, agrupamento e filtro já chegam aplicados.
 */
import * as d3 from 'd3';
import type { Mercado } from '@/lib/tipos';
import type { Recorte } from '@/lib/engine';
import { Cartao, Secao } from '@/components/shell/Cartao';
import { useHistorico } from '@/components/shell/Historico';
import { Temporal, TabelaSerie, type LinhaTip } from '@/components/graficos/base';
import { useIdioma } from '@/components/shell/Idioma';
import { indiceBase, indiceFim, Leitura, LinkModelo, P, useNomes, usePeriodo } from './s02-comum';

/** Faixa do HHI na escala antitruste convencional: 0 não concentrado, 1 moderado, 2 alto. */
const faixaHHI = (v: number) => (v >= 2500 ? 2 : v >= 1500 ? 1 : 0);

function LeituraVolume({ R, b }: { R: Recorte; b: number }) {
  const { t, f } = useIdioma();
  const { qtdPer, quando, naQuando } = usePeriodo();
  const { fmtT } = f;
  const tot = R.weekly_total_T, u = indiceFim(tot);
  const r = tot[b] ? tot[u] / tot[b] : NaN;
  const dist = u - b;
  const mes = R.estado.gran === 'mes';
  let ritmo = '';
  if (isFinite(r) && dist > 0) {
    if (r >= 1.05) ritmo = t({ pt: `: ×${f.fmtVez(r)} em ${qtdPer(R, dist)}`, en: `: up ${f.fmtVezes(r)} in ${qtdPer(R, dist)}` });
    else if (r <= 0.95) ritmo = t({ pt: `: queda de ${f.dec(Math.round((1 - r) * 100))}% em ${qtdPer(R, dist)}`, en: `: down ${f.dec(Math.round((1 - r) * 100))}% in ${qtdPer(R, dist)}` });
    else ritmo = t({ pt: `, praticamente estável em ${qtdPer(R, dist)}`, en: `, virtually flat over ${qtdPer(R, dist)}` });
  }
  // Maior salto de um período para o seguinte: onde a curva deixa de ser linear.
  let salto = -1, dSalto = 0;
  for (let i = b + 1; i <= u; i++) { const d = tot[i] - tot[i - 1]; if (d > dSalto) { dSalto = d; salto = i; } }
  const anonimo = R.boards.last.find(x => x.vendor === 'stealth' || x.vendor === 'openrouter');
  return (
    <Leitura R={R}>
      <p>{t({
        pt: <>O volume {mes ? 'semanal médio' : 'semanal'} foi de <b>{fmtT(tot[b])}</b> ({quando(R, b)}) para <b>{fmtT(tot[u])}</b> ({quando(R, u)}){ritmo}.
          {b > 0 && <> O recorte só tem volume a partir de {quando(R, b)}, então a comparação começa ali.</>}</>,
        en: <>{mes ? 'Average weekly' : 'Weekly'} volume went from <b>{fmtT(tot[b])}</b> ({quando(R, b)}) to <b>{fmtT(tot[u])}</b> ({quando(R, u)}){ritmo}.
          {b > 0 && <> The filtered view has no volume before {mes ? '' : 'the '}{quando(R, b)}, so the comparison starts there.</>}</>,
      })}</p>
      {salto > 0 && dist >= 2 && (
        <P>{t({
          pt: <>O maior salto entre dois períodos seguidos foi {naQuando(R, salto)}: <b>+{fmtT(dSalto)}</b>, de {fmtT(tot[salto - 1])} para {fmtT(tot[salto])}.{r >= 1.05 ? ' A curva sobe em degraus, não em linha reta.' : ''}</>,
          en: <>The largest jump between two consecutive periods came {naQuando(R, salto)}: <b>+{fmtT(dSalto)}</b>, from {fmtT(tot[salto - 1])} to {fmtT(tot[salto])}.{r >= 1.05 ? ' The curve climbs in steps, not in a straight line.' : ''}</>,
        })}</P>
      )}
      {anonimo && (
        <P><span className="pill" style={{ marginLeft: 0, marginRight: 6 }}>{t({ pt: 'atenção', en: 'caveat' })}</span>{t({
          pt: <>O último período traz <b>{f.fmtP(anonimo.share)}</b> dos modelos nomeados em <span className="mono">{anonimo.model}</span>, um modelo anônimo em teste. Tráfego assim é transitório e infla o topo.</>,
          en: <>The latest period puts <b>{f.fmtP(anonimo.share)}</b> of named-model volume on <span className="mono">{anonimo.model}</span>, an anonymous model in testing. Traffic like this is transient and inflates the top of the ranking.</>,
        })}</P>
      )}
      <P>{t({
        pt: 'Comparar volume absoluto entre pontas distantes exige cuidado: a própria fonte cresceu junto com o mercado, e qualquer share do começo vale muito menos em tokens.',
        en: 'Comparing absolute volume across distant points calls for care: the source itself grew along with the market, and any share at the start is worth far fewer tokens.',
      })}</P>
    </Leitura>
  );
}

function LeituraConc({ R, b, nome }: { R: Recorte; b: number; nome: (s: string) => string }) {
  const { t, f } = useIdioma();
  const { entre, naQuando } = usePeriodo();
  const { fmtP } = f;
  const rotHHI = (v: number) => [
    t({ pt: 'não concentrado', en: 'unconcentrated' }),
    t({ pt: 'moderadamente concentrado', en: 'moderately concentrated' }),
    t({ pt: 'altamente concentrado', en: 'highly concentrated' }),
  ][faixaHHI(v)];
  const u = indiceFim(R.weekly_total_T), t5 = R.top5, h = R.hhi;
  const h0 = h[b], h1 = h[u];
  let pico = b; for (let i = b; i <= u; i++) if (t5[i] > t5[pico]) pico = i;
  const lider = R.top5_modelos[u]?.[0];
  const mudou = faixaHHI(h0) !== faixaHHI(h1);
  return (
    <Leitura R={R}>
      <p>{t({
        pt: <>Os 5 maiores modelos foram de <b>{fmtP(t5[b])}</b> para <b>{fmtP(t5[u])}</b> do volume {entre(R, b, u)}.
          {' '}O HHI, na base modelo, foi de <b>{h0}</b> para <b>{h1}</b>
          {mudou
            ? <>: saiu de “{rotHHI(h0)}” para “{rotHHI(h1)}” na escala antitruste convencional.</>
            : <>, o que o mantém como “{rotHHI(h1)}” na escala antitruste convencional.</>}</>,
        en: <>The top 5 models went from <b>{fmtP(t5[b])}</b> to <b>{fmtP(t5[u])}</b> of volume {entre(R, b, u)}.
          {' '}The model-level HHI went from <b>{h0}</b> to <b>{h1}</b>
          {mudou
            ? <>: it moved from “{rotHHI(h0)}” to “{rotHHI(h1)}” on the conventional antitrust scale.</>
            : <>, which keeps it “{rotHHI(h1)}” on the conventional antitrust scale.</>}</>,
      })}</p>
      {pico !== u && pico !== b && <P>{t({
        pt: <>O pico de concentração na janela foi <b>{fmtP(t5[pico])}</b>, {naQuando(R, pico)}.</>,
        en: <>Concentration peaked within the window at <b>{fmtP(t5[pico])}</b>, {naQuando(R, pico)}.</>,
      })}</P>}
      {lider && <P>{t({
        pt: <>{u === R.N - 1 ? 'No último período' : 'No último período com volume'}, o maior é <LinkModelo slug={lider.s} nome={nome(lider.s)} />, com <b>{fmtP(lider.share)}</b> do volume sozinho.</>,
        en: <>{u === R.N - 1 ? 'In the latest period' : 'In the latest period with volume'}, the largest is <LinkModelo slug={lider.s} nome={nome(lider.s)} />, with <b>{fmtP(lider.share)}</b> of volume on its own.</>,
      })}</P>}
      <P>{h1 < 1500
        ? t({
          pt: 'Implicação para roteamento: há substitutos próximos no topo, então ficar preso a um modelo específico é uma decisão, não uma inevitabilidade.',
          en: 'Routing implication: there are close substitutes at the top, so being locked into one specific model is a choice, not an inevitability.',
        })
        : t({
          pt: 'Implicação para roteamento: com o tráfego concentrado em poucos modelos, a troca é mais cara, e vale ter a avaliação pronta antes que o líder mude.',
          en: 'Routing implication: with traffic concentrated in a few models, switching costs more, and it pays to have your evaluation ready before the leader changes.',
        })}</P>
    </Leitura>
  );
}

/** A tabela da concentração abre quem são os cinco em cada período, como na v1. */
function TabelaConc({ R, nome }: { R: Recorte; nome: (s: string) => string }) {
  const { t, f } = useIdioma();
  const gran = R.estado.gran;
  return (
    <details className="tab">
      <summary>{t({ pt: 'Ver os números e quem são os cinco', en: 'See the numbers and who the five are' })}</summary>
      <div className="tabwrap" style={{ maxHeight: 300, overflowY: 'auto' }}>
        <table className="t">
          <thead><tr>
            <th>{gran === 'mes' ? t({ pt: 'Mês', en: 'Month' }) : t({ pt: 'Semana', en: 'Week' })}</th><th className="num">Top 5</th><th className="num">HHI</th>
            {[1, 2, 3, 4, 5].map(c => <th key={c}>{f.ord(c)}</th>)}
          </tr></thead>
          <tbody>{[...R.eixo.keys()].reverse().map(i => {
            const m = R.top5_modelos[i] ?? [];
            return (
              <tr key={R.eixo[i]}>
                <td style={{ whiteSpace: 'nowrap' }}>{f.fPer(R.eixo[i], gran)}</td>
                <td className="num">{f.fmtP(R.top5[i])}</td>
                <td className="num">{R.hhi[i] || '—'}</td>
                {[0, 1, 2, 3, 4].map(k => (
                  <td key={k} style={{ whiteSpace: 'nowrap' }}>{m[k] ? <>{nome(m[k].s)} <span className="mono" style={{ color: 'var(--ink-3)' }}>{f.fmtP(m[k].share)}</span></> : '—'}</td>
                ))}
              </tr>
            );
          })}</tbody>
        </table>
      </div>
    </details>
  );
}

export default function S02(_: { M: Mercado }) {
  const { D, R } = useHistorico();
  const { t, f } = useIdioma();
  const { per, tipSemanas } = usePeriodo();
  const { fmtP, fmtT, fPer } = f;
  const nome = useNomes(D);
  const tot = R.weekly_total_T, u = R.N - 1, gran = R.estado.gran;
  const mes = gran === 'mes';
  const b = indiceBase(tot);
  const { adj } = per(R);
  const semVolume = b < 0;
  const eixoT = (v: number) => (v === 0 ? '0' : fmtT(v));

  const tipConc = (i: number): LinhaTip[] => {
    const m = R.top5_modelos[i] ?? [];
    return [
      { rot: 'HHI', val: R.hhi[i] ? String(R.hhi[i]) : '—' },
      ...m.map((x, k) => ({ rot: `${k + 1}. ${nome(x.s)}`, val: fmtP(x.share) })),
      ...tipSemanas(R)(i),
    ];
  };

  return (
    <Secao id="s02" n="02" titulo={t({ pt: 'Tamanho e concentração do mercado', en: 'Market size and concentration' })}
      sub={t({
        pt: 'Quanto o roteador processa, e quão espalhado esse volume está entre os modelos. É o denominador de todo share que aparece daqui para baixo.',
        en: 'How much the router processes, and how widely that volume is spread across models. It is the denominator of every share from here down.',
      })}>
      <div className="grid2">
        <Cartao id="volume" titulo={mes ? t({ pt: 'Tokens por semana, média do mês', en: 'Tokens per week, monthly average' }) : t({ pt: 'Tokens por semana', en: 'Tokens per week' })}
          subtitulo={mes
            ? t({
              pt: 'Trilhões de tokens por semana, em média dentro de cada mês. Modelos nomeados mais a linha agregada da fonte',
              en: "Trillions of tokens per week, averaged within each month. Named models plus the source's aggregate line",
            })
            : t({
              pt: 'Trilhões de tokens processados em cada semana. Modelos nomeados mais a linha agregada da fonte',
              en: "Trillions of tokens processed each week. Named models plus the source's aggregate line",
            })}>
          {semVolume ? <p className="vazio">{t({ pt: 'Nenhum volume no recorte atual. Afrouxe o filtro ou amplie a janela.', en: 'No volume in the current filtered view. Loosen the filter or widen the window.' })}</p> : (
            <>
              <Temporal eixo={R.eixo} gran={gran} modo="area" fmt={fmtT} fmtEixo={eixoT} altura={230}
                series={[{ key: 'tot', label: mes ? t({ pt: 'Tokens por semana (média)', en: 'Tokens per week (average)' }) : t({ pt: 'Tokens na semana', en: 'Tokens in the week' }), values: tot, slot: '--s1', destaque: true }]}
                tipExtra={tipSemanas(R)}
                rotuloAria={t({
                  pt: `Volume ${mes ? 'semanal médio, por mês,' : 'semanal'} de tokens, de ${fmtT(tot[b])} em ${fPer(R.eixo[b], gran)} a ${fmtT(tot[u])} em ${fPer(R.eixo[u], gran)}, em ${R.N} períodos.`,
                  en: `${mes ? 'Average weekly token volume by month' : 'Weekly token volume'}, from ${fmtT(tot[b])} (${fPer(R.eixo[b], gran)}) to ${fmtT(tot[u])} (${fPer(R.eixo[u], gran)}), over ${R.N} periods.`,
                })} />
              <TabelaSerie eixo={R.eixo} gran={gran} fmt={fmtT} series={[{ label: mes ? t({ pt: 'Tokens/semana (média)', en: 'Tokens/week (average)' }) : t({ pt: 'Tokens/semana', en: 'Tokens/week' }), values: tot }]} />
              <LeituraVolume R={R} b={b} />
            </>
          )}
        </Cartao>

        <Cartao id="conc" subtitulo={t({
          pt: `% do volume ${adj} capturado pelos 5 modelos mais usados; o tooltip mostra quem são e o HHI`,
          en: `% of ${adj} volume captured by the 5 most-used models; the tooltip shows who they are and the HHI`,
        })}>
          {semVolume ? <p className="vazio">{t({ pt: 'Nenhum volume no recorte atual, então não há o que concentrar.', en: 'No volume in the current filtered view, so there is nothing to concentrate.' })}</p> : (
            <>
              <Temporal eixo={R.eixo} gran={gran} modo="area" fmt={v => fmtP(v)} fmtEixo={v => d3.format('d')(v) + '%'} ymax={100} altura={230}
                series={[{ key: 'top5', label: t({ pt: 'Share dos 5 maiores', en: 'Top-5 share' }), values: R.top5.map((v, i) => (tot[i] > 0 ? v : null)), slot: '--s1', destaque: true }]}
                tipExtra={tipConc}
                rotuloAria={t({
                  pt: `Share dos 5 maiores modelos, de ${fmtP(R.top5[b])} em ${fPer(R.eixo[b], gran)} a ${fmtP(R.top5[u])} em ${fPer(R.eixo[u], gran)}. HHI de ${R.hhi[b]} para ${R.hhi[u]}.`,
                  en: `Share of the top 5 models, from ${fmtP(R.top5[b])} (${fPer(R.eixo[b], gran)}) to ${fmtP(R.top5[u])} (${fPer(R.eixo[u], gran)}). HHI from ${R.hhi[b]} to ${R.hhi[u]}.`,
                })} />
              <TabelaConc R={R} nome={nome} />
              <LeituraConc R={R} b={b} nome={nome} />
            </>
          )}
        </Cartao>
      </div>
    </Secao>
  );
}
