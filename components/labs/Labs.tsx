/**
 * Laboratórios: o placar dos dez acompanhados e o que cada um registrou nas
 * próprias notas de versão. Renderizado no servidor, todo número sai de
 * data/web/labs.json e todo movimento das pautas (lib/data.ts), nunca do HTML.
 *
 * Cor não carrega significado aqui: a linha cheia é tokens e a tracejada é
 * gasto, e o tipo do movimento é texto. Assim a página não depende da paleta
 * validada para daltonismo, que só cobre quatro laboratórios.
 */
import Link from 'next/link';
import type { Idioma } from '@/lib/idioma';
import type { GrupoPlacar, LabPlacar, Labs, MovimentoLab, TipoMovimento } from '@/lib/tipos';

export const CSS_LABS = `
.lb{max-width:1080px; margin:0 auto; padding:22px 20px 0}
.lb h1{font-size:30px; margin:6px 0 4px}
.lb .sub{color:var(--ink-2); max-width:70ch; font-size:14px}
.lb-meta{font-size:11.5px; color:var(--ink-3); font-family:var(--font-mono),monospace; margin:10px 0 16px; display:flex; flex-wrap:wrap; gap:4px 14px}
.lb-meta a{color:inherit}
.lb-leitura{font-size:15px; line-height:1.55; max-width:72ch; margin:0 0 14px}
.lb-leitura b{font-variant-numeric:tabular-nums}
.lb-grupos{display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr)); gap:12px; margin:0 0 6px}
.lb-g,.lb-c{background:var(--surface); border:1px solid var(--ring); border-radius:11px; padding:14px 16px; min-width:0}
.lb-g h2{font-size:13px; margin:0 0 8px; font-weight:600}
.lb-g .quem{font-size:12px; color:var(--ink-3); margin:6px 0 0}
.lb-nums{display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px 14px}
.lb-num .k{font-size:10px; letter-spacing:.11em; text-transform:uppercase; font-family:var(--font-mono),monospace; color:var(--ink-3)}
.lb-num .v{font-size:22px; font-weight:700; font-variant-numeric:tabular-nums; letter-spacing:-.01em}
.lb-c .lb-num .v{font-size:19px}
.lb-num .d{font-size:11.5px; color:var(--ink-3); font-family:var(--font-mono),monospace}
.lb-spark{margin-top:8px}
.lb-spark svg{display:block; width:100%; height:44px}
.lb-spark .leg{font-size:11px; color:var(--ink-3); display:flex; gap:12px; flex-wrap:wrap; margin-top:2px}
.lb-spark .leg i{display:inline-block; width:16px; border-top:2px solid var(--ink-2); vertical-align:middle; margin-right:5px}
.lb-spark .leg i.g{border-top:2px dashed var(--ink-3)}
.lb-sec{font-size:12px; letter-spacing:.08em; text-transform:uppercase; color:var(--ink-3); font-weight:600; margin:28px 0 10px}
.lb-intro{font-size:13px; color:var(--ink-2); margin:-4px 0 12px; max-width:72ch}
.lb-cartoes{display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,330px),1fr)); gap:12px; align-items:start}
.lb-c{display:flex; flex-direction:column; gap:10px; scroll-margin-top:calc(var(--top-h, 56px) + 12px)}
.lb-c header{display:flex; flex-direction:column; gap:2px}
.lb-c h3{font-size:18px; margin:0; letter-spacing:-.01em}
.lb-c .rk{font-size:11px; color:var(--ink-3); font-family:var(--font-mono),monospace}
.lb-lider{font-size:12.5px; color:var(--ink-2)}
.lb-movs{list-style:none; margin:0; padding:0}
.lb-c .lb-movs{border-top:1px solid var(--grid)}
.lb-mov{padding:9px 0; border-bottom:1px solid var(--grid); min-width:0}
.lb-movs > .lb-mov:last-child{border-bottom:0}
.lb-mov .cab{display:flex; gap:4px 8px; align-items:baseline; flex-wrap:wrap; font-size:11px; color:var(--ink-3); font-family:var(--font-mono),monospace}
.lb-mov .tp{font-size:10px; text-transform:uppercase; letter-spacing:.08em; padding:1px 6px; border-radius:5px; background:var(--surface-2); color:var(--ink-2)}
.lb-mov .lab{font-weight:600; color:var(--ink-2); font-family:var(--font-sans),system-ui,sans-serif; font-size:12px}
.lb-mov h4{font-size:14px; line-height:1.35; margin:3px 0 2px; overflow-wrap:anywhere; font-weight:600}
.lb-mov h4 a{color:inherit; text-decoration:none}
.lb-mov h4 a:hover{text-decoration:underline; text-underline-offset:3px}
.lb-mov h4 a::after{content:" ↗"; font-size:.7em; color:var(--ink-3)}
.lb-mov p{font-size:13px; line-height:1.5; color:var(--ink-2); margin:0; overflow-wrap:anywhere}
.lb-mov details{margin-top:4px}
.lb-mov summary{cursor:pointer; color:var(--ink-3); font-size:11.5px}
.lb-mov details p{color:var(--ink-3); font-size:12.5px; margin-top:3px}
.lb-mov .fonte{font-size:11px; color:var(--ink-3); margin-top:3px}
.lb-vazio{font-size:12.5px; color:var(--ink-3); margin:0}
.lb-fontes{font-size:11.5px; color:var(--ink-3); margin:0; display:flex; flex-wrap:wrap; gap:2px 10px}
.lb-fontes a{color:var(--ink-2)}
.lb-mais{font-size:12.5px; font-weight:600}
.lb-tempo{background:var(--surface); border:1px solid var(--ring); border-radius:11px; padding:4px 16px}

/* faixa da home */
.placar{margin:30px 0 6px; scroll-margin-top:calc(var(--top-h, 56px) + 12px)}
.placar-h{display:flex; justify-content:space-between; align-items:baseline; gap:6px 14px; flex-wrap:wrap; margin-bottom:6px}
.placar-h h2{font-size:21px; margin:0}
.placar-sub{font-size:13px; color:var(--ink-2); margin:0 0 10px; max-width:76ch}
.placar-sub b{font-variant-numeric:tabular-nums}
.placar-gr{font-size:10px; letter-spacing:.11em; text-transform:uppercase; font-family:var(--font-mono),monospace; color:var(--ink-3); margin:10px 0 6px}
.placar-grid{display:grid; grid-template-columns:repeat(auto-fill,minmax(min(100%,190px),1fr)); gap:8px}
.placar-t{display:flex; flex-direction:column; gap:2px; background:var(--surface); border:1px solid var(--ring); border-radius:10px; padding:10px 12px; text-decoration:none; color:var(--ink); min-width:0}
.placar-t:hover{border-color:var(--ink-3)}
.placar-t .n{font-weight:700; font-size:13px}
.placar-t .v{font-size:18px; font-weight:700; font-variant-numeric:tabular-nums}
.placar-t .v small{font-size:11px; font-weight:500; color:var(--ink-3); margin-left:4px; font-family:var(--font-mono),monospace}
.placar-t .d{font-size:11px; color:var(--ink-3)}
.placar-t .ult{font-size:11.5px; color:var(--ink-2); margin-top:5px; line-height:1.35; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; overflow-wrap:anywhere}
.placar-t .ult time{font-family:var(--font-mono),monospace; color:var(--ink-3); font-size:10.5px; margin-right:4px}
@media (max-width:700px){ .lb h1{font-size:25px} .lb-num .v{font-size:19px} }
@media (max-width:520px){ .placar-grid{grid-template-columns:repeat(2,minmax(0,1fr))} .placar-t{padding:9px 10px} .placar-t .v{font-size:16px} }
`;

