/**
 * Radar: a edição do dia, renderizada no servidor. O evento principal ganha
 * destaque, os quatro seguintes viram cartões e o resto vai numa lista curta.
 * Cada evento mostra o fato e, ao lado, o que o histórico de tráfego diz.
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
.rd-grid{display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; margin-top:12px}
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
.rd-fontes{list-style:none; margin:10px 0 0; padding:0; font-size:12.5px; color:var(--ink-3)}
.rd-fontes li{padding:2px 0; overflow-wrap:anywhere}
.rd-fontes b{color:var(--ink-2); font-weight:600}
.rd-fontes .dt{font-family:var(--font-mono),monospace; font-size:11px}
.rd-ev.pauta{--cor:var(--ink-3)}
@media (max-width:700px){ .rd-grid{grid-template-columns:minmax(0,1fr)} .rd h1{font-size:25px} .rd-ev.rd-destaque h3{font-size:19px}
  .rd-arq li{grid-template-columns:minmax(0,1fr) auto} .rd-arq li .d{grid-column:1/-1} }
`;

function Evento({ ev, dia, I, paginas, destaque }: { ev: EventoRadar; dia: string; I: Idioma; paginas: Set<string>; destaque?: boolean }) {
  const F = frase(ev, dia, I);
  const link = paginas.has(ev.slug) ? I.modelo(ev.slug) : null;
  return (
    <article className={'rd-ev' + (destaque ? ' rd-destaque' : '')} style={{ '--cor': `var(${slotLab(ev.vendor)})` } as React.CSSProperties}
      data-evento={ev.tipo} data-slug={ev.slug}>
      <span className="kicker">{F.rotulo} · {I.nomeLab(ev.lab)}</span>
      <h3>{link ? <Link href={link}>{F.titulo}</Link> : F.titulo}</h3>
      <p>{F.texto}</p>
      {F.cruzamento && <p className="cz"><b>{I.t({ pt: 'O que o dado diz.', en: 'What the data says.' })}</b> {F.cruzamento}</p>}
    </article>
  );
}

function Assunto({ a, I, destaque }: { a: AssuntoPauta; I: Idioma; destaque?: boolean }) {
  const F = textoAssunto(a, I);
  const pub = diaPublicacao(a.publicado_em);
  const dia = (iso?: string | null) => { const x = diaPublicacao(iso); return x ? I.f.fD(x) : null; };
  return (
    <article className={'rd-ev pauta' + (destaque ? ' rd-destaque' : '')} data-assunto={a.id}>
      <span className="kicker">{F.rotulo}{pub ? <> · <time dateTime={a.publicado_em ?? undefined}>{I.t({ pt: 'publicado em ', en: 'published ' })}{I.f.fD(pub)}</time></> : null}</span>
      <h3>{F.titulo}</h3>
      <p>{F.texto}</p>
      {F.cruzamento && <p className="cz"><b>{I.t({ pt: 'O que o dado diz.', en: 'What the data says.' })}</b> {F.cruzamento}</p>}
      <ul className="rd-fontes" aria-label={I.t({ pt: 'Fontes', en: 'Sources' })}>
        {a.fontes.map(f => (
          <li key={f.link}>
            {dia(f.data) && <time className="dt" dateTime={f.data ?? undefined}>{dia(f.data)} · </time>}<b>{f.veiculo}</b>: <a href={f.link} rel="noopener noreferrer" target="_blank">{f.titulo}</a>
            {f.discussao && f.pontos ? <> · <a href={f.discussao} rel="noopener noreferrer" target="_blank">{I.t({ pt: `${f.pontos} pontos no Hacker News`, en: `${f.pontos} points on Hacker News` })}</a></> : null}
          </li>
        ))}
      </ul>
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
          <h2 className="rd-sec">{t({ pt: 'Em pauta', en: 'In the news' })}</h2>
          <Assunto a={assuntos[0]} I={I} destaque />
          {assuntos.length > 1 && <div className="rd-grid">{assuntos.slice(1).map(a => <Assunto key={a.id} a={a} I={I} />)}</div>}
          {p && <h2 className="rd-sec">{t({ pt: 'No dado', en: 'In the data' })}</h2>}
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
                      <span className="t">{link ? <Link href={link}>{F.titulo}</Link> : F.titulo}. {F.texto}</span>
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
        pt: 'Em pauta: resumos escritos por IA só com o que as fontes citadas publicaram, revisados antes de ir ao ar. Os números de “O que o dado diz” saem do nosso dado, nunca do resumo. ',
        en: 'In the news: summaries written by AI using only what the cited sources published, reviewed before going live. The numbers in “What the data says” come from our data, never from the summary. ',
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
