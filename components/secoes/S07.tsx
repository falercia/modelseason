'use client';
/**
 * Seção 07: para onde vai o dinheiro.
 *
 * Gasto é estimativa a preço de tabela, não medição. A fonte soma prompt e
 * completion sem separar, por isso a linha vem sempre com a banda piso/teto
 * (porte do spendChart() da v1). Volume contra dinheiro põe as duas medidas no
 * mesmo eixo percentual, nunca em dois eixos (porte do vsMoney() da v1). O
 * share do gasto por laboratório é novo na v2.
 */
import { useState } from 'react';
import * as d3 from 'd3';
import type { Mercado } from '@/lib/tipos';
import { rotuloLab, type Recorte, type Series } from '@/lib/engine';
import { Cartao, Secao } from '@/components/shell/Cartao';
import { useHistorico } from '@/components/shell/Historico';
import { Legenda, TabelaSerie, Temporal, cor, useLargura, type ItemSerie, type LinhaTip } from '@/components/graficos/base';
import { LAB_SLOT } from '@/lib/cores';
import { br, fPer, fmtP } from '@/lib/format';

/** Milhões de dólares: "US$ 120 mi", "US$ 1,2 bi", "US$ 0,06 mi". */
const fmtMi = (v: number) => {
  if (v == null || !isFinite(v)) return '—';
  if (v >= 1000) return 'US$ ' + br((v / 1000).toFixed(1)) + ' bi';
  return 'US$ ' + br(v >= 10 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v.toFixed(2)) + ' mi';
};
const fmtEixoMi = (v: number) => (v >= 1000 ? br(+(v / 1000).toFixed(1)) + ' bi' : br(+v.toFixed(1)) + ' mi');
const fmtPreco = (v: number) => 'US$ ' + br(d3.format('.2f')(v));

const perDe = (R: Recorte) => (R.estado.gran === 'mes'
  ? { um: 'mês', ult: 'no último mês', ini: 'no primeiro mês', semanal: 'por semana, na média de cada mês' }
  : { um: 'semana', ult: 'na última semana', ini: 'na primeira semana', semanal: 'por semana' });

/** "A, B e C" */
const lista = (xs: string[]) => (xs.length <= 1 ? xs.join('') : xs.slice(0, -1).join(', ') + ' e ' + xs[xs.length - 1]);
const Pill = () => <span className="pill" style={{ marginLeft: 0, marginRight: 6 }}>recorte</span>;

// ------------------------------------------------------------------ gasto estimado