// ------------------------------------------------------------------ rótulos

const TIPO: Record<TipoMovimento, { pt: string; en: string }> = {
  modelo: { pt: 'Modelo', en: 'Model' }, preco: { pt: 'Preço', en: 'Pricing' },
  desativacao: { pt: 'Desativação', en: 'Deprecation' }, api: { pt: 'API', en: 'API' },
  app: { pt: 'App', en: 'App' }, outro: { pt: 'Outro', en: 'Other' },
};
export const rotuloTipo = (t: TipoMovimento, I: Idioma) => I.t(TIPO[t] ?? TIPO.outro);

/** "22 out 26" / "Oct 22, 2026"; nota com só o mês: "set 26" / "Sep 2026". */
export const dataMov = (d: string, I: Idioma) => (d.length === 7 ? I.f.fMes(d + '-01') : I.f.fD(d));

/** Variação em pontos percentuais, sem verde nem vermelho: a seta diz a direção. */
function delta(atual: number, antes: number, I: Idioma) {
  const d = atual - antes;
  if (Math.abs(d) < 0.05) return I.t({ pt: 'estável', en: 'flat' });
  return `${d > 0 ? '↑' : '↓'} ${I.f.dec(Math.abs(d).toFixed(1))} pp`;
}

// ------------------------------------------------------------------ peças

