'use client';
/**
 * Seção 09: os três grandes, em abas. Na v1 esta seção era só "Posição da
 * Anthropic"; aqui OpenAI e Google ganham a mesma leitura, com o mesmo motor
 * (R.lab_share, R.comp_share, R.familias_abs) e as mesmas regras de cor.
 *
 * Nome de família (FAMILIAS, OUTROS_FAMILIA) é chave: dá cor por FAMILIA_SLOT.
 * Só o texto exibido passa por familia(nome).
 */
import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import * as d3 from 'd3';
import type { Mercado } from '@/lib/tipos';
import { Cartao, Modos, Secao } from '@/components/shell/Cartao';
import { useHistorico } from '@/components/shell/Historico';
import { useIdioma } from '@/components/shell/Idioma';
import { Legenda, TabelaSerie, Temporal, cor, useOcultos, type ItemSerie } from '@/components/graficos/base';
import { FAMILIAS, OUTROS_FAMILIA, familiaDe, type GrupoFamilias, type Recorte, type Vida } from '@/lib/engine';
import { FAMILIA_SLOT, LAB_SLOT, iniciais, slotLab } from '@/lib/cores';
import { rotulador } from './s09-nomes';
import { usePeriodo } from './s02-comum';
import { Abas, LegendaEnfase, LinhasEnfase, type LinhaEnfase } from './s09-abas';

type Kit = ReturnType<typeof useIdioma>;

// ------------------------------------------------------------------ utilidades

/**
 * Base de comparação da janela: o primeiro período em que o laboratório teve
 * volume que o display consegue mostrar. Mesma regra dos tiles da v1: sob
 * recorte, o primeiro período pode ter volume quase nulo e qualquer razão vira lixo.
 */
function baseDe(abs: number[] | undefined): number {
  if (!abs) return -1;
  const i = abs.findIndex(v => (v ?? 0) >= 0.005);
  return i >= 0 ? i : abs.findIndex(v => (v ?? 0) > 0);
}
const porSemana = (R: Recorte, t: Kit['t']) => (R.estado.gran === 'mes'
  ? t({ pt: 'por semana, na média do mês', en: 'per week, averaged over the month' })
  : t({ pt: 'por semana', en: 'per week' }));
const seta = (d: number) => (d > 0 ? '↑' : '↓');
/** Volume sem "0,00T": zero é zero, e quase nada é quase nada. */
const fmtT0 = (v: number, K: Kit) => (v <= 0 ? 'zero' : v < 0.005 ? K.t({ pt: 'menos de 0,01T', en: 'under 0.01T' }) : K.f.fmtT(v));
/** Primeira letra maiúscula, para frase que começa com "in the week of". */
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** "week" ou "weeks" para uma contagem inteira. */
const semanasEn = (n: number) => (n === 1 ? 'week' : 'weeks');

/** Variação sem verde nem vermelho: a seta diz a direção, o leitor decide se é bom. */
function Delta({ children }: { children: ReactNode }) {
  return <span className="mono" style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-3)', marginLeft: 8, whiteSpace: 'nowrap' }}>{children}</span>;
}

function Tile({ k, v, delta, d, marca }: { k: string; v: ReactNode; delta?: ReactNode; d: ReactNode; marca?: string }) {
  return (
    <div className="m">
      <div className="k">{k}</div>
      <div className="v" style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '0 2px' }}>
        {marca && <i aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 2, background: cor(marca), alignSelf: 'center', marginRight: 6, flex: '0 0 10px' }} />}
        <span style={{ minWidth: 0 }}>{v}</span>{delta}
      </div>
      <div className="d">{d}</div>
    </div>
  );
}

// ------------------------------------------------------------------ faixa de números

