'use client';
/**
 * Campo de busca com lista (padrão combobox da WAI-ARIA). Casa qualquer parte
 * do nome, do laboratório ou do slug, com várias palavras soltas e sem acento.
 * O datalist nativo só casa prefixo, e como todo slug começa pelo laboratório,
 * digitar "sonnet" não trazia nada: foi o motivo de a v1 ter lista própria.
 */
import { useId, useRef, useState } from 'react';
import { cor } from '@/components/graficos/base';
import { fmtP } from '@/lib/format';
import s from './s12.module.css';

export interface OpcaoModelo { slug: string; nome: string; lab: string; share: number; ativo: boolean }

const normal = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const LIMITE = 60;

export function Combobox({ rotulo, slot, valor, opcoes, onEscolher }: {
  rotulo: string; slot: string; valor: OpcaoModelo; opcoes: OpcaoModelo[]; onEscolher: (slug: string) => void;
}) {
  const id = useId();
  const [texto, setTexto] = useState<string | null>(null); // null = mostrando o selecionado
  const [aberto, setAberto] = useState(false);
  const [foco, setFoco] = useState(-1);
  const lista = useRef<HTMLUListElement>(null);

  const consulta = texto == null ? '' : normal(texto.trim());
  const termos = consulta.split(/\s+/).filter(Boolean);
  const achados = (termos.length
    ? opcoes.filter(o => { const h = normal(`${o.nome} ${o.lab} ${o.slug}`); return termos.every(t => h.includes(t)); })
    : opcoes).slice(0, LIMITE);

  const fechar = () => { setAberto(false); setFoco(-1); setTexto(null); };
  const escolher = (slug?: string) => { if (slug) onEscolher(slug); fechar(); };
  const mover = (d: number) => {
    if (!aberto) { setAberto(true); return; }
    const n = Math.max(0, Math.min(achados.length - 1, foco + d));
    setFoco(n);
    lista.current?.children[n]?.scrollIntoView({ block: 'nearest' });
  };

  return (
    <div className={s.cbx}>
      <label htmlFor={id + 'i'}><i style={{ background: cor(slot) }} aria-hidden="true" />{rotulo}</label>
      <input
        id={id + 'i'} type="text" role="combobox" autoComplete="off" spellCheck={false}
        aria-expanded={aberto} aria-controls={id + 'l'} aria-autocomplete="list"
        aria-activedescendant={aberto && foco >= 0 ? `${id}o${foco}` : undefined}
        aria-describedby={id + 's'}
        placeholder="digite parte do nome, ex.: sonnet"
        value={texto ?? valor.nome}
        onFocus={e => { setAberto(true); setFoco(-1); e.currentTarget.select(); }}
        onChange={e => { setTexto(e.target.value); setAberto(true); setFoco(-1); }}
        onBlur={() => fechar()}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); mover(1); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); mover(-1); }
          else if (e.key === 'Enter') { if (aberto) { e.preventDefault(); escolher(achados[foco >= 0 ? foco : 0]?.slug); } }
          else if (e.key === 'Escape') { if (aberto) { e.preventDefault(); fechar(); } }
        }}
      />
      <span className={s.slug + ' mono'} id={id + 's'}>{valor.slug}{valor.ativo ? '' : ' · sem volume no último período'}</span>
      <ul ref={lista} id={id + 'l'} role="listbox" aria-label={`Modelos para ${rotulo}`} className={s.lista} hidden={!aberto}>
        {achados.length ? achados.map((o, i) => (
          <li key={o.slug} id={`${id}o${i}`} role="option" aria-selected={i === foco}
            // mousedown, não click: o blur do campo fecharia a lista antes do clique.
            onMouseDown={e => { e.preventDefault(); escolher(o.slug); }}>
            <span className={s.nm}>{o.nome}</span>
            <small className="mono">{o.lab} · {o.slug}</small>
            <b>{o.ativo ? fmtP(o.share, o.share < 1 ? 2 : 1) : 'sem volume'}</b>
          </li>
        )) : <li className={s.nada} role="option" aria-disabled="true" aria-selected={false}>nenhum modelo do recorte com esse termo</li>}
      </ul>
    </div>
  );
}