/** Duas linhas de share semanal: tokens (cheia) e gasto (tracejada), na mesma escala. */
function Spark({ tokens, gasto, I, nome }: { tokens: number[]; gasto: number[]; I: Idioma; nome: string }) {
  const w = 300, h = 44, n = tokens.length;
  const max = Math.max(1, ...tokens, ...gasto);
  const x = (i: number) => (n <= 1 ? w / 2 : 2 + (i * (w - 4)) / (n - 1));
  const y = (v: number) => h - 3 - (v / max) * (h - 8);
  const linha = (s: number[]) => s.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const { t, f } = I;
  return (
    <div className="lb-spark">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={t({
        pt: `${nome}: share de tokens de ${f.fmtP(tokens[0])} para ${f.fmtP(tokens[n - 1])} e share do gasto de ${f.fmtP(gasto[0])} para ${f.fmtP(gasto[n - 1])} em ${n} semanas`,
        en: `${nome}: token share from ${f.fmtP(tokens[0])} to ${f.fmtP(tokens[n - 1])} and spend share from ${f.fmtP(gasto[0])} to ${f.fmtP(gasto[n - 1])} over ${n} weeks`,
      })}>
        <path d={linha(gasto)} fill="none" stroke="var(--ink-3)" strokeWidth={1.4} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
        <path d={linha(tokens)} fill="none" stroke="var(--ink-2)" strokeWidth={1.8} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="leg"><span><i />{t({ pt: 'tokens', en: 'tokens' })}</span><span><i className="g" />{t({ pt: 'gasto estimado', en: 'estimated spend' })}</span>
        <span>{t({ pt: `${n} semanas; seta contra 4 semanas antes`, en: `${n} weeks; arrow vs. 4 weeks earlier` })}</span></div>
    </div>
  );
}

function Numeros({ x, I }: { x: { share_tokens: number; share_tokens_4s: number; share_gasto: number; share_gasto_4s: number }; I: Idioma }) {
  const { t, f } = I;
  return (
    <div className="lb-nums">
      <div className="lb-num">
        <div className="k">{t({ pt: 'Tokens', en: 'Tokens' })}</div>
        <div className="v">{f.fmtP(x.share_tokens)}</div>
        <div className="d">{delta(x.share_tokens, x.share_tokens_4s, I)}</div>
      </div>
      <div className="lb-num">
        <div className="k">{t({ pt: 'Gasto estimado', en: 'Estimated spend' })}</div>
        <div className="v">{f.fmtP(x.share_gasto)}</div>
        <div className="d">{delta(x.share_gasto, x.share_gasto_4s, I)}</div>
      </div>
    </div>
  );
}

export function ItemMovimento({ m, I, comLab, nomes }: { m: MovimentoLab; I: Idioma; comLab?: boolean; nomes?: Record<string, string> }) {
  const tx = m[I.lang];
  return (
    <li className="lb-mov" data-movimento={m.id} data-tipo={m.tipo} data-lab={m.lab}>
      <div className="cab">
        <time dateTime={m.data}>{dataMov(m.data, I)}</time>
        <span className="tp">{rotuloTipo(m.tipo, I)}</span>
        {comLab && <span className="lab">{I.nomeLab(nomes?.[m.lab] ?? m.lab)}</span>}
      </div>
      <h4><a href={m.link} rel="noopener noreferrer" target="_blank" title={m.fonte}>{tx.titulo}</a></h4>
      <p>{tx.simples}</p>
      {tx.tecnico && (
        <details>
          <summary>{I.t({ pt: 'Versão técnica', en: 'Technical version' })}</summary>
          <p>{tx.tecnico}</p>
        </details>
      )}
    </li>
  );
}

export function ListaMovimentos({ ms, I, comLab, nomes }: { ms: MovimentoLab[]; I: Idioma; comLab?: boolean; nomes?: Record<string, string> }) {
  return <ul className="lb-movs">{ms.map(m => <ItemMovimento key={m.id} m={m} I={I} comLab={comLab} nomes={nomes} />)}</ul>;
}

