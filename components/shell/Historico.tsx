'use client';
/**
 * Estado do Histórico: janela, agrupamento e filtros de modelo. O recorte é
 * calculado uma vez aqui e distribuído por contexto; as seções só leem.
 * O estado vai para a URL, então um recorte pode ser compartilhado por link.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { recortar, seriesSemanais, GRUPOS_FILTRO, ORDEM_FILTRO, PESOS_PADRAO,
  type DadosV1, type Estado, type Filtros, type Gran, type Janela, type PesosMapa, type Recorte } from '@/lib/engine';

interface Ctx {
  D: DadosV1; R: Recorte; estado: Estado; pesos: PesosMapa;
  setJanela: (j: Janela) => void; setGran: (g: Gran) => void; setFiltros: (f: Filtros) => void; setPesos: (p: PesosMapa) => void;
}
const HCtx = createContext<Ctx | null>(null);
export const useHistorico = () => { const c = useContext(HCtx); if (!c) throw new Error('useHistorico fora do provider'); return c; };

const JANELAS: [Janela, string][] = [['all', 'Tudo'], ['52', '52 sem'], ['26', '26 sem'], ['13', '13 sem'], ['4', '4 sem']];

function lerURL(D: DadosV1): Estado {
  if (typeof window === 'undefined') return { gran: 'semana', janela: 'all', filtros: {} };
  const p = new URLSearchParams(location.search);
  const filtros: Filtros = {};
  for (const d of D.matriz.dims) {
    const v = p.get(d); if (!v) continue;
    const idx = v.split('|').map(x => D.matriz.dic[d].indexOf(x)).filter(i => i >= 0);
    if (idx.length) filtros[d] = idx;
  }
  const j = p.get('janela') as Janela | null, g = p.get('agrupar');
  return { gran: g === 'mes' ? 'mes' : 'semana', janela: j && ['all', '52', '26', '13', '4', 'ytd'].includes(j) ? j : 'all', filtros };
}

export function HistoricoProvider({ D, children }: { D: DadosV1; children: ReactNode }) {
  const SS = useMemo(() => seriesSemanais(D), [D]);
  const [estado, setEstado] = useState<Estado>({ gran: 'semana', janela: 'all', filtros: {} });
  const [pesos, setPesos] = useState<PesosMapa>(PESOS_PADRAO);
  // Estado da URL só depois de hidratar, para o HTML do servidor e o do cliente baterem.
  useEffect(() => { const e = lerURL(D); if (e.gran !== 'semana' || e.janela !== 'all' || Object.keys(e.filtros).length) setEstado(e); }, [D]);
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    for (const d of D.matriz.dims) p.delete(d);
    p.delete('janela'); p.delete('agrupar');
    if (estado.janela !== 'all') p.set('janela', estado.janela);
    if (estado.gran !== 'semana') p.set('agrupar', estado.gran);
    for (const d in estado.filtros) if (estado.filtros[d].length) p.set(d, estado.filtros[d].map(i => D.matriz.dic[d][i]).join('|'));
    const q = p.toString();
    history.replaceState(null, '', (q ? '?' + q : location.pathname) + location.hash);
  }, [estado, D]);
  const R = useMemo(() => recortar(D, SS, estado, pesos), [D, SS, estado, pesos]);
  const v: Ctx = {
    D, R, estado, pesos, setPesos,
    setJanela: janela => setEstado(e => ({ ...e, janela })),
    setGran: gran => setEstado(e => ({ ...e, gran })),
    setFiltros: filtros => setEstado(e => ({ ...e, filtros })),
  };
  return <HCtx.Provider value={v}>{children}</HCtx.Provider>;
}

export function BarraFiltros() {
  const { D, R, estado, setJanela, setGran, setFiltros } = useHistorico();
  const [aberto, setAberto] = useState(false);
  const nFil = Object.values(estado.filtros).reduce((s, v) => s + v.length, 0);
  useEffect(() => { if (nFil) setAberto(true); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const alternar = (dim: string, i: number) => {
    const atual = new Set(estado.filtros[dim] ?? []);
    atual.has(i) ? atual.delete(i) : atual.add(i);
    const f = { ...estado.filtros, [dim]: [...atual] }; if (!atual.size) delete f[dim];
    setFiltros(f);
  };
  return (
    <div>
      <div className="filtros" role="group" aria-label="Recorte do histórico">
        <span className="lbl">Janela</span>
        {JANELAS.map(([j, r]) => <button key={j} type="button" className="chip" aria-pressed={estado.janela === j} onClick={() => setJanela(j)}>{r}</button>)}
        <span className="sep" />
        <span className="lbl">Agrupar</span>
        <button type="button" className="chip" aria-pressed={estado.gran === 'semana'} onClick={() => setGran('semana')}>Semana</button>
        <button type="button" className="chip" aria-pressed={estado.gran === 'mes'} onClick={() => setGran('mes')}>Mês</button>
        <span className="sep" />
        <button type="button" className="chip" aria-expanded={aberto} aria-controls="fpainel" onClick={() => setAberto(a => !a)}>
          Filtros de modelo{nFil ? ` (${nFil})` : ''} {aberto ? '▴' : '▾'}
        </button>
        {nFil > 0 && <button type="button" className="chip" onClick={() => setFiltros({})}>Limpar</button>}
        <span style={{ flex: 1 }} />
        <span className="fstat" aria-live="polite">
          {R.cobertura.filtrando
            ? <><b>{R.cobertura.modelos}</b> de {R.cobertura.totalModelos} modelos · <b>{R.cobertura.pct.toFixed(1).replace('.', ',')}%</b> do volume</>
            : <>{R.cobertura.totalModelos} modelos, sem recorte</>}
        </span>
      </div>
      {aberto && (
        <div className="fpainel" id="fpainel">
          {GRUPOS_FILTRO.map(([dim, rot]) => {
            let vals = D.matriz.dic[dim].map((v, i) => [v, i] as [string, number]);
            const ord = ORDEM_FILTRO[dim];
            if (ord) vals = vals.sort((a, b) => { const ia = ord.indexOf(a[0]), ib = ord.indexOf(b[0]); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
            return (
              <div key={dim}><div className="t">{rot}</div><div className="opts">
                {vals.map(([v, i]) => <button key={i} type="button" className="chip" aria-pressed={!!estado.filtros[dim]?.includes(i)} onClick={() => alternar(dim, i)}>{v}</button>)}
              </div></div>
            );
          })}
        </div>
      )}
      {R.cobertura.filtrando && (
        <p className="aviso">Com filtro ativo, os percentuais são calculados <b>dentro do recorte</b>, não sobre o mercado inteiro. Modelos sem metadado, incluindo a linha <span className="mono">other</span> da fonte, ficam de fora.</p>
      )}
      {estado.gran === 'mes' && (
        <p className="aviso">No agrupamento mensal, volume absoluto é a <b>média semanal</b> dentro do mês. Mês de cinco semanas não parece 25% maior que um de quatro.</p>
      )}
    </div>
  );
}
