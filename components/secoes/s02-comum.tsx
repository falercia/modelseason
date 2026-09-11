'use client';
/**
 * Auxiliares compartilhados pelas seções 02, 03 e 04. Nada aqui recorta dado:
 * tudo recebe o Recorte pronto do motor e só formata, nomeia ou localiza.
 */
import { useMemo, type ReactNode } from 'react';
import Link from 'next/link';
import type { DadosV1, Recorte } from '@/lib/engine';
import type { LinhaTip } from '@/components/graficos/base';
import { curto, fPer, urlModelo } from '@/lib/format';

/** Nome legível de cada slug, a partir do catálogo embutido na matriz. */
export function useNomes(D: DadosV1) {
  return useMemo(() => {
    const mapa = new Map<string, string>();
    for (const m of D.matriz.modelos) {
      if (!m.n) continue;
      const base = m.n.replace(/^[^:]{1,40}:\s*/, '');
      const suf = m.s.match(/:(free|beta|thinking|extended)$/)?.[1];
      mapa.set(m.s, suf && !base.toLowerCase().includes(suf) ? `${base} (${suf})` : base);
    }
    return (slug: string) => mapa.get(slug) ?? curto(slug);
  }, [D]);
}

/** Link para a página do modelo. Sem prefetch: são dezenas de links por tela. */
export function LinkModelo({ slug, nome, className }: { slug: string; nome: string; className?: string }) {
  return <Link href={urlModelo(slug)} prefetch={false} className={className} title={slug}>{nome}</Link>;
}

/** Primeiro período da janela com volume que o display consegue mostrar (regra dos tiles da v1). */
export function indiceBase(tot: number[]): number {
  for (let i = 0; i < tot.length; i++) if ((tot[i] || 0) >= 0.005) return i;
  return -1;
}

/** Último período da janela com volume. Filtro de modelo que saiu de cena termina antes do fim do eixo. */
export function indiceFim(tot: number[]): number {
  for (let i = tot.length - 1; i >= 0; i--) if ((tot[i] || 0) >= 0.005) return i;
  return -1;
}

/** Unidade do período, no singular e no plural. */
export const per = (R: Recorte) => (R.estado.gran === 'mes' ? { um: 'mês', n: 'meses', adj: 'mensal' } : { um: 'semana', n: 'semanas', adj: 'semanal' });
export const qtdPer = (R: Recorte, n: number) => `${n} ${n === 1 ? per(R).um : per(R).n}`;
/** "semana de 31 ago 26" ou "ago 26". */
export const quando = (R: Recorte, i: number) => (R.estado.gran === 'mes' ? fPer(R.eixo[i], 'mes') : 'semana de ' + fPer(R.eixo[i], 'semana'));
/** "entre as semanas de 06 jan 25 e 31 ago 26" ou "entre jan 25 e ago 26". */
export const entre = (R: Recorte, a: number, b: number) =>
  R.estado.gran === 'mes' ? `entre ${fPer(R.eixo[a], 'mes')} e ${fPer(R.eixo[b], 'mes')}` : `entre as semanas de ${fPer(R.eixo[a], 'semana')} e ${fPer(R.eixo[b], 'semana')}`;
/** "na semana de 31 ago 26" ou "em ago 26". */
export const naQuando = (R: Recorte, i: number) => (R.estado.gran === 'mes' ? 'em ' : 'na ') + quando(R, i);

/** Linha extra do tooltip no agrupamento mensal: quantas semanas o mês tem. */
export const tipSemanas = (R: Recorte) => (i: number): LinhaTip[] =>
  R.estado.gran === 'mes' ? [{ rot: 'semanas no mês', val: String(R.semanasPorBucket[i] ?? '—') }] : [];

/** Bloco de leitura. Com filtro ativo, avisa que os números são do recorte. */
export function Leitura({ R, children }: { R: Recorte | null; children: ReactNode }) {
  const fim = R ? indiceFim(R.weekly_total_T) : -1;
  return (
    <div className="leitura" aria-live="polite">
      {R?.cobertura.filtrando && <p style={{ marginBottom: 4 }}><span className="pill" style={{ marginLeft: 0, marginRight: 6 }}>recorte</span>Números calculados só sobre os modelos do filtro ativo.</p>}
      {R && fim >= 0 && fim < R.N - 1 && (
        <p style={{ marginBottom: 4 }}>O recorte não tem volume desde {R.estado.gran === 'mes' ? '' : 'a '}{quando(R, fim + 1)}, então a comparação abaixo termina {naQuando(R, fim)}, o último período com volume.</p>
      )}
      {children}
    </div>
  );
}

/** Espaço entre parágrafos da leitura, sem depender de CSS global novo. */
export const P = ({ children }: { children: ReactNode }) => <p style={{ marginTop: 5 }}>{children}</p>;
