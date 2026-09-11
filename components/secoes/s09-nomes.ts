/**
 * Nomes curtos de modelo para as seções 09 a 11. O curto() de lib/format tira
 * a data do slug, e duas versões do mesmo modelo (deepseek-v4-flash de abril e
 * de julho) viram o mesmo rótulo na mesma lista. Aqui a data volta só quando
 * há colisão, e o sufixo de endpoint (:free) aparece mesmo com data no slug.
 */
import { curto, type Fmt } from '@/lib/format';

/** Nome curto do slug: sem laboratório, sem data (compacta ou ISO) e com o sufixo de endpoint entre parênteses. */
export const nome = (slug: string) => {
  const [b, suf] = slug.split(':');
  const n = curto(b).replace(/-20\d{2}-\d{2}-\d{2}$/, '');
  return suf ? `${n} (${suf})` : n;
};

/** Data embutida no slug (20260731 ou 2026-07-31), se houver. */
function dataDoSlug(slug: string): string | null {
  const b = slug.split(':')[0];
  const m = b.match(/-(20\d{2})-?(\d{2})-?(\d{2})$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/**
 * Rotulador para uma lista: nome curto, e a data da versão quando dois slugs
 * dariam o mesmo nome. A data sai no formato do idioma (f de useIdioma()).
 */
export function rotulador(slugs: string[], f: Fmt) {
  const { fD, fMes } = f;
  const unicos = [...new Set(slugs)];
  const cont = new Map<string, number>();
  for (const s of unicos) cont.set(nome(s), (cont.get(nome(s)) ?? 0) + 1);
  const porMes = new Map<string, number>();
  for (const s of unicos) { const d = dataDoSlug(s); if (d && (cont.get(nome(s)) ?? 0) > 1) { const k = nome(s) + fMes(d); porMes.set(k, (porMes.get(k) ?? 0) + 1); } }
  return (s: string) => {
    const n = nome(s);
    if ((cont.get(n) ?? 0) < 2) return n;
    const d = dataDoSlug(s);
    if (!d) return n;
    return `${n} · ${(porMes.get(n + fMes(d)) ?? 0) > 1 ? fD(d) : fMes(d)}`;
  };
}