function CartaoLab({ L, ms, I, paginas, semana }: { L: LabPlacar; ms: MovimentoLab[]; I: Idioma; paginas: Set<string>; semana: string }) {
  const { t, f, url, modelo, nomeLab } = I;
  const nome = nomeLab(L.nome);
  const grandes = ['anthropic', 'openai', 'google'].includes(L.vendor);
  return (
    <article className="lb-c" id={`lab-${L.vendor}`} data-lab={L.vendor}>
      <header>
        <h3>{nome}</h3>
        {L.rank_tokens != null && <span className="rk">{t({ pt: `${L.rank_tokens}º em tokens`, en: `#${L.rank_tokens} by tokens` })} · {t({ pt: 'semana de', en: 'week of' })} {f.fD(semana)}</span>}
      </header>
      <Numeros x={L} I={I} />
      <Spark tokens={L.serie_tokens} gasto={L.serie_gasto} I={I} nome={nome} />
      {L.lider && (
        <div className="lb-lider">
          {t({ pt: 'Mais usado: ', en: 'Most used: ' })}
          {paginas.has(L.lider.slug) ? <Link href={modelo(L.lider.slug)}>{L.lider.nome}</Link> : L.lider.nome}
          {' '}({f.fmtP(L.lider.share, 2)} {t({ pt: 'dos tokens', en: 'of tokens' })})
        </div>
      )}
      {ms.length
        ? <ListaMovimentos ms={ms} I={I} />
        : <p className="lb-vazio">{t({ pt: 'Nenhum movimento registrado nas fontes acompanhadas.', en: 'No moves recorded in the tracked sources.' })}</p>}
      <p className="lb-fontes">
        <span>{t({ pt: 'Fontes acompanhadas:', en: 'Tracked sources:' })}</span>
        {L.paginas.map(p => <a key={p.link} href={p.link} rel="noopener noreferrer" target="_blank">{p.nome}</a>)}
      </p>
      {grandes && <Link className="lb-mais" href={url('/') + '#s09'}>{t({ pt: 'Aprofundar em Os três grandes →', en: 'Go deeper in The Big Three →' })}</Link>}
    </article>
  );
}

/** Frase de abertura, só com número do dado. */
function Leitura({ L, I, classe = 'lb-leitura' }: { L: Labs; I: Idioma; classe?: string }) {
  const { t, f } = I;
  const e = L.grupos.eua, c = L.grupos.china;
  if (!L.semana) return null;
  return (
    <p className={classe}>{t({
      pt: <>Na semana de {f.fD(L.semana)}, os três pagos dos EUA ficaram com <b>{f.fmtP(e.share_tokens)}</b> dos tokens e <b>{f.fmtP(e.share_gasto)}</b> do gasto estimado. Os laboratórios chineses, com <b>{f.fmtP(c.share_tokens)}</b> dos tokens e <b>{f.fmtP(c.share_gasto)}</b> do gasto.</>,
      en: <>In the week of {f.fD(L.semana)}, the three paid US labs took <b>{f.fmtP(e.share_tokens)}</b> of tokens and <b>{f.fmtP(e.share_gasto)}</b> of estimated spend. Chinese labs took <b>{f.fmtP(c.share_tokens)}</b> of tokens and <b>{f.fmtP(c.share_gasto)}</b> of spend.</>,
    })}</p>
  );
}

function Grupo({ titulo, quem, G, I }: { titulo: string; quem: string; G: GrupoPlacar; I: Idioma }) {
  return (
    <section className="lb-g" aria-label={titulo}>
      <h2>{titulo}</h2>
      <Numeros x={G} I={I} />
      <Spark tokens={G.serie_tokens} gasto={G.serie_gasto} I={I} nome={titulo} />
      <p className="quem">{quem}</p>
    </section>
  );
}

const porLab = (ms: MovimentoLab[]) => {
  const out: Record<string, MovimentoLab[]> = {};
  for (const m of ms) (out[m.lab] ??= []).push(m);
  return out;
};

