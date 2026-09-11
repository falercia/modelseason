'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BotaoComoLer } from './Info';
import { SeletorIdioma, useIdioma } from './Idioma';

export type ItemBusca = { s: string; n: string; l: string; sh: number };

const normal = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Busca por nome, laboratório ou qualquer parte do slug. Leva à página do modelo. */
export function Busca({ itens }: { itens: ItemBusca[] }) {
  const [q, setQ] = useState('');
  const [aberto, setAberto] = useState(false);
  const [sel, setSel] = useState(0);
  const router = useRouter();
  const { t, f, modelo, nomeLab } = useIdioma();
  const box = useRef<HTMLDivElement>(null);
  const res = useMemo(() => {
    const t = normal(q.trim()); if (!t) return [];
    const partes = t.split(/\s+/);
    return itens.filter(i => { const h = normal(`${i.n} ${i.l} ${i.s}`); return partes.every(p => h.includes(p)); }).slice(0, 8);
  }, [q, itens]);
  useEffect(() => {
    const f = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setAberto(false); };
    document.addEventListener('click', f); return () => document.removeEventListener('click', f);
  }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === '/' && !(e.target as HTMLElement).closest('input,textarea')) { e.preventDefault(); box.current?.querySelector('input')?.focus(); }
    };
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k);
  }, []);
  const ir = (s: string) => { setAberto(false); setQ(''); router.push(modelo(s)); };
  return (
    <div className="busca" ref={box} role="search">
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" /></svg>
      <input type="search" value={q} placeholder={t({ pt: 'Buscar modelo ou laboratório', en: 'Search model or lab' })} aria-label={t({ pt: 'Buscar modelo ou laboratório', en: 'Search model or lab' })}
        role="combobox" aria-expanded={aberto && !!q} aria-controls="busca-lista" aria-autocomplete="list"
        onChange={e => { setQ(e.target.value); setAberto(true); setSel(0); }} onFocus={() => setAberto(true)}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, res.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(s - 1, 0)); }
          if (e.key === 'Enter' && res[sel]) ir(res[sel].s);
          if (e.key === 'Escape') setAberto(false);
        }} />
      {aberto && q && (
        <ul id="busca-lista" role="listbox">
          {res.length ? res.map((r, i) => (
            <li key={r.s} role="option" aria-selected={i === sel}>
              <Link href={modelo(r.s)} onClick={() => { setAberto(false); setQ(''); }}>
                <span>{r.n}</span><small>{nomeLab(r.l)} · <span className="mono">{r.s}</span></small>
                <b>{r.sh > 0 ? f.fmtP(r.sh) : t({ pt: 'fora da semana', en: 'not this week' })}</b>
              </Link>
            </li>
          )) : <li className="nada">{t({ pt: 'Nenhum modelo com esse nome.', en: 'No model by that name.' })}</li>}
        </ul>
      )}
    </div>
  );
}

export function Tema() {
  const { t } = useIdioma();
  const [tema, setTema] = useState<'claro' | 'escuro' | null>(null);
  useEffect(() => {
    const t = document.documentElement.dataset.theme;
    setTema(t === 'dark' ? 'escuro' : t === 'light' ? 'claro' : matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro');
  }, []);
  const trocar = () => {
    const novo = tema === 'escuro' ? 'claro' : 'escuro';
    document.documentElement.dataset.theme = novo === 'escuro' ? 'dark' : 'light';
    try { localStorage.setItem('ms-tema', novo === 'escuro' ? 'dark' : 'light'); } catch { /* sem armazenamento */ }
    setTema(novo);
  };
  return (
    <button type="button" className="tbtn" onClick={trocar} aria-label={tema === 'escuro' ? t({ pt: 'Usar tema claro', en: 'Use light theme' }) : t({ pt: 'Usar tema escuro', en: 'Use dark theme' })}
      title={t({ pt: 'Alternar tema', en: 'Toggle theme' })}>
      <span aria-hidden="true">◐</span>
    </button>
  );
}

export function Topo({ itens }: { itens: ItemBusca[] }) {
  const { t, url } = useIdioma();
  return (
    <header className="top">
      <div className="top-in">
        <Link href={url('/')} className="brand">Model Season <span className="mono">{t({ pt: 'temporadas de modelos', en: 'every model has a season' })}</span></Link>
        <Busca itens={itens} />
        <span className="sp" />
        <BotaoComoLer />
        <SeletorIdioma />
        <Tema />
      </div>
    </header>
  );
}

/** Índice lateral com a seção visível destacada. */
export function Indice({ grupos }: { grupos: { lbl: string; itens: { href: string; n: string; t: string }[] }[] }) {
  const { t } = useIdioma();
  const [atual, setAtual] = useState<string>('');
  useEffect(() => {
    const ids = grupos.flatMap(g => g.itens.map(i => i.href.slice(1)));
    const els = ids.map(id => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver(ents => {
      const vis = ents.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (vis[0]) setAtual(vis[0].target.id);
    }, { rootMargin: '-120px 0px -65% 0px' });
    els.forEach(e => io.observe(e)); return () => io.disconnect();
  }, [grupos]);
  return (
    <nav className="rail" aria-label={t({ pt: 'Índice da página', en: 'Page contents' })}>
      {grupos.map(g => (
        <div className="grp" key={g.lbl}>
          <p className="lbl">{g.lbl}</p>
          {g.itens.map(i => <a key={i.href} href={i.href} aria-current={atual === i.href.slice(1) ? 'true' : undefined}><span className="n">{i.n}</span>{i.t}</a>)}
        </div>
      ))}
    </nav>
  );
}
