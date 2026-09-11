'use client';
/**
 * Seção 09: os três grandes, em abas. Na v1 esta seção era só "Posição da
 * Anthropic"; aqui OpenAI e Google ganham a mesma leitura, com o mesmo motor
 * (R.lab_share, R.comp_share, R.familias_abs) e as mesmas regras de cor.
 */
import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import * as d3 from 'd3';
import type { Mercado } from '@/lib/tipos';
import { Cartao, Modos, Secao } from '@/components/shell/Cartao';
import { useHistorico } from '@/components/shell/Historico';
import { Legenda, TabelaSerie, Temporal, cor, useOcultos, type ItemSerie } from '@/components/graficos/base';
import { FAMILIAS, OUTROS_FAMILIA, familiaDe, rotuloLab, type GrupoFamilias, type Recorte, type Vida } from '@/lib/engine';
import { FAMILIA_SLOT, LAB_SLOT } from '@/lib/cores';
import { br, curto, fD, fMes, fPer, fmtP, fmtT, fmtVez, urlModelo } from '@/lib/format';
import { rotulador } from './s09-nomes';
import { Abas, LegendaEnfase, LinhasEnfase, type LinhaEnfase } from './s09-abas';

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
const porSemana = (R: Recorte) => (R.estado.gran === 'mes' ? 'por semana, na média do mês' : 'por semana');
const seta = (d: number) => (d > 0 ? '↑' : '↓');
/** Volume sem "0,00T": zero é zero, e quase nada é quase nada. */
const fmtT0 = (v: number) => (v <= 0 ? 'zero' : v < 0.005 ? 'menos de 0,01T' : fmtT(v));

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
  const lab = g.lab, ult = R.N - 1;
  const sh = R.lab_share[lab], ab = R.vendor_abs[lab], tot = R.weekly_total_T;
  const dSh = sh[ult] - sh[base];
  const rLab = ab[base] > 0 ? ab[ult] / ab[base] : null;
  const rTot = tot[base] > 0 ? tot[ult] / tot[base] : null;
  const desde = base > 0 ? `desde ${fPer(R.eixo[base], R.estado.gran)}` : 'na janela';
  const iPico = sh.indexOf(d3.max(sh) ?? 0);

  // Família que mais cresceu em volume absoluto. Razão favoreceria base minúscula
  // (de zero para qualquer coisa é infinito); trilhões ganhos é o que pesa no mix.
  const fams = Object.entries(R.familias_abs[lab] ?? {}).map(([f, s]) => ({ f, de: s[base] ?? 0, para: s[ult] ?? 0, d: (s[ult] ?? 0) - (s[base] ?? 0) }))
    .sort((a, b) => b.d - a.d);
  const top = fams[0];
  const cresceu = !!top && top.d > 0.0005;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: 12, marginBottom: 14 }}>
      <Tile k={`Share de ${g.rotulo} · ${fPer(R.eixo[ult], R.estado.gran)}`} v={fmtP(sh[ult])}
        delta={base < ult && Math.abs(dSh) >= 0.05 ? <Delta>{seta(dSh)} {br(Math.abs(dSh).toFixed(1))} pp {desde}</Delta> : base < ult ? <Delta>estável {desde}</Delta> : null}
        d={base === ult ? 'único período com volume no recorte' : <>era {fmtP(sh[base])} em {fPer(R.eixo[base], R.estado.gran)}{iPico !== ult && iPico !== base ? <>; pico de {fmtP(sh[iPico])} em {fPer(R.eixo[iPico], R.estado.gran)}</> : null}</>} />
      <Tile k={`Volume ${porSemana(R)}`} v={fmtT(ab[ult])}
        delta={rLab && Math.abs(rLab - 1) >= 0.05 ? <Delta>{rLab > 1 ? '↑ ×' : '↓ ÷'}{fmtVez(rLab > 1 ? rLab : 1 / rLab)} {desde}</Delta> : null}
        d={<>era {fmtT0(ab[base])}; o mercado {rTot && rTot >= 1 ? `multiplicou por ${fmtVez(rTot)}` : rTot ? `dividiu por ${fmtVez(1 / rTot)}` : 'não tem base'} no mesmo período</>} />
      {top
        ? <Tile k={cresceu ? 'Família que mais cresceu' : 'Nenhuma família cresceu; a que menos caiu'} v={top.f} marca={FAMILIA_SLOT[lab]?.[top.f] ?? '--s0'}
            d={<>{top.d >= 0 ? '+' : '−'}{fmtT(Math.abs(top.d))} {porSemana(R)} {desde}, de {fmtT0(top.de)} para {fmtT0(top.para)}</>} />
        : <Tile k="Família que mais cresceu" v="—" d="sem família com volume no recorte" />}
    </div>
  );
}

