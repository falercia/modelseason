'use client';
/**
 * O painel lateral do "?" e do "Como ler esta página". O título do painel é o
 * título DO GRÁFICO clicado; o texto próprio do gráfico vem primeiro, e a
 * definição formal dos indicadores depois. Verbete mora num lugar só.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Conteudo } from '@/lib/content';

interface Ctx { abrir: (id?: string) => void; conteudo: Conteudo }
const InfoCtx = createContext<Ctx | null>(null);
export const useInfo = () => {
  const c = useContext(InfoCtx);
  if (!c) throw new Error('useInfo fora do InfoProvider');
  return c;
};

const html = (s: string) => ({ __html: s });

export function InfoProvider({ conteudo, children }: { conteudo: Conteudo; children: ReactNode }) {
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
                <span className="kicker">{g ? 'Como ler este gráfico' : 'Referência'}</span>
                <h2 id="painel-t">{g ? g.titulo : 'Como ler esta página'}</h2>
              </div>
              <button ref={fechar} className="q" onClick={sair} aria-label="Fechar">✕</button>
            </div>
            <div className="painel-corpo">
              {g ? (
                <>
                  <div className="blc"><span className="k">como ler</span><p dangerouslySetInnerHTML={html(g.comoLer)} /></div>
                  <div className="blc"><span className="k">a pergunta que responde</span><p dangerouslySetInnerHTML={html(g.perguntaQueResponde)} /></div>
                  <div className="blc nao"><span className="k">o que não mostra</span><p dangerouslySetInnerHTML={html(g.oQueNaoMostra)} /></div>
                  <p className="lig">{verbetes.length === 1 ? 'A definição formal do indicador usado aqui:' : `As definições formais dos ${verbetes.length} indicadores usados aqui:`}</p>
                </>
              ) : (
                <>
                  <p>Model Season mede para onde vai o tráfego de tokens dos modelos de linguagem num roteador público, e para que ele está sendo usado. Três regras valem para a página inteira.</p>
                  <p><b>Share é fatia do tráfego deste roteador</b>, onde a decisão costuma ser preço por token. Não é participação de mercado, de receita nem de usuários.</p>
                  <p><b>Ausência não vira zero.</b> Modelo sem avaliação fica sem avaliação; semana sem dado fica fora do gráfico. <b>Gasto é estimativa</b>, com piso e teto publicados.</p>
                  <p><b>O bloco Agora usa dado diário até o último dia publicado.</b> O Histórico usa semanas completas e responde à janela, ao agrupamento e aos filtros.</p>
                  <p className="lig" style={{ marginTop: 14 }}>Os {verbetes.length} indicadores, cada um com o que é, como é calculado e o que não conclui:</p>
                </>
              )}
              {verbetes.map(v => (
                <details key={v.slug} open={!!g}>
                  <summary>{v.titulo}</summary>
                  <div className="blc"><span className="k">o que é</span><p dangerouslySetInnerHTML={html(v.oQueE)} /></div>
                  <div className="blc"><span className="k">como é calculado</span><p dangerouslySetInnerHTML={html(v.comoECalculado)} /></div>
                  <div className="blc nao"><span className="k">o que não conclui</span><p dangerouslySetInnerHTML={html(v.oQueNaoConclui)} /></div>
                </details>
              ))}
              {g && <p style={{ marginTop: 12 }}><button className="tbtn" onClick={() => setAberto('')}>Ver todos os indicadores</button></p>}
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
  const g = conteudo.graficos[id];
  return (
    <button type="button" className="q" data-info={id} onClick={() => abrir(id)}
      aria-label={`Como ler: ${g?.titulo ?? titulo ?? id}`} title={g ? 'Como ler este gráfico' : 'Sem explicação cadastrada'}>?</button>
  );
}

export function BotaoComoLer({ className = 'tbtn ocultavel' }: { className?: string }) {
  const { abrir } = useInfo();
  return <button type="button" className={className} onClick={() => abrir()}>Como ler esta página</button>;
}