function Faixa({ R, g, base }: { R: Recorte; g: GrupoFamilias; base: number }) {
  const K = useIdioma();
  const { t, f, familia } = K;
  const { naQuando } = usePeriodo();
  const lab = g.lab, ult = R.N - 1, gran = R.estado.gran;
  const sh = R.lab_share[lab], ab = R.vendor_abs[lab], tot = R.weekly_total_T;
  const dSh = sh[ult] - sh[base];
  const rLab = ab[base] > 0 ? ab[ult] / ab[base] : null;
  const rTot = tot[base] > 0 ? tot[ult] / tot[base] : null;
  const pSem = porSemana(R, t);
  const dBase = f.fPer(R.eixo[base], gran);
  const desde = base > 0 ? t({ pt: `desde ${dBase}`, en: `since ${dBase}` }) : t({ pt: 'na janela', en: 'in the window' });
  const iPico = sh.indexOf(d3.max(sh) ?? 0);

  // Família que mais cresceu em volume absoluto. Razão favoreceria base minúscula
  // (de zero para qualquer coisa é infinito); trilhões ganhos é o que pesa no mix.
  const fams = Object.entries(R.familias_abs[lab] ?? {}).map(([k, s]) => ({ f: k, de: s[base] ?? 0, para: s[ult] ?? 0, d: (s[ult] ?? 0) - (s[base] ?? 0) }))
    .sort((a, b) => b.d - a.d);
  const top = fams[0];
  const cresceu = !!top && top.d > 0.0005;
  const rotCresceu = t({ pt: 'Família que mais cresceu', en: 'Family that grew most' });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: 12, marginBottom: 14 }}>
      <Tile k={t({ pt: `Share de ${g.rotulo} · ${f.fPer(R.eixo[ult], gran)}`, en: `${g.rotulo} share · ${f.fPer(R.eixo[ult], gran)}` })} v={f.fmtP(sh[ult])}
        delta={base < ult && Math.abs(dSh) >= 0.05
          ? <Delta>{seta(dSh)} {f.dec(Math.abs(dSh).toFixed(1))} pp {desde}</Delta>
          : base < ult ? <Delta>{t({ pt: 'estável', en: 'flat' })} {desde}</Delta> : null}
        d={base === ult
          ? t({ pt: 'único período com volume no recorte', en: 'only period with volume in the filtered view' })
          : t({
            pt: <>era {f.fmtP(sh[base])} em {dBase}{iPico !== ult && iPico !== base ? <>; pico de {f.fmtP(sh[iPico])} em {f.fPer(R.eixo[iPico], gran)}</> : null}</>,
            en: <>was {f.fmtP(sh[base])} {naQuando(R, base)}{iPico !== ult && iPico !== base ? <>; peak of {f.fmtP(sh[iPico])} {naQuando(R, iPico)}</> : null}</>,
          })} />
      <Tile k={`Volume ${pSem}`} v={f.fmtT(ab[ult])}
        delta={rLab && Math.abs(rLab - 1) >= 0.05 ? <Delta>{rLab > 1 ? '↑ ×' : '↓ ÷'}{f.fmtVez(rLab > 1 ? rLab : 1 / rLab)} {desde}</Delta> : null}
        d={t({
          pt: <>era {fmtT0(ab[base], K)}; o mercado {rTot && rTot >= 1 ? `multiplicou por ${f.fmtVez(rTot)}` : rTot ? `dividiu por ${f.fmtVez(1 / rTot)}` : 'não tem base'} no mesmo período</>,
          en: <>was {fmtT0(ab[base], K)}; {rTot && rTot >= 1 ? `the market grew ${f.fmtVez(rTot)}-fold` : rTot ? `the market shrank ${f.fmtVez(1 / rTot)}-fold` : 'the market has no baseline'} over the same period</>,
        })} />
      {top
        ? <Tile k={cresceu ? rotCresceu : t({ pt: 'Nenhuma família cresceu; a que menos caiu', en: 'No family grew; smallest decline' })} v={familia(top.f)} marca={FAMILIA_SLOT[lab]?.[top.f] ?? '--s0'}
            d={t({
              pt: <>{top.d >= 0 ? '+' : '−'}{f.fmtT(Math.abs(top.d))} {pSem} {desde}, de {fmtT0(top.de, K)} para {fmtT0(top.para, K)}</>,
              en: <>{top.d >= 0 ? '+' : '−'}{f.fmtT(Math.abs(top.d))} {pSem} {desde}, from {fmtT0(top.de, K)} to {fmtT0(top.para, K)}</>,
            })} />
        : <Tile k={rotCresceu} v="—" d={t({ pt: 'sem família com volume no recorte', en: 'no family with volume in the filtered view' })} />}
    </div>
  );
}

// ------------------------------------------------------------------ share contra concorrentes

const TRACOS_CINZA = [undefined, '6 3', '1.5 3.5'];