// ------------------------------------------------------------------ share contra concorrentes

const TRACOS_CINZA = [undefined, '6 3', '1.5 3.5'];

function CartaoShare({ R, g, base }: { R: Recorte; g: GrupoFamilias; base: number }) {
  const { ocultos, alternar } = useOcultos();
  const lab = g.lab, ult = R.N - 1, gran = R.estado.gran;
  const cs = R.comp_share[lab] ?? {};
  // Os três maiores concorrentes no fim da janela, mais os outros dois grandes
  // quando estão no recorte: a seção compara os três, então eles não somem da tela.
  const conc = Object.keys(cs).filter(k => k !== lab).sort((a, b) => cs[b][ult] - cs[a][ult]);
  const top = conc.slice(0, 3);
  const grandes = FAMILIAS.map(f => f.lab).filter(k => k !== lab && cs[k] && !top.includes(k));
  let cinza = 0;
  const linhas: LinhaEnfase[] = [
    { key: lab, label: g.rotulo, values: R.lab_share[lab], slot: 'ink', foco: true },
    ...[...top, ...grandes].map(k => {
      const slot = LAB_SLOT[k] ?? '--s0';
      return { key: k, label: rotuloLab(k), values: cs[k], slot, traco: slot === '--s0' ? TRACOS_CINZA[Math.min(2, cinza++)] : undefined };
    }),
  ];
  const vis = linhas.filter(l => !ocultos.has(l.key));

  // Leitura: share e volume absoluto no mesmo período. Share cai quando o denominador explode.
  const sh = R.lab_share[lab], ab = R.vendor_abs[lab], tot = R.weekly_total_T;
  const s0 = sh[base], s1 = sh[ult], a0 = ab[base], a1 = ab[ult];
  const rLab = a0 > 0 ? a1 / a0 : null, rTot = tot[base] > 0 ? tot[ult] / tot[base] : null;
  const d0 = fPer(R.eixo[base], gran), d1 = fPer(R.eixo[ult], gran);
  const iPico = sh.indexOf(d3.max(sh) ?? 0);
  const ordem = Object.keys(cs).sort((a, b) => cs[b][ult] - cs[a][ult]);
  const pos = ordem.indexOf(lab) + 1; // só é a posição real se couber entre os 9 do recorte
  const vez = (r: number | null) => (r == null ? '' : r >= 1 ? `×${fmtVez(r)}` : `÷${fmtVez(1 / r)}`);
  let texto: ReactNode;
  if (base === ult) texto = <>{g.rotulo} só tem volume no último período do recorte: <b>{fmtP(s1)}</b> em {d1}, com {fmtT(a1)} {porSemana(R)}.</>;
  else if (s1 < s0 - 0.05 && a1 > a0)
    texto = <>O share de {g.rotulo} caiu de <b>{fmtP(s0)}</b> em {d0} para <b>{fmtP(s1)}</b> em {d1}, mas o volume absoluto subiu de {fmtT(a0)} para <b>{fmtT(a1)}</b> {porSemana(R)} ({vez(rLab)}). O mercado inteiro fez {vez(rTot)} no mesmo período: o share caiu porque o denominador cresceu mais rápido, não porque o uso encolheu.</>;
  else if (s1 < s0 - 0.05)
    texto = <>{g.rotulo} perdeu nas duas medidas: o share foi de <b>{fmtP(s0)}</b> para <b>{fmtP(s1)}</b> e o volume absoluto de {fmtT(a0)} para <b>{fmtT(a1)}</b> {porSemana(R)}, entre {d0} e {d1}. Nesta janela a queda não é efeito do denominador: o volume absoluto também caiu.</>;
  else if (s1 > s0 + 0.05)
    texto = <>O share de {g.rotulo} subiu de <b>{fmtP(s0)}</b> em {d0} para <b>{fmtP(s1)}</b> em {d1}. O volume absoluto foi de {fmtT(a0)} para <b>{fmtT(a1)}</b> {porSemana(R)} ({vez(rLab)}), {rLab != null && rTot != null && rLab > rTot ? 'mais' : 'menos'} que o mercado ({vez(rTot)}).</>;
  else texto = <>O share de {g.rotulo} ficou praticamente estável entre {d0} e {d1}, em torno de <b>{fmtP(s1)}</b>, com o volume indo de {fmtT(a0)} para <b>{fmtT(a1)}</b> {porSemana(R)}, no ritmo do mercado ({vez(rTot)}).</>;

  return (
    <Cartao id="fam-share" subtitulo={<>% do volume {gran === 'mes' ? 'mensal' : 'semanal'}; {g.rotulo} em destaque, contra os três maiores concorrentes e os outros grandes</>}>
      <LegendaEnfase linhas={linhas} ocultos={ocultos} alternar={alternar} valor={l => fmtP(l.values[ult])} />
      <LinhasEnfase eixo={R.eixo} gran={gran} linhas={vis}
        rotuloAria={`Share de ${g.rotulo} contra ${linhas.slice(1).map(l => l.label).join(', ')}, de ${d0} a ${d1}. ${g.rotulo} termina em ${fmtP(s1)}.`} />
      <TabelaSerie eixo={R.eixo} gran={gran} series={linhas.map(l => ({ label: l.label, values: l.values }))} fmt={v => fmtP(v)} />
      <p className="leitura">
        {texto}
        {iPico !== ult && iPico !== base && <> O pico na janela foi <b>{fmtP(sh[iPico])}</b>, em {fPer(R.eixo[iPico], gran)}.</>}
        {pos >= 1 && pos <= 8 && <> No último período, é o {pos}º maior laboratório do recorte.</>}
      </p>
    </Cartao>
  );
}

