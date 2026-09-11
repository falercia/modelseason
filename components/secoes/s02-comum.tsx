'use client';
/**
 * Auxiliares compartilhados pelas seções 02, 03 e 04. Nada aqui recorta dado:
 * tudo recebe o Recorte pronto do motor e só formata, nomeia ou localiza.
 */
import { useMemo, type ReactNode } from 'react';
import Link from 'next/link';
import type { DadosV1, Recorte } from '@/lib/engine';
import type { LinhaTip } from '@/components/graficos/base';
import { curto } from '@/lib/format';
import { useIdioma } from '@/components/shell/Idioma';

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
  const { modelo } = useIdioma();
  return <Link href={modelo(slug)} prefetch={false} className={className} title={slug}>{nome}</Link>;
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

/**
 * Como falar do período do recorte, no idioma da página. Hook: dentro do
 * componente, const { per, qtdPer, quando, entre, naQuando, tipSemanas } = usePeriodo();
 *
 *   per(R)          { um: 'semana', n: 'semanas', adj: 'semanal' } / { um: 'week', n: 'weeks', adj: 'weekly' }
 *   qtdPer(R, 3)    "3 semanas" / "3 weeks"
 *   quando(R, i)    "semana de 31 ago 26" ou "ago 26" / "week of Aug 31, 2026" ou "Aug 2026"
 *   entre(R, a, b)  "entre as semanas de 06 jan 25 e 31 ago 26" / "between the weeks of Jan 6, 2025 and Aug 31, 2026"
 *   naQuando(R, i)  "na semana de 31 ago 26" ou "em ago 26" / "in the week of Aug 31, 2026" ou "in Aug 2026"
 */
export function usePeriodo() {
  const { t, f } = useIdioma();
  const mes = (R: Recorte) => R.estado.gran === 'mes';
  const per = (R: Recorte) => (mes(R)
    ? t({ pt: { um: 'mês', n: 'meses', adj: 'mensal' }, en: { um: 'month', n: 'months', adj: 'monthly' } })
    : t({ pt: { um: 'semana', n: 'semanas', adj: 'semanal' }, en: { um: 'week', n: 'weeks', adj: 'weekly' } }));
  const qtdPer = (R: Recorte, n: number) => `${n} ${n === 1 ? per(R).um : per(R).n}`;
  const quando = (R: Recorte, i: number) => (mes(R) ? f.fPer(R.eixo[i], 'mes') : t({ pt: 'semana de ', en: 'week of ' }) + f.fPer(R.eixo[i], 'semana'));
  const entre = (R: Recorte, a: number, b: number) => (mes(R)
    ? t({ pt: `entre ${f.fMes(R.eixo[a])} e ${f.fMes(R.eixo[b])}`, en: `between ${f.fMes(R.eixo[a])} and ${f.fMes(R.eixo[b])}` })
    : t({ pt: `entre as semanas de ${f.fD(R.eixo[a])} e ${f.fD(R.eixo[b])}`, en: `between the weeks of ${f.fD(R.eixo[a])} and ${f.fD(R.eixo[b])}` }));
  const naQuando = (R: Recorte, i: number) => (mes(R) ? t({ pt: 'em ', en: 'in ' }) : t({ pt: 'na ', en: 'in the ' })) + quando(R, i);
  /** Linha extra do tooltip no agrupamento mensal: quantas semanas o mês tem. */
  const tipSemanas = (R: Recorte) => (i: number): LinhaTip[] =>
    mes(R) ? [{ rot: t({ pt: 'semanas no mês', en: 'weeks in the month' }), val: String(R.semanasPorBucket[i] ?? '—') }] : [];
  return { per, qtdPer, quando, entre, naQuando, tipSemanas };
}

/** Bloco de leitura. Com filtro ativo, avisa que os números são do recorte. */
export function Leitura({ R, children }: { R: Recorte | null; children: ReactNode }) {
  const { t } = useIdioma();
  const { quando, naQuando } = usePeriodo();
  const fim = R ? indiceFim(R.weekly_total_T) : -1;
  const mes = R?.estado.gran === 'mes';
  return (
    <div className="leitura" aria-live="polite">
      {R?.cobertura.filtrando && <p style={{ marginBottom: 4 }}><span className="pill" style={{ marginLeft: 0, marginRight: 6 }}>{t({ pt: 'recorte', en: 'filtered' })}</span>
        {t({ pt: 'Números calculados só sobre os modelos do filtro ativo.', en: 'Figures calculated only over the models in the active filter.' })}</p>}
      {R && fim >= 0 && fim < R.N - 1 && (
        <p style={{ marginBottom: 4 }}>{t({
          pt: `O recorte não tem volume desde ${mes ? '' : 'a '}${quando(R, fim + 1)}, então a comparação abaixo termina ${naQuando(R, fim)}, o último período com volume.`,
          en: `The filtered view has had no volume since ${mes ? '' : 'the '}${quando(R, fim + 1)}, so the comparison below ends ${naQuando(R, fim)}, the last period with volume.`,
        })}</p>
      )}
      {children}
    </div>
  );
}

/** Espaço entre parágrafos da leitura, sem depender de CSS global novo. */
export const P = ({ children }: { children: ReactNode }) => <p style={{ marginTop: 5 }}>{children}</p>;