function Gasto() {
  const { D, R } = useHistorico();
  const v = R.spend_total_musd, lo = R.spend_band.piso, hi = R.spend_band.teto, pe = R.preco_efetivo;
  const g = R.estado.gran, u = R.N - 1, p = perDe(R);
  const bl = D.blend ?? { prompt: 0.75, completion: 0.25 };
  const semPreco = R.faixa_preco_share['Não identificado'] ?? new Array(R.N).fill(0);
  const sub = `Milhões de dólares ${p.semanal}, a preço de tabela. A faixa vai de "tudo prompt" a "tudo completion"; a linha usa ${Math.round(bl.prompt * 100)}% prompt.`;
  const temGasto = (d3.max(v) ?? 0) > 0;
  const serie: ItemSerie[] = [{ key: 'e', label: 'Estimativa', values: v, slot: '--ink-2', destaque: true }];
  const tip = (i: number): LinhaTip[] => [
    { rot: 'Preço efetivo por 1M', val: fmtPreco(pe[i]) },
    { rot: 'Volume sem preço no catálogo', val: fmtP(semPreco[i]) },
    { rot: 'Volume em endpoint gratuito', val: fmtP(R.free_share[i]) },
  ];
  return (
    <Cartao id="spend" titulo={`Gasto ${g === 'mes' ? 'semanal médio' : 'semanal'} estimado`} subtitulo={sub}>
      {!temGasto ? <p className="vazio">Sem gasto estimável no recorte atual: os modelos selecionados não têm preço no catálogo ou só têm tráfego gratuito.</p> : (
        <>
          <Legenda itens={[{ key: 'e', label: 'Estimativa', slot: '--ink-2' }, { key: 'b', label: 'Faixa de piso a teto', slot: 'color-mix(in srgb, var(--ink-2) 22%, transparent)' }]} />
          <Temporal eixo={R.eixo} gran={g} series={serie} fmt={fmtMi} fmtEixo={fmtEixoMi} altura={260}
            banda={{ piso: lo, teto: hi, slot: '--ink-2' }} tipExtra={tip} m={{ t: 12, r: 14, b: 26, l: 52 }}
            rotuloAria={`Gasto estimado ${p.semanal}, de ${fmtMi(v[0])} em ${fPer(R.eixo[0], g)} a ${fmtMi(v[u])} em ${fPer(R.eixo[u], g)}, com faixa de ${fmtMi(lo[u])} a ${fmtMi(hi[u])} no último período.`} />
          <div className="leitura">
            {R.cobertura.filtrando && <Pill />}
            A preço de tabela, o tráfego {p.ult} da janela ({fPer(R.eixo[u], g)}) equivale a <b>{fmtMi(v[u])}</b> por semana, numa faixa de {fmtMi(lo[u])} a {fmtMi(hi[u])}.
            {' '}{p.ini.charAt(0).toUpperCase() + p.ini.slice(1)} ({fPer(R.eixo[0], g)}) eram {fmtMi(v[0])}. O preço efetivo foi de {fmtPreco(pe[0])} para <b>{fmtPreco(pe[u])}</b> por milhão de tokens.
            {' '}{semPreco[0] - semPreco[u] >= 10
              ? <>Boa parte da subida no começo da série é cobertura, não gasto: {fmtP(semPreco[0])} do volume inicial vinha de modelos sem preço no catálogo, que entram como zero, contra {fmtP(semPreco[u])} no fim.</>
              : <>Volume sem preço no catálogo, que entra como zero: {fmtP(semPreco[u])} no fim da janela.</>}
            {' '}Tráfego em endpoint gratuito ({fmtP(R.free_share[u])} no fim) também custa zero.
          </div>
          <div className="nao">
            <b>Preço de hoje aplicado ao passado.</b> O catálogo guarda só o preço vigente, então todo o histórico é recalculado com a tabela de hoje. Modelo que ficou mais barato tem o gasto passado superestimado, e o que encareceu, subestimado. A correção depende do histórico de preços, que ainda não existe.
          </div>
          <TabelaSerie eixo={R.eixo} gran={g} fmt={x => br(x.toFixed(2))}
            series={[{ label: 'Estimativa (US$ mi)', values: v }, { label: 'Piso (US$ mi)', values: lo }, { label: 'Teto (US$ mi)', values: hi }, { label: 'US$ por 1M tokens', values: pe }]} />
        </>
      )}
    </Cartao>
  );
}

// ------------------------------------------------------------------ volume contra dinheiro

const MIN_TOK = 0.5; // share de tokens mínimo para entrar nas barras, como na v1
const MAX_LABS = 10;

type LinhaVD = Recorte['volume_vs_dinheiro'][number];

function VolumeDinheiro() {
  const { R } = useHistorico();
  const g = R.estado.gran, u = R.N - 1, p = perDe(R);
  const rows = R.volume_vs_dinheiro.filter(r => r.share_tokens >= MIN_TOK).slice(0, MAX_LABS);
  const sub = `Share de tokens e share do gasto estimado ${p.ult} da janela (${fPer(R.eixo[u], g)}), laboratórios com pelo menos ${fmtP(MIN_TOK)} dos tokens. Barras iguais significam preço médio do mercado.`;
  if (!rows.length) return <Cartao id="vsmoney" subtitulo={sub}><p className="vazio">Sem laboratórios com volume suficiente no recorte atual.</p></Cartao>;
  return <BarrasPareadas rows={rows} sub={sub} R={R} />;
}

