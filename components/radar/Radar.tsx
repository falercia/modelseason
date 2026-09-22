/**
 * Radar: a edição do dia, renderizada no servidor. A primeira notícia da
 * pauta ganha destaque; as outras vêm em cartões mais leves. Cada notícia
 * traz, numa faixa embaixo, o que o tráfego de 7 dias diz sobre os
 * laboratórios citados. Nos eventos de dado, o principal ganha destaque, os
 * quatro seguintes viram cartões e o resto vai numa lista curta.
 */
import Link from 'next/link';
import type { Idioma } from '@/lib/idioma';
import { diaPublicacao, frase, textoAssunto, tituloEdicao } from '@/lib/radar';
import type { AssuntoPauta, EdicaoRadar, EventoRadar } from '@/lib/tipos';
import { slotLab } from '@/lib/cores';

export const CSS_RADAR = `
.rd{max-width:880px; margin:0 auto; padding:22px 20px 0}
.rd h1{font-size:30px; margin:6px 0 4px}
.rd .sub{color:var(--ink-2); max-width:64ch; font-size:14px}
.rd-meta{font-size:11.5px; color:var(--ink-3); font-family:var(--font-mono),monospace; margin:10px 0 18px; display:flex; flex-wrap:wrap; gap:4px 14px}
.rd-meta a{color:inherit}
.rd-ed{margin-bottom:26px}
.rd-ed > h2{font-size:13px; letter-spacing:.08em; text-transform:uppercase; color:var(--ink-3); margin-bottom:10px; font-weight:600}
/* "rd-destaque", e nunca "top": .top e o cabecalho fixo do site e o cartao herdava o sticky */
.rd-ev{background:var(--surface); border:1px solid var(--ring); border-left:3px solid var(--cor, var(--ring)); border-radius:11px; padding:14px 17px; min-width:0}
.rd-ev h3{font-size:15.5px; line-height:1.3; margin:3px 0 6px; overflow-wrap:anywhere; letter-spacing:-.005em}
.rd-ev h3 a{color:inherit; text-decoration:none}
.rd-ev h3 a:hover{text-decoration:underline; text-underline-offset:3px}
.rd-ev p{font-size:13.5px; line-height:1.55; color:var(--ink-2); overflow-wrap:anywhere}
.rd-ev .cz{margin-top:10px; font-size:12.5px; line-height:1.5; color:var(--ink-3); border-top:1px dashed var(--grid); padding-top:8px}
.rd-ev .cz b{color:var(--ink-2); font-weight:600}
.rd-ev.rd-destaque{padding:20px 22px}
.rd-ev.rd-destaque h3{font-size:22px; line-height:1.25}
.rd-ev.rd-destaque p{font-size:15px}
.rd-ev.rd-destaque .cz{font-size:13px; background:var(--surface-2); border:0; border-radius:8px; padding:9px 12px}
.rd-grid{display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:12px; margin-top:12px}
.rd-lista{margin-top:14px; border-top:1px solid var(--grid); padding-top:10px}
.rd-lista h4{font-size:12px; color:var(--ink-3); font-weight:600; margin-bottom:6px}
.rd-lista li{font-size:13px; padding:4px 0; display:flex; gap:10px; align-items:baseline; min-width:0}
.rd-lista li .kicker{margin:0; flex:0 0 auto}
.rd-lista li span.t{overflow-wrap:anywhere; min-width:0}
.rd-arq li{display:grid; grid-template-columns:110px minmax(0,1fr) auto; gap:10px; padding:7px 0; border-bottom:1px solid var(--grid); font-size:13.5px; align-items:baseline}
.rd-arq li .n{font-family:var(--font-mono),monospace; font-size:11px; color:var(--ink-3)}
.rd-arq li .d{font-family:var(--font-mono),monospace; font-size:12px; color:var(--ink-3)}
.rd-nav{display:flex; justify-content:space-between; gap:10px; margin:6px 0 20px; font-size:13px}
.rd-vazio{color:var(--ink-3); font-size:14px}
.rd-sec{font-size:12px; letter-spacing:.08em; text-transform:uppercase; color:var(--ink-3); font-weight:600; margin:22px 0 10px}
.rd-sec:first-child{margin-top:0}
.rd-mais{display:inline-block; margin-top:9px; font-size:12.5px; font-weight:600}
.rd-intro{font-size:13px; color:var(--ink-2); margin:-4px 0 12px; max-width:70ch}

/* Notícia × dado: cartão de coluna única, notícia em cima e faixa de dado embaixo */
.rd-ev.rd-cruz{padding:0; overflow:hidden; border-left:1px solid var(--ring)}
.rd-cruz + .rd-cruz{margin-top:10px}
.rd-cruz.rd-destaque{border-top:3px solid var(--accent)}
.rd-cruz .nt{padding:14px 18px 12px}
.rd-cruz.rd-destaque .nt{padding:18px 22px 14px}
.rd-cruz .lbl{font-size:10px; letter-spacing:.11em; text-transform:uppercase; font-family:var(--font-mono),monospace; color:var(--ink-3); display:block; margin-bottom:5px}
.rd-cruz .lbl b{color:var(--ink-2); font-weight:600}
.rd-cruz h3{font-size:17px; margin:2px 0 5px}
.rd-cruz.rd-destaque h3{font-size:25px; line-height:1.2; letter-spacing:-.012em; margin:2px 0 8px}
.rd-cruz.rd-destaque p{font-size:15px}
.rd-cruz h3 a::after{content:" ↗"; font-size:.65em; color:var(--ink-3)}
.rd-fontes{list-style:none; margin:9px 0 0; padding:0; font-size:12px; color:var(--ink-3); display:flex; flex-wrap:wrap; gap:2px 0; align-items:baseline}
.rd-fontes li{overflow-wrap:anywhere; white-space:nowrap}
.rd-fontes li.fl{margin-right:8px; font-weight:600}
.rd-fontes li + li::before{content:"·"; margin:0 7px; color:var(--ink-3)}
.rd-fontes li.fl + li::before{content:none}
.rd-fontes li a{color:var(--ink-2); text-decoration:none; border-bottom:1px solid var(--grid)}
.rd-fontes li a:hover{color:var(--accent); border-color:var(--accent)}
.rd-fontes .dt{font-family:var(--font-mono),monospace; font-size:10.5px; margin-right:5px}
.rd-fontes .hn{color:var(--ink-3); border-bottom:0}
.rd-cruz .dd{display:flex; flex-wrap:wrap; gap:4px 22px; align-items:baseline; padding:9px 18px 10px; background:var(--surface-2); border-top:1px solid var(--grid); font-size:12.5px; color:var(--ink-3); line-height:1.45}
.rd-cruz.rd-destaque .dd{padding-left:22px; padding-right:22px}
.rd-cruz .dd .lbl{display:inline; margin:0; flex:0 0 auto}
.rd-lab{display:flex; flex-wrap:wrap; gap:2px 12px; align-items:baseline; min-width:0}
.rd-lab .nm{font-weight:700; color:var(--ink); font-size:13px}
.rd-lab .nums{display:flex; gap:12px}
.rd-lab .nums span{white-space:nowrap}
.rd-lab .nums b{color:var(--ink); font-variant-numeric:tabular-nums; font-size:13.5px; margin-right:3px; font-weight:700}
.rd-lab .ld{color:var(--ink-2)}
.rd-cruz .dd .vazio{margin:0; padding:0; border:0; border-radius:0; font-size:12.5px; color:var(--ink-3)}
@media (max-width:700px){ .rd h1{font-size:25px} .rd-ev.rd-destaque h3{font-size:19px} .rd-cruz.rd-destaque h3{font-size:21px}
  .rd-cruz.rd-destaque .nt,.rd-cruz.rd-destaque .dd{padding-left:16px; padding-right:16px} .rd-cruz .nt{padding:12px 16px 10px} .rd-cruz .dd{padding:8px 16px 9px}
  .rd-fontes li{white-space:normal}
  .rd-arq li{grid-template-columns:minmax(0,1fr) auto} .rd-arq li .d{grid-column:1/-1} }
`;

