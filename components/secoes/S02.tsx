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
import { br, fPer, fmtP, fmtT, fmtVez } from '@/lib/format';
import { entre, indiceBase, indiceFim, Leitura, LinkModelo, naQuando, P, per, qtdPer, quando, tipSemanas, useNomes } from './s02-comum';

const eixoT = (v: number) => (v === 0 ? '0' : fmtT(v));
const faixaHHI = (v: number) => (v >= 2500 ? 'altamente concentrado' : v >= 1500 ? 'moderadamente concentrado' : 'não concentrado');

function LeituraVolume({ R, b }: { R: Recorte; b: number }) {
  const tot = R.weekly_total_T, u = indiceFim(tot);
  const r = tot[b] ? tot[u] / tot[b] : NaN;
  const dist = u - b;
  let ritmo = '';
  if (isFinite(r) && dist > 0) {
    if (r >= 1.05) ritmo = `: ×${fmtVez(r)} em ${qtdPer(R, dist)}`;
    else if (r <= 0.95) ritmo = `: queda de ${br(Math.round((1 - r) * 100))}% em ${qtdPer(R, dist)}`;
    else ritmo = `, praticamente estável em ${qtdPer(R, dist)}`;
  }
  // Maior salto de um período para o seguinte: onde a curva deixa de ser linear.
  let salto = -1, dSalto = 0;
  for (let i = b + 1; i <= u; i++) { const d = tot[i] - tot[i - 1]; if (d > dSalto) { dSalto = d; salto = i; } }
  const anonimo = R.boards.last.find(x => x.vendor === 'stealth' || x.vendor === 'openrouter');
  const { adj } = per(R);
  return (
    <Leitura R={R}>
      <p>
        O volume {R.estado.gran === 'mes' ? 'semanal médio' : adj} foi de <b>{fmtT(tot[b])}</b> ({quando(R, b)}) para <b>{fmtT(tot[u])}</b> ({quando(R, u)}){ritmo}.
        {b > 0 && <> O recorte só tem volume a partir de {quando(R, b)}, então a comparação começa ali.</>}
      </p>
      {salto > 0 && dist >= 2 && (
        <P>O maior salto entre dois períodos seguidos foi {naQuando(R, salto)}: <b>+{fmtT(dSalto)}</b>, de {fmtT(tot[salto - 1])} para {fmtT(tot[salto])}.{r >= 1.05 ? ' A curva sobe em degraus, não em linha reta.' : ''}</P>
      )}
      {anonimo && (
        <P><span className="pill" style={{ marginLeft: 0, marginRight: 6 }}>atenção</span>O último período traz <b>{fmtP(anonimo.share)}</b> dos modelos nomeados em <span className="mono">{anonimo.model}</span>, um modelo anônimo em teste. Tráfego assim é transitório e infla o topo.</P>
      )}
      <P>Comparar volume absoluto entre pontas distantes exige cuidado: a própria fonte cresceu junto com o mercado, e qualquer share do começo vale muito menos em tokens.</P>
    </Leitura>
  );
}

function LeituraConc({ R, b, nome }: { R: Recorte; b: number; nome: (s: string) => string }) {
  const u = indiceFim(R.weekly_total_T), t5 = R.top5, h = R.hhi;
  const h0 = h[b], h1 = h[u];
  let pico = b; for (let i = b; i <= u; i++) if (t5[i] > t5[pico]) pico = i;
  const lider = R.top5_modelos[u]?.[0];
  return (
    <Leitura R={R}>
      <p>
        Os 5 maiores modelos foram de <b>{fmtP(t5[b])}</b> para <b>{fmtP(t5[u])}</b> do volume {entre(R, b, u)}.
        {' '}O HHI, na base modelo, foi de <b>{h0}</b> para <b>{h1}</b>
        {faixaHHI(h0) !== faixaHHI(h1)
          ? <>: saiu de “{faixaHHI(h0)}” para “{faixaHHI(h1)}” na escala antitruste convencional.</>
          : <>, o que o mantém como “{faixaHHI(h1)}” na escala antitruste convencional.</>}
      </p>
      {pico !== u && pico !== b && <P>O pico de concentração na janela foi <b>{fmtP(t5[pico])}</b>, {naQuando(R, pico)}.</P>}
      {lider && <P>{u === R.N - 1 ? 'No último período' : 'No último período com volume'}, o maior é <LinkModelo slug={lider.s} nome={nome(lider.s)} />, com <b>{fmtP(lider.share)}</b> do volume sozinho.</P>}
      <P>{h1 < 1500
        ? 'Implicação para roteamento: há substitutos próximos no topo, então ficar preso a um modelo específico é uma decisão, não uma inevitabilidade.'
        : 'Implicação para roteamento: com o tráfego concentrado em poucos modelos, a troca é mais cara, e vale ter a avaliação pronta antes que o líder mude.'}</P>
    </Leitura>
  );
}