// ------------------------------------------------------------------ volume por família

function CartaoVolume({ R, g, base }: { R: Recorte; g: GrupoFamilias; base: number }) {
  const { ocultos, alternar } = useOcultos();
  const lab = g.lab, ult = R.N - 1, gran = R.estado.gran;
  const fam = R.familias_abs[lab] ?? {};
  const slots = FAMILIA_SLOT[lab] ?? {};
  const todas: ItemSerie[] = Object.keys(fam).map(k => ({ key: k, label: k, values: fam[k], slot: slots[k] ?? '--s0' }));
  const vis = todas.filter(s => !ocultos.has(s.key));
  const total = (i: number, ss = todas) => ss.reduce((s, x) => s + (x.values[i] ?? 0), 0);
  const nomeadas = todas.filter(t => t.slot !== '--s0').map(t => t.key.replace(/ \(.*\)$/, ''));
  const temCinza = todas.some(t => t.slot === '--s0');
  const nomes = nomeadas.length ? nomeadas.join(', ') + (temCinza ? ' e o resto em cinza' : '') : 'só a faixa cinza';

  const t1 = total(ult), t0 = total(base);
  const mix = (i: number, t: number) => todas.map(s => ({ f: s.key, p: t > 0 ? 100 * (s.values[i] ?? 0) / t : 0 }));
  const m1 = mix(ult, t1).sort((a, b) => b.p - a.p), m0 = mix(base, t0);
  const mud = m1.map(x => ({ f: x.f, de: m0.find(y => y.f === x.f)?.p ?? 0, para: x.p }))
    .map(x => ({ ...x, d: x.para - x.de })).sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0];
  const maior0 = [...m0].sort((a, b) => b.p - a.p)[0];

  return (
    <Cartao id="fam-volume" subtitulo={<>Trilhões de tokens {porSemana(R)}, por família: {nomes}</>}>
      <Legenda itens={todas} ocultos={ocultos} alternar={alternar} />
      <Temporal eixo={R.eixo} gran={gran} series={vis} modo="empilhada" fmt={fmtT} altura={260}
        tipExtra={i => [{ rot: 'Total', val: fmtT(total(i, vis)) }]}
        rotuloAria={`Volume de ${g.rotulo} por família, em trilhões de tokens ${porSemana(R)}, de ${fPer(R.eixo[0], gran)} a ${fPer(R.eixo[ult], gran)}. Total no último período: ${fmtT(t1)}.`} />
      <TabelaSerie eixo={R.eixo} gran={gran} series={[...todas.map(s => ({ label: s.label, values: s.values })), { label: 'Total', values: R.eixo.map((_, i) => total(i)) }]} fmt={fmtT} />
      <p className="leitura">
        {t1 > 0 && m1.filter(x => x.p >= 0.05).length === 1
          ? <>Todo o volume de {g.rotulo} no recorte, {fmtT(t1)} {porSemana(R)} em {fPer(R.eixo[ult], gran)}, é de <b>{m1[0].f}</b>.</>
          : t1 > 0
          ? <>Em {fPer(R.eixo[ult], gran)}, <b>{m1[0].f}</b> concentra <b>{fmtP(m1[0].p)}</b> dos {fmtT(t1)} de {g.rotulo}. O mix: {m1.filter(x => x.p >= 0.05).map((x, i, a) => <span key={x.f}>{x.f} {fmtP(x.p)}{i < a.length - 1 ? ', ' : '.'}</span>)}</>
          : <>{g.rotulo} não tem volume no último período do recorte.</>}
        {base < ult && t0 > 0 && maior0 && m1.filter(x => x.p >= 0.05).length > 1 && <> Em {fPer(R.eixo[base], gran)}, a maior era {maior0.f}, com {fmtP(maior0.p)}.</>}
        {base < ult && t0 > 0 && mud && Math.abs(mud.d) >= 1 && <> A maior mudança de mix foi <b>{mud.f}</b>, de {fmtP(mud.de)} para {fmtP(mud.para)} do volume do laboratório.</>}
      </p>
    </Cartao>
  );
}

