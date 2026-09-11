'use client';
import type { ReactNode } from 'react';
import { BotaoInfo, useInfo } from './Info';
import { useIdioma } from './Idioma';

/**
 * Cartão de gráfico. Título e subtítulo vêm do conteúdo cadastrado (content/
 * graficos/<id>.md) quando não são passados, para o texto morar num lugar só.
 */
export function Cartao({ id, titulo, subtitulo, acoes, children, className, novo }: {
  id: string; titulo?: ReactNode; subtitulo?: ReactNode; acoes?: ReactNode; children: ReactNode; className?: string; novo?: boolean;
}) {
  const { conteudo } = useInfo();
  const { t } = useIdioma();
  const g = conteudo.graficos[id];
  return (
    <div className={'card' + (className ? ' ' + className : '')} data-chart={id} data-tipo={g?.tipo}>
      <div className="card-h">
        <div style={{ minWidth: 0 }}>
          <h3>{titulo ?? g?.titulo ?? id} {novo && <span className="badge" style={{ marginLeft: 6, verticalAlign: 2 }}>{t({ pt: 'novo', en: 'new' })}</span>}</h3>
          {(subtitulo ?? g?.subtitulo) && <p>{subtitulo ?? g?.subtitulo}</p>}
        </div>
        <div className="acoes">{acoes}<BotaoInfo id={id} /></div>
      </div>
      {children}
    </div>
  );
}

/** Seletor de modo (botões mutuamente exclusivos). */
export function Modos<T extends string>({ valor, opcoes, onChange, rotulo }: { valor: T; opcoes: [T, string][]; onChange: (v: T) => void; rotulo: string }) {
  return (
    <div className="modos" role="group" aria-label={rotulo}>
      {opcoes.map(([v, r]) => <button key={v} type="button" aria-pressed={valor === v} onClick={() => onChange(v)}>{r}</button>)}
    </div>
  );
}

export function Secao({ id, n, titulo, sub, children }: { id: string; n: string; titulo: string; sub?: ReactNode; children: ReactNode }) {
  return (
    <section className="blk" id={id} aria-labelledby={id + '-t'}>
      <div className="sec-h"><span className="n">{n}</span><h2 id={id + '-t'}>{titulo}</h2></div>
      {sub && <p className="sec-sub">{sub}</p>}
      {children}
    </section>
  );
}