function Evento({ ev, dia, I, paginas, destaque }: { ev: EventoRadar; dia: string; I: Idioma; paginas: Set<string>; destaque?: boolean }) {
  const F = frase(ev, dia, I);
  const link = paginas.has(ev.slug) ? I.modelo(ev.slug) : null;
  return (
    <article className={'rd-ev' + (destaque ? ' rd-destaque' : '')} style={{ '--cor': `var(${slotLab(ev.vendor)})` } as React.CSSProperties}
      data-evento={ev.tipo} data-slug={ev.slug}>
      <span className="kicker">{F.rotulo} · {I.nomeLab(ev.lab)}</span>
      <h3>{F.titulo}</h3>
      <p>{F.texto}</p>
      {F.cruzamento && <p className="cz"><b>{I.t({ pt: 'O que o dado diz.', en: 'What the data says.' })}</b> {F.cruzamento}</p>}
      {link && <Link className="rd-mais" href={link}>{I.t({ pt: `Ver ${ev.nome} no Model Season →`, en: `See ${ev.nome} on Model Season →` })}</Link>}
    </article>
  );
}

function Assunto({ a, I, paginas, destaque }: { a: AssuntoPauta; I: Idioma; paginas: Set<string>; destaque?: boolean }) {
  const { t, f } = I;
  const F = textoAssunto(a, I);
  const pub = diaPublicacao(a.publicado_em);
  // Data curta da fonte ("20 set" / "Sep 20"): o ano já está no rótulo do cartão.
  const dia = (iso?: string | null) => { const x = diaPublicacao(iso); return x ? f.marcaDia(f.dataDe(x)) : null; };
  // O título abre a matéria: a primeira fonte que não é discussão do Hacker News.
  const principal = a.fontes.find(x => !/news\.ycombinator\.com/.test(x.link)) ?? a.fontes[0];
  const labs = a.cruzamento ?? [];
  return (
    <article className={'rd-ev pauta rd-cruz' + (destaque ? ' rd-destaque' : '')} data-assunto={a.id}>
      <div className="nt">
        <span className="lbl"><b>{F.rotulo}</b>{pub ? <> · <time dateTime={a.publicado_em ?? undefined}>{f.fD(pub)}</time></> : null}</span>
        <h3>{principal ? <a href={principal.link} rel="noopener noreferrer" target="_blank" data-fonte-principal>{F.titulo}</a> : F.titulo}</h3>
        <p>{F.texto}</p>
        <ul className="rd-fontes" aria-label={t({ pt: 'Fontes', en: 'Sources' })}>
          <li className="fl" aria-hidden="true">{t({ pt: 'Fontes', en: 'Sources' })}</li>
          {a.fontes.map(x => (
            <li key={x.link}>
              {dia(x.data) && <time className="dt" dateTime={x.data ?? undefined}>{dia(x.data)}</time>}
              <a href={x.link} rel="noopener noreferrer" target="_blank" title={x.titulo}>{x.veiculo}</a>
              {x.discussao && x.pontos ? <> <a className="hn" href={x.discussao} rel="noopener noreferrer" target="_blank" title={t({ pt: `${x.pontos} pontos no Hacker News`, en: `${x.pontos} points on Hacker News` })}>({x.pontos} HN)</a></> : null}
            </li>
          ))}
        </ul>
      </div>
      <aside className="dd" aria-label={t({ pt: 'O que o dado diz', en: 'What the data says' })}>
        <span className="lbl"><b>{t({ pt: 'O dado', en: 'The data' })}</b> · 7d</span>
        {labs.length ? labs.map(c => (
          <div className="rd-lab" key={c.vendor} data-lab={c.vendor}>
            <span className="nm">{I.nomeLab(c.lab)}</span>
            {c.share_tokens != null && c.share_gasto != null && (
              <span className="nums">
                <span><b>{f.fmtP(c.share_tokens)}</b>{t({ pt: 'dos tokens', en: 'of tokens' })}</span>
                <span><b>{f.fmtP(c.share_gasto)}</b>{t({ pt: 'do gasto', en: 'of spend' })}</span>
              </span>
            )}
            {c.lider && (
              <span className="ld">
                {t({ pt: 'mais usado: ', en: 'most used: ' })}
                {paginas.has(c.lider.slug)
                  ? <Link href={I.modelo(c.lider.slug)}>{c.lider.nome}</Link>
                  : c.lider.nome} ({f.fmtP(c.lider.share_7d, 2)})
              </span>
            )}
          </div>
        )) : <p className="vazio">{t({ pt: 'Nenhum laboratório com tráfego medido neste assunto.', en: 'No lab with measured traffic in this story.' })}</p>}
      </aside>
    </article>
  );
}

