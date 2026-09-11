'use client';
/**
 * O painel lateral do "?" e do "Como ler esta página". O título do painel é o
 * título DO GRÁFICO clicado; o texto próprio do gráfico vem primeiro, e a
 * definição formal dos indicadores depois. Verbete mora num lugar só.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Conteudo } from '@/lib/content';
import type { Lang } from '@/lib/i18n';
import { useIdioma } from './Idioma';

interface Ctx { abrir: (id?: string) => void; conteudo: Conteudo }
const InfoCtx = createContext<Ctx | null>(null);
export const useInfo = () => {
  const c = useContext(InfoCtx);
  if (!c) throw new Error('useInfo fora do InfoProvider');
  return c;
};

const html = (s: string) => ({ __html: s });

/**
 * conteudo: o do idioma da página, ou os de todos os idiomas (páginas 404, que
 * não sabem o idioma no servidor); nesse caso a escolha é feita aqui.
 */
export function InfoProvider({ conteudo: entrada, children }: { conteudo: Conteudo | Partial<Record<Lang, Conteudo>>; children: ReactNode }) {
  const { lang, t } = useIdioma();
  const conteudo = ('graficos' in entrada ? entrada : entrada[lang] ?? Object.values(entrada)[0]) as Conteudo;
  const [aberto, setAberto] = useState<string | null>(null); // '' = todos os indicadores
  const antes = useRef<HTMLElement | null>(null);
  const fechar = useRef<HTMLButtonElement>(null);
  const abrir = useCallback((id?: string) => { antes.current = document.activeElement as HTMLElement; setAberto(id ?? ''); }, []);
  const sair = useCallback(() => { setAberto(null); antes.current?.focus?.(); }, []);
  useEffect(() => {
    if (aberto == null) return;
    document.body.style.overflow = 'hidden';
    fechar.current?.focus();
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') sair(); };
    document.addEventListener('keydown', k);
    return () => { document.body.style.overflow = ''; document.removeEventListener('keydown', k); };
  }, [aberto, sair]);

  const g = aberto ? conteudo.graficos[aberto] : undefined;
  const verbetes = g ? conteudo.indicadores.filter(i => g.indicadores.includes(i.titulo)) : conteudo.indicadores;
  return (
    <InfoCtx.Provider value={{ abrir, conteudo }}>
      {children}
      {aberto != null && (
        <>
          <div className="fundo" onClick={sair} />
          <aside className="painel" role="dialog" aria-modal="true" aria-labelledby="painel-t" data-grafico={aberto || undefined}>
            <div className="painel-h">
              <div>
                <span className="kicker">{g ? t({ pt: 'Como ler este gráfico', en: 'How to read this chart' }) : t({ pt: 'Referência', en: 'Reference' })}</span>
                <h2 id="painel-t">{g ? g.titulo : t({ pt: 'Como ler esta página', en: 'How to read this page' })}</h2>
              </div>
              <button ref={fechar} className="q" onClick={sair} aria-label={t({ pt: 'Fechar', en: 'Close' })}>✕</button>
            </div>
            <div className="painel-corpo">
              {g ? (
                <>
                  <div className="blc"><span className="k">{t({ pt: 'como ler', en: 'how to read' })}</span><p dangerouslySetInnerHTML={html(g.comoLer)} /></div>
                  <div className="blc"><span className="k">{t({ pt: 'a pergunta que responde', en: 'the question it answers' })}</span><p dangerouslySetInnerHTML={html(g.perguntaQueResponde)} /></div>
                  <div className="blc nao"><span className="k">{t({ pt: 'o que não mostra', en: "what it doesn't show" })}</span><p dangerouslySetInnerHTML={html(g.oQueNaoMostra)} /></div>
                  <p className="lig">{verbetes.length === 1
                    ? t({ pt: 'A definição formal do indicador usado aqui:', en: 'The formal definition of the indicator used here:' })
                    : t({ pt: `As definições formais dos ${verbetes.length} indicadores usados aqui:`, en: `The formal definitions of the ${verbetes.length} indicators used here:` })}</p>
                </>
              ) : (
                <>
                  {t({
                    pt: <>
                      <p>Model Season mede para onde vai o tráfego de tokens dos modelos de linguagem num roteador público, e para que ele está sendo usado. Três regras valem para a página inteira.</p>
                      <p><b>Share é fatia do tráfego deste roteador</b>, onde a decisão costuma ser preço por token. Não é participação de mercado, de receita nem de usuários.</p>
                      <p><b>Ausência não vira zero.</b> Modelo sem avaliação fica sem avaliação; semana sem dado fica fora do gráfico. <b>Gasto é estimativa</b>, com piso e teto publicados.</p>
                      <p><b>O bloco Agora usa dado diário até o último dia publicado.</b> O Histórico usa semanas completas e responde à janela, ao agrupamento e aos filtros.</p>
                      <p className="lig" style={{ marginTop: 14 }}>Os {verbetes.length} indicadores, cada um com o que é, como é calculado e o que não conclui:</p>
                    </>,
                    en: <>
                      <p>Model Season measures where language model token traffic goes on a public router, and what it is being used for. Three rules apply to the whole page.</p>
                      <p><b>Share is a slice of this router&apos;s traffic</b>, where the deciding factor is usually price per token. It is not market share, revenue share or user share.</p>
                      <p><b>Missing is not zero.</b> A model without a benchmark stays without one; a week without data stays off the chart. <b>Spend is an estimate</b>, with a published floor and ceiling.</p>
                      <p><b>The Now block uses daily data through the latest published day.</b> History uses full weeks and responds to the window, grouping and filters.</p>
                      <p className="lig" style={{ marginTop: 14 }}>The {verbetes.length} indicators, each with what it is, how it&apos;s calculated and what it doesn&apos;t prove:</p>
                    </>,
                  })}
                </>
              )}
              {verbetes.map(v => (
                <details key={v.slug} open={!!g}>
                  <summary>{v.titulo}</summary>
                  <div className="blc"><span className="k">{t({ pt: 'o que é', en: 'what it is' })}</span><p dangerouslySetInnerHTML={html(v.oQueE)} /></div>
                  <div className="blc"><span className="k">{t({ pt: 'como é calculado', en: "how it's calculated" })}</span><p dangerouslySetInnerHTML={html(v.comoECalculado)} /></div>
                  <div className="blc nao"><span className="k">{t({ pt: 'o que não conclui', en: "what it doesn't prove" })}</span><p dangerouslySetInnerHTML={html(v.oQueNaoConclui)} /></div>
                </details>
              ))}
              {g && <p style={{ marginTop: 12 }}><button className="tbtn" onClick={() => setAberto('')}>{t({ pt: 'Ver todos os indicadores', en: 'See all indicators' })}</button></p>}
            </div>
          </aside>
        </>
      )}
    </InfoCtx.Provider>
  );
}

/** Botão "?" de um cartão. Sem conteúdo cadastrado, o build falha no teste e2e. */
export function BotaoInfo({ id, titulo }: { id: string; titulo?: string }) {
  const { abrir, conteudo } = useInfo();
  const { t } = useIdioma();
  const g = conteudo.graficos[id];
  return (
    <button type="button" className="q" data-info={id} onClick={() => abrir(id)}
      aria-label={`${t({ pt: 'Como ler', en: 'How to read' })}: ${g?.titulo ?? titulo ?? id}`}
      title={g ? t({ pt: 'Como ler este gráfico', en: 'How to read this chart' }) : t({ pt: 'Sem explicação cadastrada', en: 'No explanation on file' })}>?</button>
  );
}

export function BotaoComoLer({ className = 'tbtn ocultavel' }: { className?: string }) {
  const { abrir } = useInfo();
  const { t } = useIdioma();
  return <button type="button" className={className} onClick={() => abrir()}>{t({ pt: 'Como ler esta página', en: 'How to read this page' })}</button>;
}