function CartaoShare({ R, g, base }: { R: Recorte; g: GrupoFamilias; base: number }) {
  const { t, f, lab: rotLab } = useIdioma();
  const { entre, naQuando } = usePeriodo();
  const { ocultos, alternar } = useOcultos();
  const lab = g.lab, ult = R.N - 1, gran = R.estado.gran;
  const cs = R.comp_share[lab] ?? {};
  // Os três maiores concorrentes no fim da janela, mais os outros dois grandes
  // quando estão no recorte: a seção compara os três, então eles não somem da tela.
  const conc = Object.keys(cs).filter(k => k !== lab).sort((a, b) => cs[b][ult] - cs[a][ult]);
  const top = conc.slice(0, 3);
  const grandes = FAMILIAS.map(x => x.lab).filter(k => k !== lab && cs[k] && !top.includes(k));
  let cinza = 0;
  const linhas: LinhaEnfase[] = [
    { key: lab, label: g.rotulo, values: R.lab_share[lab], slot: 'ink', foco: true },
    ...[...top, ...grandes].map(k => {
      const slot = LAB_SLOT[k] ?? '--s0';
      return { key: k, label: rotLab(k), values: cs[k], slot, traco: slot === '--s0' ? TRACOS_CINZA[Math.min(2, cinza++)] : undefined };
    }),
  ];
  const vis = linhas.filter(l => !ocultos.has(l.key));

  // Leitura: share e volume absoluto no mesmo período. Share cai quando o denominador explode.
  const sh = R.lab_share[lab], ab = R.vendor_abs[lab], tot = R.weekly_total_T;
  const s0 = sh[base], s1 = sh[ult], a0 = ab[base], a1 = ab[ult];
  const rLab = a0 > 0 ? a1 / a0 : null, rTot = tot[base] > 0 ? tot[ult] / tot[base] : null;
  const d0 = f.fPer(R.eixo[base], gran), d1 = f.fPer(R.eixo[ult], gran);
  const e0 = naQuando(R, base), e1 = naQuando(R, ult);
  const iPico = sh.indexOf(d3.max(sh) ?? 0);
  const ordem = Object.keys(cs).sort((a, b) => cs[b][ult] - cs[a][ult]);
  const pos = ordem.indexOf(lab) + 1; // só é a posição real se couber entre os 9 do recorte
  const vez = (r: number | null) => (r == null ? '' : r >= 1 ? `×${f.fmtVez(r)}` : `÷${f.fmtVez(1 / r)}`);
  const pSem = porSemana(R, t);
  const P = (v: number) => <b>{f.fmtP(v)}</b>;
  let texto: ReactNode;
  if (base === ult) texto = t({
    pt: <>{g.rotulo} só tem volume no último período do recorte: {P(s1)} em {d1}, com {f.fmtT(a1)} {pSem}.</>,
    en: <>{g.rotulo} only has volume in the last period of the filtered view: {P(s1)} {e1}, with {f.fmtT(a1)} {pSem}.</>,
  });
  else if (s1 < s0 - 0.05 && a1 > a0) texto = t({
    pt: <>O share de {g.rotulo} caiu de {P(s0)} em {d0} para {P(s1)} em {d1}, mas o volume absoluto subiu de {f.fmtT(a0)} para <b>{f.fmtT(a1)}</b> {pSem} ({vez(rLab)}). O mercado inteiro fez {vez(rTot)} no mesmo período: o share caiu porque o denominador cresceu mais rápido, não porque o uso encolheu.</>,
    en: <>{g.rotulo}&apos;s share fell from {P(s0)} {e0} to {P(s1)} {e1}, but absolute volume rose from {f.fmtT(a0)} to <b>{f.fmtT(a1)}</b> {pSem} ({vez(rLab)}). The market as a whole expanded {rTot ? `${f.fmtVez(rTot)}×` : ''} over the same period: share fell because the denominator grew faster, not because usage shrank.</>,
  });
  else if (s1 < s0 - 0.05) texto = t({
    pt: <>{g.rotulo} perdeu nas duas medidas: o share foi de {P(s0)} para {P(s1)} e o volume absoluto de {f.fmtT(a0)} para <b>{f.fmtT(a1)}</b> {pSem}, entre {d0} e {d1}. Nesta janela a queda não é efeito do denominador: o volume absoluto também caiu.</>,
    en: <>{g.rotulo} lost on both measures: share went from {P(s0)} to {P(s1)} and absolute volume from {f.fmtT(a0)} to <b>{f.fmtT(a1)}</b> {pSem}, {entre(R, base, ult)}. In this window the drop is not a denominator effect: absolute volume fell too.</>,
  });
  else if (s1 > s0 + 0.05) {
    const acima = rLab != null && rTot != null && rLab > rTot;
    texto = t({
      pt: <>O share de {g.rotulo} subiu de {P(s0)} em {d0} para {P(s1)} em {d1}. O volume absoluto foi de {f.fmtT(a0)} para <b>{f.fmtT(a1)}</b> {pSem} ({vez(rLab)}), {acima ? 'mais' : 'menos'} que o mercado ({vez(rTot)}).</>,
      en: <>{g.rotulo}&apos;s share rose from {P(s0)} {e0} to {P(s1)} {e1}. Absolute volume went from {f.fmtT(a0)} to <b>{f.fmtT(a1)}</b> {pSem} ({vez(rLab)}), {acima ? 'outpacing' : 'trailing'} the market ({vez(rTot)}).</>,
    });
  } else texto = t({
    pt: <>O share de {g.rotulo} ficou praticamente estável entre {d0} e {d1}, em torno de {P(s1)}, com o volume indo de {f.fmtT(a0)} para <b>{f.fmtT(a1)}</b> {pSem}, no ritmo do mercado ({vez(rTot)}).</>,
    en: <>{g.rotulo}&apos;s share held roughly flat {entre(R, base, ult)}, around {P(s1)}, with volume going from {f.fmtT(a0)} to <b>{f.fmtT(a1)}</b> {pSem}, in step with the market ({vez(rTot)}).</>,
  });

  return (
    <Cartao id="fam-share" subtitulo={t({
      pt: <>% do volume {gran === 'mes' ? 'mensal' : 'semanal'}; {g.rotulo} em destaque, contra os três maiores concorrentes e os outros grandes</>,
      en: <>% of {gran === 'mes' ? 'monthly' : 'weekly'} volume; {g.rotulo} highlighted against its three largest competitors and the rest of the Big Three</>,
    })}>
      <LegendaEnfase linhas={linhas} ocultos={ocultos} alternar={alternar} valor={l => f.fmtP(l.values[ult])} />
      <LinhasEnfase eixo={R.eixo} gran={gran} linhas={vis}
        rotuloAria={t({
          pt: `Share de ${g.rotulo} contra ${linhas.slice(1).map(l => l.label).join(', ')}, de ${d0} a ${d1}. ${g.rotulo} termina em ${f.fmtP(s1)}.`,
          en: `${g.rotulo} share against ${f.lista(linhas.slice(1).map(l => l.label))}, from ${d0} to ${d1}. ${g.rotulo} ends at ${f.fmtP(s1)}.`,
        })} />
      <TabelaSerie eixo={R.eixo} gran={gran} series={linhas.map(l => ({ label: l.label, values: l.values }))} fmt={v => f.fmtP(v)} />
      <p className="leitura">
        {texto}
        {iPico !== ult && iPico !== base && t({
          pt: <> O pico na janela foi <b>{f.fmtP(sh[iPico])}</b>, em {f.fPer(R.eixo[iPico], gran)}.</>,
          en: <> The peak in the window was <b>{f.fmtP(sh[iPico])}</b>, {naQuando(R, iPico)}.</>,
        })}
        {pos >= 1 && pos <= 8 && t({
          pt: <> No último período, é o {pos}º maior laboratório do recorte.</>,
          en: <> In the last period, it is the {pos === 1 ? 'largest' : `${f.ord(pos)} largest`} lab in the filtered view.</>,
        })}
      </p>
    </Cartao>
  );
}