export function Edicao({ ed, I, paginas, titulo }: { ed: EdicaoRadar; I: Idioma; paginas: Set<string>; titulo?: string }) {
  const { t } = I;
  const assuntos = ed.assuntos ?? [];
  const [p, ...resto] = ed.eventos;
  const cartoes = resto.slice(0, 4), lista = resto.slice(4);
  return (
    <section className="rd-ed" aria-label={titulo ?? tituloEdicao(ed, I)}>
      {titulo && <h2>{titulo}</h2>}
      {assuntos.length > 0 && (
        <>
          <h2 className="rd-sec">{t({ pt: 'Notícia × dado', en: 'News × data' })}</h2>
          <p className="rd-intro">{t({
            pt: 'O fato publicado lá fora e, embaixo, o que o tráfego real de tokens dos últimos 7 dias diz sobre quem está nele. O título abre a matéria original; o nome do modelo abre a página dele aqui.',
            en: 'The story published out there and, below it, what real token traffic from the last 7 days says about who is in it. The headline opens the original article; the model name opens its page here.',
          })}</p>
          {assuntos.map((a, i) => <Assunto key={a.id} a={a} I={I} paginas={paginas} destaque={i === 0} />)}
          {p && <h2 className="rd-sec">{t({ pt: 'Mudanças no dado', en: 'Changes in the data' })}</h2>}
        </>
      )}
      {!p ? (!assuntos.length && <p className="rd-vazio">{t({ pt: 'Nada relevante mudou no catálogo nem no tráfego neste dia.', en: 'Nothing relevant changed in the catalog or in traffic on this day.' })}</p>) : (
        <>
          <Evento ev={p} dia={ed.dia} I={I} paginas={paginas} destaque={!assuntos.length} />
          {cartoes.length > 0 && (
            <div className="rd-grid">{cartoes.map(ev => <Evento key={ev.tipo + ev.slug} ev={ev} dia={ed.dia} I={I} paginas={paginas} />)}</div>
          )}
          {lista.length > 0 && (
            <div className="rd-lista">
              <h4>{t({ pt: 'Outras mudanças', en: 'Other changes' })}</h4>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {lista.map(ev => {
                  const F = frase(ev, ed.dia, I);
                  const link = paginas.has(ev.slug) ? I.modelo(ev.slug) : null;
                  return (
                    <li key={ev.tipo + ev.slug} data-evento={ev.tipo}>
                      <span className="kicker">{F.rotulo}</span>
                      <span className="t"><b>{F.titulo}.</b> {F.texto}{link && <> <Link href={link}>{I.t({ pt: 'Ver modelo →', en: 'See model →' })}</Link></>}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function Fontes({ ed, I }: { ed: EdicaoRadar; I: Idioma }) {
  const { t, f } = I;
  const [c0, c1] = ed.fontes.catalogo;
  return (
    <p className="nota">
      {ed.assuntos?.length ? t({
        pt: 'Em pauta: resumos escritos por IA só com o que as fontes citadas publicaram, revisados antes de ir ao ar. Os números da faixa “O dado” saem do nosso dado, tráfego dos últimos 7 dias, nunca do resumo. ',
        en: 'In the news: summaries written by AI using only what the cited sources published, reviewed before going live. The numbers in the “The data” strip come from our data, traffic from the last 7 days, never from the summary. ',
      }) : ''}
      {c0 && c1 ? <>{t({
        pt: `Foto do catálogo de ${f.fD(c1)}, comparada com as anteriores desde ${f.fD(c0)}.`,
        en: `Catalog snapshot of ${f.fD(c1)}, compared with the previous ones since ${f.fD(c0)}.`,
      })}{' '}</> : null}
      {!c0 ? null : ed.fontes.trafego
        ? t({ pt: `Tráfego até ${f.fD(ed.fontes.trafego)}.`, en: `Traffic through ${f.fD(ed.fontes.trafego)}.` })
        : t({ pt: 'Sem eventos de tráfego nesta edição, porque o dado da véspera não estava disponível quando ela foi gerada.',
            en: 'No traffic events in this edition, because the previous day’s data was not available when it was generated.' })}{' '}
      {c0 && t({
        pt: 'Preço é o misto de 75% entrada e 25% saída, e só vira notícia quando o novo valor se mantém por duas fotos. A ordem segue uma fórmula fixa de relevância, que pesa o tipo de mudança e o share do modelo.',
        en: 'Price is a 75% input and 25% output blend, and only becomes news when the new value holds for two snapshots. Order follows a fixed relevance formula that weighs the type of change and the model’s share.',
      })}
      {ed.revisao > 1 ? ' ' + t({ pt: `Revisão ${ed.revisao}.`, en: `Revision ${ed.revisao}.` }) : ''}
    </p>
  );
}