/** A tabela da concentração abre quem são os cinco em cada período, como na v1. */
function TabelaConc({ R, nome }: { R: Recorte; nome: (s: string) => string }) {
  const gran = R.estado.gran;
  return (
    <details className="tab">
      <summary>Ver os números e quem são os cinco</summary>
      <div className="tabwrap" style={{ maxHeight: 300, overflowY: 'auto' }}>
        <table className="t">
          <thead><tr>
            <th>{gran === 'mes' ? 'Mês' : 'Semana'}</th><th className="num">Top 5</th><th className="num">HHI</th>
            {['1º', '2º', '3º', '4º', '5º'].map(c => <th key={c}>{c}</th>)}
          </tr></thead>
          <tbody>{[...R.eixo.keys()].reverse().map(i => {
            const m = R.top5_modelos[i] ?? [];
            return (
              <tr key={R.eixo[i]}>
                <td style={{ whiteSpace: 'nowrap' }}>{fPer(R.eixo[i], gran)}</td>
                <td className="num">{fmtP(R.top5[i])}</td>
                <td className="num">{R.hhi[i] || '—'}</td>
                {[0, 1, 2, 3, 4].map(k => (
                  <td key={k} style={{ whiteSpace: 'nowrap' }}>{m[k] ? <>{nome(m[k].s)} <span className="mono" style={{ color: 'var(--ink-3)' }}>{fmtP(m[k].share)}</span></> : '—'}</td>
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
  const nome = useNomes(D);
  const tot = R.weekly_total_T, u = R.N - 1, gran = R.estado.gran;
  const b = indiceBase(tot);
  const { adj } = per(R);
  const semVolume = b < 0;

  const tipConc = (i: number): LinhaTip[] => {
    const m = R.top5_modelos[i] ?? [];
    return [
      { rot: 'HHI', val: R.hhi[i] ? String(R.hhi[i]) : '—' },
      ...m.map((x, k) => ({ rot: `${k + 1}. ${nome(x.s)}`, val: fmtP(x.share) })),
      ...tipSemanas(R)(i),
    ];
  };

  return (
    <Secao id="s02" n="02" titulo="Tamanho e concentração do mercado"
      sub="Quanto o roteador processa, e quão espalhado esse volume está entre os modelos. É o denominador de todo share que aparece daqui para baixo.">
      <div className="grid2">
        <Cartao id="volume" titulo={gran === 'mes' ? 'Tokens por semana, média do mês' : 'Tokens por semana'}
          subtitulo={gran === 'mes'
            ? 'Trilhões de tokens por semana, em média dentro de cada mês. Modelos nomeados mais a linha agregada da fonte'
            : 'Trilhões de tokens processados em cada semana. Modelos nomeados mais a linha agregada da fonte'}>
          {semVolume ? <p className="vazio">Nenhum volume no recorte atual. Afrouxe o filtro ou amplie a janela.</p> : (
            <>
              <Temporal eixo={R.eixo} gran={gran} modo="area" fmt={fmtT} fmtEixo={eixoT} altura={230}
                series={[{ key: 'tot', label: gran === 'mes' ? 'Tokens por semana (média)' : 'Tokens na semana', values: tot, slot: '--s1', destaque: true }]}
                tipExtra={tipSemanas(R)}
                rotuloAria={`Volume ${gran === 'mes' ? 'semanal médio, por mês,' : 'semanal'} de tokens, de ${fmtT(tot[b])} em ${fPer(R.eixo[b], gran)} a ${fmtT(tot[u])} em ${fPer(R.eixo[u], gran)}, em ${R.N} períodos.`} />
              <TabelaSerie eixo={R.eixo} gran={gran} fmt={fmtT} series={[{ label: gran === 'mes' ? 'Tokens/semana (média)' : 'Tokens/semana', values: tot }]} />
              <LeituraVolume R={R} b={b} />
            </>
          )}
        </Cartao>

        <Cartao id="conc" subtitulo={`% do volume ${adj} capturado pelos 5 modelos mais usados; o tooltip mostra quem são e o HHI`}>
          {semVolume ? <p className="vazio">Nenhum volume no recorte atual, então não há o que concentrar.</p> : (
            <>
              <Temporal eixo={R.eixo} gran={gran} modo="area" fmt={v => fmtP(v)} fmtEixo={v => d3.format('d')(v) + '%'} ymax={100} altura={230}
                series={[{ key: 'top5', label: 'Share dos 5 maiores', values: R.top5.map((v, i) => (tot[i] > 0 ? v : null)), slot: '--s1', destaque: true }]}
                tipExtra={tipConc}
                rotuloAria={`Share dos 5 maiores modelos, de ${fmtP(R.top5[b])} em ${fPer(R.eixo[b], gran)} a ${fmtP(R.top5[u])} em ${fPer(R.eixo[u], gran)}. HHI de ${R.hhi[b]} para ${R.hhi[u]}.`} />
              <TabelaConc R={R} nome={nome} />
              <LeituraConc R={R} b={b} nome={nome} />
            </>
          )}
        </Cartao>
      </div>
    </Secao>
  );
}