function BarrasPareadas({ rows, sub, R }: { rows: LinhaVD[]; sub: string; R: Recorte }) {
  const [ref, w] = useLargura<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const p = perDe(R);
  const estreito = w < 480;
  const m = { t: 18, r: estreito ? 50 : 64, b: 24, l: estreito ? 84 : 112 };
  const faixa = 34, h = m.t + m.b + rows.length * faixa;
  const max = (d3.max(rows, r => Math.max(r.share_tokens, r.share_gasto)) ?? 1) * 1.08;
  const x = d3.scaleLinear().domain([0, max]).nice(4).range([m.l, w - m.r]);
  const y = d3.scaleBand().domain(rows.map(r => r.lab)).range([m.t, h - m.b]).paddingInner(0.3).paddingOuter(0.1);
  const bh = Math.max(4, y.bandwidth() / 2 - 1);
  const fmtR = (r: number | null) => (r == null ? '—' : br(r.toFixed(2)) + '×');
  const TOK = '--s0', USD = '--ink-2';

  // leitura, como no readings() da v1, sem a frase fixa sobre origem
  const vd = R.volume_vs_dinheiro.filter(r => r.razao != null && r.share_tokens >= 1);
  const comPreco = vd.filter(r => (r.razao as number) > 0);
  const caro = [...comPreco].sort((a, b) => (b.razao as number) - (a.razao as number))[0];
  const barato = [...comPreco].sort((a, b) => (a.razao as number) - (b.razao as number))[0];
  const zerados = vd.filter(r => r.razao === 0);
  const tr = hover != null ? rows[hover] : null;

  return (
    <Cartao id="vsmoney" subtitulo={sub}>
      <Legenda itens={[{ key: 't', label: 'Share de tokens', slot: TOK }, { key: 'g', label: 'Share do gasto estimado', slot: USD }]} />
      <div className="plot" ref={ref} onPointerLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${w} ${h}`} style={{ height: h }} role="img"
          aria-label={`Barras pareadas por laboratório: share de tokens e share do gasto ${p.ult}. ${rows.map(r => `${rotuloLab(r.lab)}: ${fmtP(r.share_tokens)} dos tokens, ${fmtP(r.share_gasto)} do gasto`).join('; ')}.`}>
          <g className="grid">{x.ticks(4).map(t => <line key={t} x1={x(t)} x2={x(t)} y1={m.t} y2={h - m.b} />)}</g>
          <g className="ax">{x.ticks(4).map(t => <text key={t} x={x(t)} y={h - m.b + 15} textAnchor="middle">{t}%</text>)}</g>
          <text className="ax" x={w - m.r + 8} y={m.t - 6} style={{ fill: 'var(--ink-3)' }}>razão</text>
          {rows.map((r, i) => {
            const y0 = y(r.lab)!, forte = r.razao != null && r.razao >= 1.3;
            return (
              <g key={r.lab} opacity={hover != null && hover !== i ? 0.55 : 1}>
                <text x={m.l - 8} y={y0 + y.bandwidth() / 2 + 4} textAnchor="end" style={{ fill: 'var(--ink-2)', fontSize: 12 }}>{rotuloLab(r.lab)}</text>
                <rect x={m.l} y={y0} width={Math.max(1.5, x(r.share_tokens) - m.l)} height={bh} rx={2} fill={cor(TOK)} />
                <rect x={m.l} y={y0 + bh + 2} width={Math.max(1.5, x(r.share_gasto) - m.l)} height={bh} rx={2} fill={cor(USD)} />
                <text x={w - m.r + 8} y={y0 + y.bandwidth() / 2 + 4} className="mono"
                  style={{ fill: forte ? 'var(--ink)' : 'var(--ink-3)', fontWeight: forte ? 700 : 500, fontSize: 11.5 }}>{fmtR(r.razao)}</text>
                <rect x={0} y={y0 - 3} width={w} height={y.bandwidth() + 6} fill="transparent"
                  onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)} />
              </g>
            );
          })}
        </svg>
        {tr && hover != null && (
          <div className="tip" style={{ left: Math.min(m.l + 10, Math.max(0, w - 240)), top: (y(tr.lab) ?? 0) + y.bandwidth() + 4 }}>
            <div className="t">{rotuloLab(tr.lab)}</div>
            <div className="r"><span><i style={{ background: cor(TOK) }} />Share de tokens</span><b>{fmtP(tr.share_tokens)}</b></div>
            <div className="r"><span><i style={{ background: cor(USD) }} />Share do gasto</span><b>{fmtP(tr.share_gasto)}</b></div>
            <div className="r"><span>Razão gasto/tokens</span><b>{fmtR(tr.razao)}</b></div>
          </div>
        )}
      </div>
      <div className="leitura">
        {R.cobertura.filtrando && <Pill />}
        {caro && barato && caro.lab !== barato.lab ? (
          <>
            <b>{rotuloLab(caro.lab)}</b> tem {fmtP(caro.share_tokens)} dos tokens e <b>{fmtP(caro.share_gasto)}</b> do dinheiro, razão de <b>{fmtR(caro.razao)}</b>.
            {' '}No outro extremo, <b>{rotuloLab(barato.lab)}</b> tem {fmtP(barato.share_tokens)} dos tokens e {fmtP(barato.share_gasto)} do dinheiro, razão de {fmtR(barato.razao)}.
          </>
        ) : <>Poucos laboratórios com preço no recorte para comparar extremos.</>}
        {zerados.length > 0 && (
          <> {lista(zerados.map(r => rotuloLab(r.lab)))} {zerados.length === 1 ? 'aparece' : 'aparecem'} com gasto zero apesar do volume: todo o tráfego está em endpoint gratuito ou em modelo sem preço no catálogo.</>
        )}
        {' '}Share de tokens favorece quem cobra menos; para decisão de contrato, a razão diz mais, porque aproxima o posicionamento de preço de cada laboratório dentro do uso real.
      </div>
      <details className="tab">
        <summary>Ver os números</summary>
        <div className="tabwrap">
          <table className="t">
            <thead><tr><th>Laboratório</th><th className="num">Share de tokens</th><th className="num">Share do gasto</th><th className="num">Razão</th></tr></thead>
            <tbody>{rows.map(r => (
              <tr key={r.lab}><td>{rotuloLab(r.lab)}</td><td className="num">{fmtP(r.share_tokens)}</td><td className="num">{fmtP(r.share_gasto)}</td><td className="num">{fmtR(r.razao)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </details>
    </Cartao>
  );
}

// ------------------------------------------------------------------ gasto por laboratório

/** Quatro laboratórios com cor fixa (LAB_SLOT); todo o resto dobra em Outros. */
const NOMEADOS = Object.keys(LAB_SLOT).filter(k => k !== 'Outros');

function dobrar(S: Series, N: number) {
  const nomeados = NOMEADOS.filter(k => S[k]?.some(v => v > 0));
  const resto = Object.keys(S).filter(k => !nomeados.includes(k));
  const outros = Array.from({ length: N }, (_, i) => +resto.reduce((s, k) => s + (S[k][i] ?? 0), 0).toFixed(2));
  const series: ItemSerie[] = nomeados.map(k => ({ key: k, label: rotuloLab(k), values: S[k], slot: LAB_SLOT[k] }));
  if (outros.some(v => v > 0)) series.push({ key: 'Outros', label: 'Outros', values: outros, slot: '--s0' });
  // Quem está dentro de Outros, por período (o motor já dobrou além do 8º em "Outros").
  const dentro = (i: number) => resto.filter(k => k !== 'Outros').map(k => ({ k, v: S[k][i] ?? 0 })).filter(o => o.v > 0).sort((a, b) => b.v - a.v);
  return { series, dentro, resto };
}

function GastoLab() {
  const { R } = useHistorico();
  const g = R.estado.gran, u = R.N - 1;
  const S = R.spend_share;
  const temGasto = (d3.max(R.spend_total_musd) ?? 0) > 0;
  const { series, dentro } = dobrar(S, R.N);
  const tip = (i: number): LinhaTip[] => {
    const d = dentro(i);
    if (!d.length) return [];
    return [{ rot: 'dentro de Outros', val: '' }, ...d.slice(0, 4).map(o => ({ rot: '↳ ' + rotuloLab(o.k), val: fmtP(o.v) }))];
  };
  // leitura: maior fatia individual no início e no fim, inclusive a que está em Outros
  const individuais = Object.keys(S).filter(k => k !== 'Outros');
  const maior = (i: number) => [...individuais].sort((a, b) => (S[b][i] ?? 0) - (S[a][i] ?? 0))[0];
  const m0 = maior(0), mU = maior(u);
  const emOutros = mU && !NOMEADOS.includes(mU);
  const tokMU = R.volume_vs_dinheiro.find(r => r.lab === mU);
  const outrosU = series.find(s => s.key === 'Outros')?.values[u] ?? 0;
  return (
    <Cartao id="gasto-lab" novo>
      {!temGasto || !series.length ? <p className="vazio">Sem gasto estimável no recorte atual.</p> : (
        <>
          <Legenda itens={series} />
          <Temporal eixo={R.eixo} gran={g} series={series} modo="empilhada" ymax={100} altura={300} fmt={v => fmtP(v)} fmtEixo={v => v + '%'}
            tipExtra={tip} m={{ t: 10, r: 10, b: 26, l: 38 }}
            rotuloAria={`Área empilhada 100%: share do gasto estimado por laboratório, de ${fPer(R.eixo[0], g)} a ${fPer(R.eixo[u], g)}. ${series.map(s => `${s.label} ${fmtP(s.values[u] ?? 0)}`).join(', ')} no último período.`} />
          <div className="leitura">
            {R.cobertura.filtrando && <Pill />}
            {m0 && <>Em {fPer(R.eixo[0], g)}, a maior fatia do gasto era de <b>{rotuloLab(m0)}</b> ({fmtP(S[m0][0])}). </>}
            {mU && <>Em {fPer(R.eixo[u], g)}, é de <b>{rotuloLab(mU)}</b>, com <b>{fmtP(S[mU][u])}</b>{tokMU ? <> do dinheiro e {fmtP(tokMU.share_tokens)} dos tokens</> : null}. </>}
            {emOutros && <>{rotuloLab(mU)} não tem cor própria: as quatro cores fixas são dos laboratórios de maior volume acumulado ({lista(NOMEADOS.map(rotuloLab))}), e o resto dobra em Outros, que soma {fmtP(outrosU)} no fim. Passe o cursor para ver quem está dentro.</>}
          </div>
          <TabelaSerie eixo={R.eixo} gran={g} fmt={v => fmtP(v)}
            series={[...series.map(s => ({ label: s.label, values: s.values })), ...individuais.filter(k => !NOMEADOS.includes(k)).map(k => ({ label: '↳ ' + rotuloLab(k), values: S[k] }))]} />
        </>
      )}
    </Cartao>
  );
}

export default function S07(_: { M: Mercado }) {
  return (
    <Secao id="s07" n="07" titulo="Para onde vai o dinheiro"
      sub="Tokens multiplicados pelo preço de tabela de cada modelo. Estimativa, não medição: a fonte não separa prompt de completion, e o preço é o de hoje.">
      <Gasto />
      <div className="grid2" style={{ marginTop: 14 }}>
        <VolumeDinheiro />
        <GastoLab />
      </div>
    </Secao>
  );
}