export function PaginaLabs({ L, ms, I, paginas }: { L: Labs; ms: MovimentoLab[]; I: Idioma; paginas: Set<string> }) {
  const { t, f, nomeLab } = I;
  const P = porLab(ms);
  const nomes = Object.fromEntries(L.labs.map(x => [x.vendor, x.nome]));
  const eua = L.labs.filter(x => x.grupo === 'eua'), china = L.labs.filter(x => x.grupo === 'china');
  const semana = L.semana ?? '';
  return (
    <>
      <Leitura L={L} I={I} />
      <div className="lb-grupos">
        <Grupo I={I} G={L.grupos.eua} titulo={t({ pt: 'Os três pagos dos EUA', en: 'The three paid US labs' })}
          quem={f.lista(eua.map(x => nomeLab(x.nome)))} />
        <Grupo I={I} G={L.grupos.china} titulo={t({ pt: 'Laboratórios chineses', en: 'Chinese labs' })}
          quem={t({
            pt: `Todos os de origem chinesa no dado. Os sete acompanhados somam ${f.fmtP(L.grupos.china_acompanhados.share_tokens)} dos tokens.`,
            en: `Every lab of Chinese origin in the data. The seven tracked here add up to ${f.fmtP(L.grupos.china_acompanhados.share_tokens)} of tokens.`,
          })} />
      </div>

      <h2 className="lb-sec" id="eua">{t({ pt: 'Os três pagos dos EUA', en: 'The three paid US labs' })}</h2>
      <div className="lb-cartoes">{eua.map(x => <CartaoLab key={x.vendor} L={x} ms={(P[x.vendor] ?? []).slice(0, 5)} I={I} paginas={paginas} semana={semana} />)}</div>

      <h2 className="lb-sec" id="china">{t({ pt: 'Os sete chineses', en: 'The seven Chinese labs' })}</h2>
      <p className="lb-intro">{t({
        pt: 'Os cinco chineses de maior tráfego em 90 dias, mais Moonshot (Kimi) e Qwen (Alibaba). A lista é revista a cada trimestre pelo dado, não por preferência.',
        en: 'The five Chinese labs with the most traffic over 90 days, plus Moonshot (Kimi) and Qwen (Alibaba). The list is reviewed every quarter from the data, not from preference.',
      })}</p>
      <div className="lb-cartoes">{china.map(x => <CartaoLab key={x.vendor} L={x} ms={(P[x.vendor] ?? []).slice(0, 5)} I={I} paginas={paginas} semana={semana} />)}</div>

      <h2 className="lb-sec" id="linha-do-tempo">{t({ pt: 'Linha do tempo', en: 'Timeline' })}</h2>
      <p className="lb-intro">{t({ pt: 'Todos os movimentos registrados, do mais novo para o mais antigo.', en: 'Every recorded move, newest first.' })}</p>
      <div className="lb-tempo"><ListaMovimentos ms={ms.slice(0, 80)} I={I} comLab nomes={nomes} /></div>
    </>
  );
}

/** Faixa da home: um cartão por laboratório, com o último movimento, levando à página. */
export function Placar({ L, ms, I }: { L: Labs; ms: MovimentoLab[]; I: Idioma }) {
  const { t, f, url, nomeLab } = I;
  if (!L.semana || !L.labs.length) return null;
  const P = porLab(ms);
  const tile = (x: LabPlacar) => {
    const u = P[x.vendor]?.[0];
    const d = x.share_tokens - x.share_tokens_4s;
    return (
      <Link key={x.vendor} className="placar-t" href={url('/labs') + `#lab-${x.vendor}`} data-lab={x.vendor}>
        <span className="n">{nomeLab(x.nome)}</span>
        <span className="v">{f.fmtP(x.share_tokens)}<small>{Math.abs(d) < 0.05 ? '=' : `${d > 0 ? '↑' : '↓'}${f.dec(Math.abs(d).toFixed(1))}`}</small></span>
        <span className="d">{t({ pt: `dos tokens · ${f.fmtP(x.share_gasto)} do gasto`, en: `of tokens · ${f.fmtP(x.share_gasto)} of spend` })}</span>
        {u && <span className="ult"><time dateTime={u.data}>{dataMov(u.data, I)}</time>{u[I.lang].titulo}</span>}
      </Link>
    );
  };
  return (
    <section className="placar" id="placar" aria-labelledby="placar-t" data-placar>
      <div className="placar-h">
        <h2 id="placar-t">{t({ pt: 'Placar dos laboratórios', en: 'Lab scoreboard' })}</h2>
        <Link className="lb-mais" href={url('/labs')}>{t({ pt: 'Ver o placar e os movimentos →', en: 'See the scoreboard and the moves →' })}</Link>
      </div>
      <Leitura L={L} I={I} classe="placar-sub" />
      <div className="placar-gr">{t({ pt: 'Pagos dos EUA', en: 'Paid US labs' })}</div>
      <div className="placar-grid">{L.labs.filter(x => x.grupo === 'eua').map(tile)}</div>
      <div className="placar-gr">{t({ pt: 'Chineses', en: 'Chinese' })}</div>
      <div className="placar-grid">{L.labs.filter(x => x.grupo === 'china').map(tile)}</div>
      <p className="nota">{t({
        pt: `Share de tokens e de gasto estimado na semana de ${f.fD(L.semana)}, com a seta da variação em pontos percentuais contra quatro semanas antes. O último movimento vem das notas de versão do próprio laboratório.`,
        en: `Token and estimated spend share in the week of ${f.fD(L.semana)}, with the arrow showing the change in percentage points against four weeks earlier. The latest move comes from the lab's own release notes.`,
      })}</p>
    </section>
  );
}