// ------------------------------------------------------------------ semanas no top 10

type OrdemTop = 'valor' | 'estreia';

function CartaoTop10({ D, g }: { D: { life: Vida[]; weeks: string[] }; g: GrupoFamilias }) {
  const [ordem, setOrdem] = useState<OrdemTop>('valor');
  const [todos, setTodos] = useState(false);
  const [hv, setHv] = useState<{ i: number; top: number } | null>(null);
  const hover = hv?.i ?? null;
  const lab = g.lab, slots = FAMILIA_SLOT[lab] ?? {};
  const base = D.life.filter(m => m.vendor === lab && !/beta|thinking/.test(m.model) && m.weeks_in_top10 > 0)
    .map(m => ({ ...m, fam: familiaDe(g, m.model) }));
  const rot = rotulador(base.map(m => m.model));
  const linhas = [...base].sort(ordem === 'valor'
    ? (a, b) => b.weeks_in_top10 - a.weeks_in_top10 || (a.first < b.first ? -1 : 1)
    : (a, b) => (a.first < b.first ? -1 : a.first > b.first ? 1 : 0) || b.weeks_in_top10 - a.weeks_in_top10);
  const max = d3.max(linhas, l => l.weeks_in_top10) ?? 1;
  const LIMITE = 12;
  const vistas = todos ? linhas : linhas.slice(0, LIMITE);
  const famsPresentes = [...g.familias.map(f => f.nome), OUTROS_FAMILIA[lab] ?? 'Outros'].filter(f => linhas.some(l => l.fam === f));
  const desde = fMes(D.weeks[0]);
  const longevo = [...base].sort((a, b) => b.weeks_in_top10 - a.weeks_in_top10)[0];
  const recente = [...base].sort((a, b) => (a.first < b.first ? 1 : -1))[0];
  const vivos = base.filter(m => m.still_alive).length;

  return (
    <Cartao id="fam-top10"
      subtitulo={<>{ordem === 'valor' ? 'Do maior para o menor' : 'Por ordem de estreia no ranking'}, modelos {g.rotulo} que chegaram ao top 10. Histórico completo desde {desde}: não responde à janela nem aos filtros</>}
>
      {!linhas.length
        ? <p className="vazio">Nenhum modelo {g.rotulo} passou pelo top 10 no histórico com pico de share suficiente para entrar no ciclo de vida.</p>
        : <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '4px 12px', flexWrap: 'wrap', marginBottom: 4 }}>
            <Legenda itens={famsPresentes.map(f => ({ key: f, label: f, slot: slots[f] ?? '--s0' }))} />
            <Modos valor={ordem} onChange={setOrdem} rotulo="Ordenação" opcoes={[['valor', 'Permanência'], ['estreia', 'Estreia']]} />
          </div>
          <div className="plot" role="group" onPointerLeave={() => setHv(null)}
            aria-label={`Semanas no top 10 de ${linhas.length} modelos ${g.rotulo}. O mais longevo é ${rot(longevo.model)}, com ${longevo.weeks_in_top10} semanas.`}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,min(190px,45%)) minmax(0,1fr) auto', gap: '5px 10px', alignItems: 'center', fontSize: 12.5 }}>
              {vistas.map((l, i) => {
                const entra = (e: React.PointerEvent<HTMLElement>) => setHv({ i, top: e.currentTarget.offsetTop });
                return (
                  <div key={l.model} style={{ display: 'contents' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.model} onPointerEnter={entra}>
                      <Link prefetch={false} href={urlModelo(l.model)} style={{ color: 'var(--ink)', textDecoration: 'none' }}>{rot(l.model)}</Link>
                    </span>
                    <span style={{ display: 'block', background: 'var(--grid)', borderRadius: 2, height: 10 }} onPointerEnter={entra}>
                      <i style={{ display: 'block', height: 10, borderRadius: 2, width: `${(100 * l.weeks_in_top10 / max).toFixed(1)}%`, background: cor(slots[l.fam] ?? '--s0'), opacity: hover == null || hover === i ? 1 : 0.45 }} />
                    </span>
                    <span className="mono" style={{ fontSize: 11.5, color: 'var(--ink-2)', textAlign: 'right', whiteSpace: 'nowrap' }} onPointerEnter={entra}>
                      {ordem === 'estreia' && <span style={{ color: 'var(--ink-3)', marginRight: 6 }}>{fMes(l.first)}</span>}
                      {l.weeks_in_top10} sem{l.still_alive ? <span title="ainda acima de metade do pico"> ●</span> : <span aria-hidden="true" style={{ visibility: 'hidden' }}> ●</span>}
                    </span>
                  </div>
                );
              })}
            </div>
            {hover != null && linhas[hover] && (
              <div className="tip" style={{ right: 0, top: (hv?.top ?? 0) + 22 }}>
                <div className="t">{rot(linhas[hover].model)}</div>
                <div className="r"><span><i style={{ background: cor(slots[linhas[hover].fam] ?? '--s0') }} />Família</span><b>{linhas[hover].fam}</b></div>
                <div className="r"><span>Semanas no top 10</span><b>{linhas[hover].weeks_in_top10}</b></div>
                <div className="r"><span>Estreia no ranking</span><b>{fD(linhas[hover].first)}</b></div>
                <div className="r"><span>Pico de share</span><b>{fmtP(linhas[hover].peak_share)} em {fD(linhas[hover].peak_week)}</b></div>
                <div className="r"><span>Situação</span><b>{linhas[hover].still_alive ? 'acima de metade do pico' : 'abaixo de metade do pico'}</b></div>
              </div>
            )}
          </div>
          {linhas.length > LIMITE && (
            <button type="button" className="tbtn" style={{ marginTop: 8 }} aria-expanded={todos} onClick={() => setTodos(t => !t)}>
              {todos ? `Mostrar só os ${LIMITE} primeiros` : `Mostrar os ${linhas.length} modelos`}
            </button>
          )}
          <p className="nota" style={{ marginTop: 6 }}>● ainda acima de metade do próprio pico na última semana: a contagem desses modelos pode crescer.</p>
          <details className="tab">
            <summary>Ver os números</summary>
            <div className="tabwrap">
              <table className="t">
                <thead><tr><th>Modelo</th><th>Família</th><th className="num">Semanas no top 10</th><th className="num">Estreia</th><th className="num">Pico de share</th></tr></thead>
                <tbody>{linhas.map(l => (
                  <tr key={l.model}><td><Link prefetch={false} href={urlModelo(l.model)}>{rot(l.model)}</Link></td><td>{l.fam}</td><td className="num">{l.weeks_in_top10}</td><td className="num">{fD(l.first)}</td><td className="num">{fmtP(l.peak_share)}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </details>
          <p className="leitura">
            <b><Link prefetch={false} href={urlModelo(longevo.model)} style={{ color: 'inherit' }}>{rot(longevo.model)}</Link></b> é o mais longevo de {g.rotulo} no topo, com <b>{longevo.weeks_in_top10} semanas</b> entre os 10 mais usados.
            {recente && recente.model !== longevo.model && <> O de estreia mais recente, <Link prefetch={false} href={urlModelo(recente.model)} style={{ color: 'inherit' }}>{rot(recente.model)}</Link> ({fMes(recente.first)}), soma {recente.weeks_in_top10} {recente.weeks_in_top10 === 1 ? 'semana' : 'semanas'}{recente.still_alive ? ' e segue acima de metade do pico' : ''}.</>}
            {' '}{vivos === 1 ? `1 de ${base.length} ainda está acima de metade do próprio pico, então a permanência dele está em aberto.` : vivos > 1 ? `${vivos} de ${base.length} ainda estão acima de metade do próprio pico, então a permanência deles está em aberto.` : `Nenhum dos ${base.length} está acima de metade do próprio pico hoje.`}
          </p>
        </>}
    </Cartao>
  );
}

// ------------------------------------------------------------------ painel de um laboratório

function Painel({ g }: { g: GrupoFamilias }) {
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
              ? <>{g.rotulo} não tem nenhum modelo no recorte atual dos filtros de modelo, então share, volume e famílias ficam vazios em vez de aparecer como zero. Limpe os filtros para ver a leitura do laboratório.</>
              : <>{g.rotulo} não tem volume nesta janela, então share, volume e famílias ficam vazios em vez de aparecer como zero.</>}
            {' '}A permanência no top 10, abaixo, é histórico completo e não depende do recorte.
          </p>
          <CartaoTop10 D={D} g={g} />
        </>}
    </>
  );
}

export default function S09(_: { M: Mercado }) {
  const { R } = useHistorico();
  const ult = R.N - 1;
  const soma = FAMILIAS.reduce((s, g) => s + (R.lab_share[g.lab]?.[ult] ?? 0), 0);
  return (
    <Secao id="s09" n="09" titulo="Os três grandes: Anthropic, OpenAI e Google"
      sub={<>A mesma leitura para os três, uma aba por laboratório: share contra os concorrentes, volume por família de modelo e permanência no top 10.
        {soma > 0 ? <> Juntos, somam <b>{fmtP(soma)}</b> do volume{R.cobertura.filtrando ? ' do recorte' : ''} em {fPer(R.eixo[ult], R.estado.gran)}.</> : <> Nenhum dos três tem volume no recorte atual.</>}</>}>
      <Abas prefixo="s09" rotulo="Laboratório" itens={FAMILIAS.map(g => ({
        id: g.lab,
        rotulo: <>{g.rotulo}<span className="mono" style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-3)', marginLeft: 7 }}>{R.lab_share[g.lab]?.[ult] ? fmtP(R.lab_share[g.lab][ult]) : '—'}</span></>,
        conteudo: <Painel g={g} />,
      }))} />
    </Secao>
  );
}

