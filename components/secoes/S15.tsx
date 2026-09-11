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
import { Secao } from '@/components/shell/Cartao';
import { fD } from '@/lib/format';
import s from './s15.module.css';

const html = (t: string) => ({ __html: t });
const normal = (t: string) => t.replace(/<[^>]+>/g, ' ').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function S15(_: { M: Mercado }) {
  const { D } = useHistorico();
  const { conteudo, abrir } = useInfo();
  const [q, setQ] = useState('');
  const [abertos, setAbertos] = useState<Set<string>>(new Set());

  const inds = conteudo.indicadores;
  const usos = useMemo(() => {
    const u: Record<string, { id: string; titulo: string }[]> = {};
    for (const g of Object.values(conteudo.graficos)) for (const t of g.indicadores) (u[t] ??= []).push({ id: g.id, titulo: g.titulo });
    return u;
  }, [conteudo]);
  const termos = normal(q).split(/\s+/).filter(Boolean);
  const visiveis = termos.length
    ? inds.filter(i => { const h = normal(`${i.titulo} ${i.oQueE} ${i.comoECalculado} ${i.oQueNaoConclui}`); return termos.every(t => h.includes(t)); })
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
    <Secao id="s15" n="15" titulo="Como ler cada indicador"
      sub={<>Cada indicador responde três perguntas: o que é, como é calculado e o que <b>não</b> conclui. A terceira é a que mais importa numa decisão, e a que quase nenhum painel publica.</>}>
      <div className="card">
        <div className={s.met}>
          <p><b>Fonte.</b> Ranking diário público de tráfego de tokens de um roteador de modelos de linguagem, sob licença <a href="https://creativecommons.org/licenses/by/4.0/" rel="license noopener">CC BY 4.0</a>, com a atribuição completa no rodapé. Índices de qualidade vêm da Artificial Analysis pela mesma fonte, sem recálculo.</p>
          <p><b>Duas escalas de tempo.</b> O Histórico usa só semanas completas, de segunda a domingo: {D.weeks.length} semanas, de {fD(D.weeks[0])} à semana de {fD(D.last_week)}, com {D.n_models} modelos. O bloco Agora usa o dado diário até o último dia publicado, {fD(D.daily_last)}, em janelas de 7 e 30 dias.</p>
          <p><b>Gasto é estimativa.</b> A fonte soma tokens de entrada e de saída sem separar, então o gasto usa a mistura de {pc(D.blend.prompt)}% de entrada e {pc(D.blend.completion)}% de saída a preço de tabela, com piso e teto publicados. Endpoint gratuito custa zero.</p>
          <p><b>Variantes de endpoint.</b> No Agora e nas páginas de modelo, variantes como <span className="mono">:free</span> são somadas no modelo base. No Histórico elas ficam separadas, porque a cobrança é uma das dimensões de filtro.</p>
        </div>
        <div className={s.barra}>
          <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="filtrar, ex.: preço, top 10, China"
            aria-label="Filtrar indicadores por texto" aria-controls="s15-lista" />
          <span className={s.cont} aria-live="polite">{termos.length ? `${visiveis.length} de ${inds.length} indicadores` : `${inds.length} indicadores`}</span>
          <button type="button" className="tbtn" onClick={() => setAbertos(new Set(visiveis.map(i => i.slug)))}>abrir todos</button>
          <button type="button" className="tbtn" onClick={() => setAbertos(new Set())}>fechar todos</button>
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
                <div className={s.blc}><span className={s.k}>o que é</span><p dangerouslySetInnerHTML={html(i.oQueE)} /></div>
                <div className={s.blc}><span className={s.k}>como é calculado</span><p dangerouslySetInnerHTML={html(i.comoECalculado)} /></div>
                <div className={s.blc + ' nao'}><span className={s.k}>o que não conclui</span><p dangerouslySetInnerHTML={html(i.oQueNaoConclui)} /></div>
                {usos[i.titulo]?.length ? (
                  <div className={s.usado}>
                    <span>Usado em:</span>
                    {usos[i.titulo].map(g => <button key={g.id} type="button" onClick={() => abrir(g.id)} aria-label={`Como ler: ${g.titulo}`}>{g.titulo}</button>)}
                  </div>
                ) : null}
              </details>
            ))}
          </div>
        ) : <p className="vazio">Nenhum indicador com esse termo. A busca olha o título e os três textos de cada verbete.</p>}
      </div>
    </Secao>
  );
}
