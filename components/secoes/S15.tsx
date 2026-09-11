'use client';
/**
 * Seção 15: como ler cada indicador. É a própria referência, então não tem
 * botão "?": lista todos os verbetes cadastrados em content/indicadores, com o
 * que é, como é calculado e o que não conclui, e um filtro por texto.
 */
import { useEffect, useMemo, useState } from 'react';
import type { Mercado } from '@/lib/tipos';
import { useHistorico } from '@/components/shell/Historico';
import { useInfo } from '@/components/shell/Info';
import { useIdioma } from '@/components/shell/Idioma';
import { Secao } from '@/components/shell/Cartao';
import s from './s15.module.css';

const html = (t: string) => ({ __html: t });
const normal = (t: string) => t.replace(/<[^>]+>/g, ' ').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function S15(_: { M: Mercado }) {
  const { D } = useHistorico();
  const { conteudo, abrir } = useInfo();
  const { t, f } = useIdioma();
  const [q, setQ] = useState('');
  const [abertos, setAbertos] = useState<Set<string>>(new Set());

  const inds = conteudo.indicadores;
  const usos = useMemo(() => {
    const u: Record<string, { id: string; titulo: string }[]> = {};
    for (const g of Object.values(conteudo.graficos)) for (const k of g.indicadores) (u[k] ??= []).push({ id: g.id, titulo: g.titulo });
    return u;
  }, [conteudo]);
  const termos = normal(q).split(/\s+/).filter(Boolean);
  const visiveis = termos.length
    ? inds.filter(i => { const h = normal(`${i.titulo} ${i.oQueE} ${i.comoECalculado} ${i.oQueNaoConclui}`); return termos.every(k => h.includes(k)); })
    : inds;

  // Com busca ativa, os verbetes encontrados abrem sozinhos; sem busca, fecham.
  useEffect(() => { setAbertos(termos.length ? new Set(visiveis.map(i => i.slug)) : new Set()); }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  // Link direto para um verbete: #ind-<slug>.
  useEffect(() => {
    const h = location.hash.slice(1);
    if (h.startsWith('ind-')) { setAbertos(new Set([h.slice(4)])); document.getElementById(h)?.scrollIntoView(); }
  }, []);

  const pc = (v: number) => Math.round(v * 100);
  return (
    <Secao id="s15" n="15" titulo={t({ pt: 'Como ler cada indicador', en: 'How to read each indicator' })}
      sub={t({
        pt: <>Cada indicador responde três perguntas: o que é, como é calculado e o que <b>não</b> conclui. A terceira é a que mais importa numa decisão, e a que quase nenhum painel publica.</>,
        en: <>Each indicator answers three questions: what it is, how it&apos;s calculated and what it does <b>not</b> prove. The third matters most in a decision, and it is the one almost no dashboard publishes.</>,
      })}>
      <div className="card">
        <div className={s.met}>
          {t({
            pt: <>
              <p><b>Fonte.</b> Ranking diário público de tráfego de tokens de um roteador de modelos de linguagem, sob licença <a href="https://creativecommons.org/licenses/by/4.0/" rel="license noopener">CC BY 4.0</a>, com a atribuição completa no rodapé. Índices de qualidade vêm da Artificial Analysis pela mesma fonte, sem recálculo.</p>
              <p><b>Duas escalas de tempo.</b> O Histórico usa só semanas completas, de segunda a domingo: {D.weeks.length} semanas, de {f.fD(D.weeks[0])} à semana de {f.fD(D.last_week)}, com {D.n_models} modelos. O bloco Agora usa o dado diário até o último dia publicado, {f.fD(D.daily_last)}, em janelas de 7 e 30 dias.</p>
              <p><b>Gasto é estimativa.</b> A fonte soma tokens de entrada e de saída sem separar, então o gasto usa a mistura de {pc(D.blend.prompt)}% de entrada e {pc(D.blend.completion)}% de saída a preço de tabela, com piso e teto publicados. Endpoint gratuito custa zero.</p>
              <p><b>Variantes de endpoint.</b> No Agora e nas páginas de modelo, variantes como <span className="mono">:free</span> são somadas no modelo base. No Histórico elas ficam separadas, porque a cobrança é uma das dimensões de filtro.</p>
            </>,
            en: <>
              <p><b>Source.</b> A public daily ranking of token traffic on a language model router, under a <a href="https://creativecommons.org/licenses/by/4.0/" rel="license noopener">CC BY 4.0</a> license, with full attribution in the footer. Quality indices come from Artificial Analysis through the same source, without recalculation.</p>
              <p><b>Two time scales.</b> History uses only full weeks, Monday to Sunday: {D.weeks.length} weeks, from {f.fD(D.weeks[0])} to the week of {f.fD(D.last_week)}, with {D.n_models} models. The Now block uses daily data through the latest published day, {f.fD(D.daily_last)}, in 7- and 30-day windows.</p>
              <p><b>Spend is an estimate.</b> The source sums input and output tokens without separating them, so spend uses a blend of {pc(D.blend.prompt)}% input and {pc(D.blend.completion)}% output at list price, with a published floor and ceiling. A free endpoint costs zero.</p>
              <p><b>Endpoint variants.</b> In Now and on model pages, variants such as <span className="mono">:free</span> are added to the base model. In History they stay separate, because billing is one of the filter dimensions.</p>
            </>,
          })}
        </div>
        <div className={s.barra}>
          <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={t({ pt: 'filtrar, ex.: preço, top 10, China', en: 'filter, e.g. price, top 10, China' })}
            aria-label={t({ pt: 'Filtrar indicadores por texto', en: 'Filter indicators by text' })} aria-controls="s15-lista" />
          <span className={s.cont} aria-live="polite">{termos.length
            ? t({ pt: `${visiveis.length} de ${inds.length} indicadores`, en: `${visiveis.length} of ${inds.length} indicators` })
            : t({ pt: `${inds.length} indicadores`, en: `${inds.length} ${inds.length === 1 ? 'indicator' : 'indicators'}` })}</span>
          <button type="button" className="tbtn" onClick={() => setAbertos(new Set(visiveis.map(i => i.slug)))}>{t({ pt: 'abrir todos', en: 'expand all' })}</button>
          <button type="button" className="tbtn" onClick={() => setAbertos(new Set())}>{t({ pt: 'fechar todos', en: 'collapse all' })}</button>
        </div>
        {visiveis.length ? (
          <div className={s.lista} id="s15-lista">
            {visiveis.map(i => (
              <details key={i.slug} id={'ind-' + i.slug} className={s.item} open={abertos.has(i.slug)}
                onToggle={e => {
                  const aberto = (e.currentTarget as HTMLDetailsElement).open;
                  setAbertos(prev => { if (prev.has(i.slug) === aberto) return prev; const n = new Set(prev); aberto ? n.add(i.slug) : n.delete(i.slug); return n; });
                }}>
                <summary>{i.titulo}</summary>
                <div className={s.blc}><span className={s.k}>{t({ pt: 'o que é', en: 'what it is' })}</span><p dangerouslySetInnerHTML={html(i.oQueE)} /></div>
                <div className={s.blc}><span className={s.k}>{t({ pt: 'como é calculado', en: "how it's calculated" })}</span><p dangerouslySetInnerHTML={html(i.comoECalculado)} /></div>
                <div className={s.blc + ' nao'}><span className={s.k}>{t({ pt: 'o que não conclui', en: "what it doesn't prove" })}</span><p dangerouslySetInnerHTML={html(i.oQueNaoConclui)} /></div>
                {usos[i.titulo]?.length ? (
                  <div className={s.usado}>
                    <span>{t({ pt: 'Usado em:', en: 'Used in:' })}</span>
                    {usos[i.titulo].map(g => <button key={g.id} type="button" onClick={() => abrir(g.id)} aria-label={`${t({ pt: 'Como ler', en: 'How to read' })}: ${g.titulo}`}>{g.titulo}</button>)}
                  </div>
                ) : null}
              </details>
            ))}
          </div>
        ) : <p className="vazio">{t({
          pt: 'Nenhum indicador com esse termo. A busca olha o título e os três textos de cada verbete.',
          en: 'No indicator matches that term. The search covers the title and the three texts of each entry.',
        })}</p>}
      </div>
    </Secao>
  );
}