// ------------------------------------------------------------------ volume por família

function CartaoVolume({ R, g, base }: { R: Recorte; g: GrupoFamilias; base: number }) {
  const { t, f, familia } = useIdioma();
  const { naQuando } = usePeriodo();
  const { ocultos, alternar } = useOcultos();
  const lab = g.lab, ult = R.N - 1, gran = R.estado.gran;
  const fam = R.familias_abs[lab] ?? {};
  const slots = FAMILIA_SLOT[lab] ?? {};
  // key é o nome da família no motor (dá a cor); label é o nome no idioma.
  const todas: ItemSerie[] = Object.keys(fam).map(k => ({ key: k, label: familia(k), values: fam[k], slot: slots[k] ?? '--s0' }));
  const vis = todas.filter(s => !ocultos.has(s.key));
  const total = (i: number, ss = todas) => ss.reduce((s, x) => s + (x.values[i] ?? 0), 0);
  const nomeadas = todas.filter(s => s.slot !== '--s0').map(s => s.label.replace(/ \(.*\)$/, ''));
  const temCinza = todas.some(s => s.slot === '--s0');
  const nomes = t({
    pt: nomeadas.length ? nomeadas.join(', ') + (temCinza ? ' e o resto em cinza' : '') : 'só a faixa cinza',
    en: nomeadas.length ? f.lista(temCinza ? [...nomeadas, 'the rest in gray'] : nomeadas) : 'only the gray band',
  });
  const pSem = porSemana(R, t);

  const t1 = total(ult), t0 = total(base);
  const mix = (i: number, tt: number) => todas.map(s => ({ f: s.key, p: tt > 0 ? 100 * (s.values[i] ?? 0) / tt : 0 }));
  const m1 = mix(ult, t1).sort((a, b) => b.p - a.p), m0 = mix(base, t0);
  const mud = m1.map(x => ({ f: x.f, de: m0.find(y => y.f === x.f)?.p ?? 0, para: x.p }))
    .map(x => ({ ...x, d: x.para - x.de })).sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0];
  const maior0 = [...m0].sort((a, b) => b.p - a.p)[0];
  const visiveis = m1.filter(x => x.p >= 0.05);
  const listaMix = visiveis.map((x, i, a) => <span key={x.f}>{familia(x.f)} {f.fmtP(x.p)}{i < a.length - 1 ? ', ' : '.'}</span>);
  const dUlt = f.fPer(R.eixo[ult], gran), dBase = f.fPer(R.eixo[base], gran);

  return (
    <Cartao id="fam-volume" subtitulo={t({ pt: <>Trilhões de tokens {pSem}, por família: {nomes}</>, en: <>Trillions of tokens {pSem}, by family: {nomes}</> })}>
      <Legenda itens={todas} ocultos={ocultos} alternar={alternar} />
      <Temporal eixo={R.eixo} gran={gran} series={vis} modo="empilhada" fmt={f.fmtT} altura={260}
        tipExtra={i => [{ rot: 'Total', val: f.fmtT(total(i, vis)) }]}
        rotuloAria={t({
          pt: `Volume de ${g.rotulo} por família, em trilhões de tokens ${pSem}, de ${f.fPer(R.eixo[0], gran)} a ${dUlt}. Total no último período: ${f.fmtT(t1)}.`,
          en: `${g.rotulo} volume by family, in trillions of tokens ${pSem}, from ${f.fPer(R.eixo[0], gran)} to ${dUlt}. Total in the last period: ${f.fmtT(t1)}.`,
        })} />
      <TabelaSerie eixo={R.eixo} gran={gran} series={[...todas.map(s => ({ label: s.label, values: s.values })), { label: 'Total', values: R.eixo.map((_, i) => total(i)) }]} fmt={f.fmtT} />
      <p className="leitura">
        {t1 > 0 && visiveis.length === 1
          ? t({
            pt: <>Todo o volume de {g.rotulo} no recorte, {f.fmtT(t1)} {pSem} em {dUlt}, é de <b>{familia(m1[0].f)}</b>.</>,
            en: <>All of {g.rotulo}&apos;s volume in the filtered view, {f.fmtT(t1)} {pSem} {naQuando(R, ult)}, comes from <b>{familia(m1[0].f)}</b>.</>,
          })
          : t1 > 0
          ? t({
            pt: <>Em {dUlt}, <b>{familia(m1[0].f)}</b> concentra <b>{f.fmtP(m1[0].p)}</b> dos {f.fmtT(t1)} de {g.rotulo}. O mix: {listaMix}</>,
            en: <>{cap(naQuando(R, ult))}, <b>{familia(m1[0].f)}</b> accounts for <b>{f.fmtP(m1[0].p)}</b> of {g.rotulo}&apos;s {f.fmtT(t1)}. The mix: {listaMix}</>,
          })
          : t({ pt: <>{g.rotulo} não tem volume no último período do recorte.</>, en: <>{g.rotulo} has no volume in the last period of the filtered view.</> })}
        {base < ult && t0 > 0 && maior0 && visiveis.length > 1 && t({
          pt: <> Em {dBase}, a maior era {familia(maior0.f)}, com {f.fmtP(maior0.p)}.</>,
          en: <> {cap(naQuando(R, base))}, the largest was {familia(maior0.f)}, at {f.fmtP(maior0.p)}.</>,
        })}
        {base < ult && t0 > 0 && mud && Math.abs(mud.d) >= 1 && t({
          pt: <> A maior mudança de mix foi <b>{familia(mud.f)}</b>, de {f.fmtP(mud.de)} para {f.fmtP(mud.para)} do volume do laboratório.</>,
          en: <> The biggest mix shift was <b>{familia(mud.f)}</b>, from {f.fmtP(mud.de)} to {f.fmtP(mud.para)} of the lab&apos;s volume.</>,
        })}
      </p>
    </Cartao>
  );
}

// ------------------------------------------------------------------ semanas no top 10

type OrdemTop = 'valor' | 'estreia';

function CartaoTop10({ D, g }: { D: { life: Vida[]; weeks: string[] }; g: GrupoFamilias }) {
  const { t, f, modelo, familia } = useIdioma();
  const [ordem, setOrdem] = useState<OrdemTop>('valor');
  const [todos, setTodos] = useState(false);
  const [hv, setHv] = useState<{ i: number; top: number } | null>(null);
  const hover = hv?.i ?? null;
  const lab = g.lab, slots = FAMILIA_SLOT[lab] ?? {};
  const base = D.life.filter(m => m.vendor === lab && !/beta|thinking/.test(m.model) && m.weeks_in_top10 > 0)
    .map(m => ({ ...m, fam: familiaDe(g, m.model) }));
  const rot = rotulador(base.map(m => m.model), f);
  const linhas = [...base].sort(ordem === 'valor'
    ? (a, b) => b.weeks_in_top10 - a.weeks_in_top10 || (a.first < b.first ? -1 : 1)
    : (a, b) => (a.first < b.first ? -1 : a.first > b.first ? 1 : 0) || b.weeks_in_top10 - a.weeks_in_top10);
  const max = d3.max(linhas, l => l.weeks_in_top10) ?? 1;
  const LIMITE = 12;
  const vistas = todos ? linhas : linhas.slice(0, LIMITE);
  const famsPresentes = [...g.familias.map(x => x.nome), OUTROS_FAMILIA[lab] ?? 'Outros'].filter(k => linhas.some(l => l.fam === k));
  const desde = f.fMes(D.weeks[0]);
  const longevo = [...base].sort((a, b) => b.weeks_in_top10 - a.weeks_in_top10)[0];
  const recente = [...base].sort((a, b) => (a.first < b.first ? 1 : -1))[0];
  const vivos = base.filter(m => m.still_alive).length;
  const unSem = t({ pt: 'sem', en: 'wk' });
  const acima = t({ pt: 'acima de metade do pico', en: 'above half its peak' });
  const abaixo = t({ pt: 'abaixo de metade do pico', en: 'below half its peak' });

  return (
    <Cartao id="fam-top10"
      subtitulo={t({
        pt: <>{ordem === 'valor' ? 'Do maior para o menor' : 'Por ordem de estreia no ranking'}, modelos {g.rotulo} que chegaram ao top 10. Histórico completo desde {desde}: não responde à janela nem aos filtros</>,
        en: <>{g.rotulo} models that reached the top 10, {ordem === 'valor' ? 'most weeks first' : 'in order of ranking debut'}. Full history since {desde}: does not respond to the window or the filters</>,
      })}
>
      {!linhas.length
        ? <p className="vazio">{t({
          pt: <>Nenhum modelo {g.rotulo} passou pelo top 10 no histórico com pico de share suficiente para entrar no ciclo de vida.</>,
          en: <>No {g.rotulo} model has been in the top 10 with a share peak high enough to enter the lifecycle data.</>,
        })}</p>
        : <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '4px 12px', flexWrap: 'wrap', marginBottom: 4 }}>
            <Legenda itens={famsPresentes.map(k => ({ key: k, label: familia(k), slot: slots[k] ?? '--s0' }))} />
            <Modos valor={ordem} onChange={setOrdem} rotulo={t({ pt: 'Ordenação', en: 'Sort by' })}
              opcoes={[['valor', t({ pt: 'Permanência', en: 'Longevity' })], ['estreia', t({ pt: 'Estreia', en: 'Debut' })]]} />
          </div>
          <div className="plot" role="group" onPointerLeave={() => setHv(null)}
            aria-label={t({
              pt: `Semanas no top 10 de ${linhas.length} modelos ${g.rotulo}. O mais longevo é ${rot(longevo.model)}, com ${longevo.weeks_in_top10} semanas.`,
              en: `Weeks in the top 10 for ${linhas.length} ${g.rotulo} ${linhas.length === 1 ? 'model' : 'models'}. The longest-running is ${rot(longevo.model)}, with ${longevo.weeks_in_top10} ${semanasEn(longevo.weeks_in_top10)}.`,
            })}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,min(190px,45%)) minmax(0,1fr) auto', gap: '5px 10px', alignItems: 'center', fontSize: 12.5 }}>
              {vistas.map((l, i) => {
                const entra = (e: React.PointerEvent<HTMLElement>) => setHv({ i, top: e.currentTarget.offsetTop });
                return (
                  <div key={l.model} style={{ display: 'contents' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.model} onPointerEnter={entra}>
                      <Link prefetch={false} href={modelo(l.model)} style={{ color: 'var(--ink)', textDecoration: 'none' }}>{rot(l.model)}</Link>
                    </span>
                    <span style={{ display: 'block', background: 'var(--grid)', borderRadius: 2, height: 10 }} onPointerEnter={entra}>
                      <i style={{ display: 'block', height: 10, borderRadius: 2, width: `${(100 * l.weeks_in_top10 / max).toFixed(1)}%`, background: cor(slots[l.fam] ?? '--s0'), opacity: hover == null || hover === i ? 1 : 0.45 }} />
                    </span>
                    <span className="mono" style={{ fontSize: 11.5, color: 'var(--ink-2)', textAlign: 'right', whiteSpace: 'nowrap' }} onPointerEnter={entra}>
                      {ordem === 'estreia' && <span style={{ color: 'var(--ink-3)', marginRight: 6 }}>{f.fMes(l.first)}</span>}
                      {l.weeks_in_top10} {unSem}{l.still_alive
                        ? <span title={t({ pt: 'ainda acima de metade do pico', en: 'still above half its peak' })}> ●</span>
                        : <span aria-hidden="true" style={{ visibility: 'hidden' }}> ●</span>}
                    </span>
                  </div>
                );
              })}
            </div>
            {hover != null && linhas[hover] && (
              <div className="tip" style={{ right: 0, top: (hv?.top ?? 0) + 22 }}>
                <div className="t">{rot(linhas[hover].model)}</div>
                <div className="r"><span><i style={{ background: cor(slots[linhas[hover].fam] ?? '--s0') }} />{t({ pt: 'Família', en: 'Family' })}</span><b>{familia(linhas[hover].fam)}</b></div>
                <div className="r"><span>{t({ pt: 'Semanas no top 10', en: 'Weeks in the top 10' })}</span><b>{linhas[hover].weeks_in_top10}</b></div>
                <div className="r"><span>{t({ pt: 'Estreia no ranking', en: 'Ranking debut' })}</span><b>{f.fD(linhas[hover].first)}</b></div>
                <div className="r"><span>{t({ pt: 'Pico de share', en: 'Peak share' })}</span><b>{t({
                  pt: <>{f.fmtP(linhas[hover].peak_share)} em {f.fD(linhas[hover].peak_week)}</>,
                  en: <>{f.fmtP(linhas[hover].peak_share)}, week of {f.fD(linhas[hover].peak_week)}</>,
                })}</b></div>
                <div className="r"><span>{t({ pt: 'Situação', en: 'Status' })}</span><b>{linhas[hover].still_alive ? acima : abaixo}</b></div>
              </div>
            )}
          </div>
          {linhas.length > LIMITE && (
            <button type="button" className="tbtn" style={{ marginTop: 8 }} aria-expanded={todos} onClick={() => setTodos(v => !v)}>
              {todos
                ? t({ pt: `Mostrar só os ${LIMITE} primeiros`, en: `Show only the first ${LIMITE}` })
                : t({ pt: `Mostrar os ${linhas.length} modelos`, en: `Show all ${linhas.length} models` })}
            </button>
          )}
          <p className="nota" style={{ marginTop: 6 }}>{t({
            pt: '● ainda acima de metade do próprio pico na última semana: a contagem desses modelos pode crescer.',
            en: '● still above half its own peak in the latest week: the count for these models can still grow.',
          })}</p>
          <details className="tab">
            <summary>{t({ pt: 'Ver os números', en: 'See the numbers' })}</summary>
            <div className="tabwrap">
              <table className="t">
                <thead><tr>
                  <th>{t({ pt: 'Modelo', en: 'Model' })}</th><th>{t({ pt: 'Família', en: 'Family' })}</th>
                  <th className="num">{t({ pt: 'Semanas no top 10', en: 'Weeks in the top 10' })}</th><th className="num">{t({ pt: 'Estreia', en: 'Debut' })}</th>
                  <th className="num">{t({ pt: 'Pico de share', en: 'Peak share' })}</th>
                </tr></thead>
                <tbody>{linhas.map(l => (
                  <tr key={l.model}><td><Link prefetch={false} href={modelo(l.model)}>{rot(l.model)}</Link></td><td>{familia(l.fam)}</td><td className="num">{l.weeks_in_top10}</td><td className="num">{f.fD(l.first)}</td><td className="num">{f.fmtP(l.peak_share)}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </details>
          <p className="leitura">
            {t({
              pt: <><b><Link prefetch={false} href={modelo(longevo.model)} style={{ color: 'inherit' }}>{rot(longevo.model)}</Link></b> é o mais longevo de {g.rotulo} no topo, com <b>{longevo.weeks_in_top10} semanas</b> entre os 10 mais usados.</>,
              en: <><b><Link prefetch={false} href={modelo(longevo.model)} style={{ color: 'inherit' }}>{rot(longevo.model)}</Link></b> is {g.rotulo}&apos;s longest-running model at the top, with <b>{longevo.weeks_in_top10} {semanasEn(longevo.weeks_in_top10)}</b> among the 10 most used.</>,
            })}
            {recente && recente.model !== longevo.model && t({
              pt: <> O de estreia mais recente, <Link prefetch={false} href={modelo(recente.model)} style={{ color: 'inherit' }}>{rot(recente.model)}</Link> ({f.fMes(recente.first)}), soma {recente.weeks_in_top10} {recente.weeks_in_top10 === 1 ? 'semana' : 'semanas'}{recente.still_alive ? ' e segue acima de metade do pico' : ''}.</>,
              en: <> The most recent debut, <Link prefetch={false} href={modelo(recente.model)} style={{ color: 'inherit' }}>{rot(recente.model)}</Link> ({f.fMes(recente.first)}), has {recente.weeks_in_top10} {semanasEn(recente.weeks_in_top10)} in the top 10{recente.still_alive ? ' and is still above half its peak' : ''}.</>,
            })}
            {' '}{vivos === 1
              ? t({ pt: `1 de ${base.length} ainda está acima de metade do próprio pico, então a permanência dele está em aberto.`, en: `1 of ${base.length} is still above half its own peak, so its run is still open.` })
              : vivos > 1
              ? t({ pt: `${vivos} de ${base.length} ainda estão acima de metade do próprio pico, então a permanência deles está em aberto.`, en: `${vivos} of ${base.length} are still above half their own peak, so their runs are still open.` })
              : t({ pt: `Nenhum dos ${base.length} está acima de metade do próprio pico hoje.`, en: `None of the ${base.length} is above half its own peak today.` })}
          </p>
        </>}
    </Cartao>
  );
}

// ------------------------------------------------------------------ painel de um laboratório

function Painel({ g }: { g: GrupoFamilias }) {
  const { t } = useIdioma();
  const { D, R } = useHistorico();
  const abs = R.vendor_abs[g.lab];
  const temVolume = !!abs && abs.some(v => v > 0);
  const base = baseDe(abs);
  return (
    <>
      {temVolume && base >= 0
        ? <>
          <Faixa R={R} g={g} base={base} />
          <CartaoShare R={R} g={g} base={base} />
          <div className="grid2" style={{ marginTop: 14 }}>
            <CartaoVolume R={R} g={g} base={base} />
            <CartaoTop10 D={D} g={g} />
          </div>
        </>
        : <>
          <p className="vazio" style={{ marginBottom: 14 }}>
            {R.cobertura.filtrando
              ? t({
                pt: <>{g.rotulo} não tem nenhum modelo no recorte atual dos filtros de modelo, então share, volume e famílias ficam vazios em vez de aparecer como zero. Limpe os filtros para ver a leitura do laboratório.</>,
                en: <>{g.rotulo} has no models in the current model filters, so share, volume and families stay empty instead of showing as zero. Clear the filters to see this lab&apos;s numbers.</>,
              })
              : t({
                pt: <>{g.rotulo} não tem volume nesta janela, então share, volume e famílias ficam vazios em vez de aparecer como zero.</>,
                en: <>{g.rotulo} has no volume in this window, so share, volume and families stay empty instead of showing as zero.</>,
              })}
            {' '}{t({
              pt: 'A permanência no top 10, abaixo, é histórico completo e não depende do recorte.',
              en: 'Time in the top 10, below, uses the full history and does not depend on the filtered view.',
            })}
          </p>
          <CartaoTop10 D={D} g={g} />
        </>}
    </>
  );
}

/**
 * O seletor de laboratório. Na primeira versão eram abas de texto, e o leitor
 * não percebia que dava para clicar. Agora cada laboratório é um cartão com a
 * cor da entidade, o share no fim da janela, a variação e a curva, e o
 * selecionado se liga visualmente ao painel de baixo.
 */
function CartaoLab({ g, R }: { g: GrupoFamilias; R: Recorte }) {
  const { t, f, familia } = useIdioma();
  const sh = R.lab_share[g.lab] ?? [];
  const ult = R.N - 1;
  const i0 = baseDe(R.vendor_abs[g.lab]);
  const agora = sh[ult] ?? 0;
  const d = i0 >= 0 && i0 < ult ? agora - (sh[i0] ?? 0) : null;
  const slot = slotLab(g.lab);
  const w = 120, h = 30;
  const max = d3.max(sh) || 1;
  const x = d3.scaleLinear().domain([0, Math.max(1, sh.length - 1)]).range([1, w - 1]);
  const y = d3.scaleLinear().domain([0, max]).range([h - 2, 2]);
  const linha = d3.line<number>().x((_, i) => x(i)).y(v => y(v ?? 0))(sh) ?? '';
  const area = d3.area<number>().x((_, i) => x(i)).y0(h).y1(v => y(v ?? 0))(sh) ?? '';
  const familias = g.familias.map(x => familia(x.nome).replace(/ \(.*\)$/, '').replace(/^Gemini /, '')).slice(0, 4).join(' · ');
  return (
    <span className="lab-c" style={{ ['--lab' as string]: cor(slot) }}>
      <span className="lab-top">
        <span className="ico" style={{ background: cor(slot) }} aria-hidden="true">{iniciais(g.rotulo)}</span>
        <span className="lab-nome">{g.rotulo}</span>
        <span className="lab-seta" aria-hidden="true" />
      </span>
      <span className="lab-num">
        <span className="lab-v">{agora ? f.fmtP(agora) : '—'}</span>
        {d != null && Math.abs(d) >= 0.05 && <span className="lab-d">{seta(d)} {f.dec(Math.abs(d).toFixed(1))} pp {t({ pt: 'na janela', en: 'in the window' })}</span>}
      </span>
      <svg className="lab-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
        <path d={area} fill={cor(slot)} opacity={0.14} />
        <path d={linha} fill="none" stroke={cor(slot)} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="lab-fam">{familias}</span>
      <span className="lab-cta"><span className="on">{t({ pt: 'Mostrando abaixo', en: 'Showing below' })}</span><span className="off">{t({ pt: `Ver ${g.rotulo} →`, en: `View ${g.rotulo} →` })}</span></span>
    </span>
  );
}

export default function S09(_: { M: Mercado }) {
  const { R } = useHistorico();
  const { t, f } = useIdioma();
  const { naQuando } = usePeriodo();
  const ult = R.N - 1;
  const soma = FAMILIAS.reduce((s, g) => s + (R.lab_share[g.lab]?.[ult] ?? 0), 0);
  return (
    <Secao id="s09" n="09" titulo={t({ pt: 'Os três grandes: Anthropic, OpenAI e Google', en: 'The Big Three: Anthropic, OpenAI and Google' })}
      sub={t({
        pt: <>A mesma leitura para os três: share contra os concorrentes, volume por família de modelo e permanência no top 10.
          {soma > 0 ? <> Juntos, somam <b>{f.fmtP(soma)}</b> do volume{R.cobertura.filtrando ? ' do recorte' : ''} em {f.fPer(R.eixo[ult], R.estado.gran)}.</> : <> Nenhum dos três tem volume no recorte atual.</>}</>,
        en: <>The same breakdown for all three: share against competitors, volume by model family and time in the top 10.
          {soma > 0 ? <> Together they hold <b>{f.fmtP(soma)}</b> of {R.cobertura.filtrando ? "the filtered view's volume" : 'volume'} {naQuando(R, ult)}.</> : <> None of the three has volume in the current filtered view.</>}</>,
      })}>
      <p className="kicker" style={{ marginBottom: 8 }}>{t({ pt: 'Escolha o laboratório', en: 'Pick a lab' })}</p>
      <Abas prefixo="s09" rotulo={t({ pt: 'Laboratório', en: 'Lab' })} classe="abas-lab" itens={FAMILIAS.map(g => ({
        id: g.lab,
        rotulo: <CartaoLab g={g} R={R} />,
        conteudo: <Painel g={g} />,
      }))} />
    </Secao>
  );
}
