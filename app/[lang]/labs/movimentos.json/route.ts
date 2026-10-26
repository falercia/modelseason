/**
 * Movimentos dos laboratórios em JSON: /labs/movimentos.json (e /en/labs/movimentos.json,
 * mesmo conteúdo). Os dois idiomas vão juntos. Quem lê é a rotina do e-mail "Radar IA",
 * que deixou de navegar as páginas dos laboratórios por conta própria (decisão de 24/10/2026).
 */
import { labs, movimentos } from '@/lib/data';
import { IDIOMAS } from '@/lib/i18n';

export const dynamic = 'force-static';
export const dynamicParams = false;
export const generateStaticParams = () => IDIOMAS.map(lang => ({ lang }));

export async function GET() {
  const L = labs();
  const ms = movimentos();
  const corpo = {
    fonte: 'https://modelseason.com/labs',
    atualizado: ms[0]?.edicao ?? null,
    semana_do_placar: L.semana,
    licenca: 'Movimentos: resumo das notas oficiais de cada laboratório, com link. Placar: dado de tráfego CC BY 4.0, ver rodapé do site.',
    labs: L.labs.map(x => ({ vendor: x.vendor, nome: x.nome, grupo: x.grupo, share_tokens: x.share_tokens, share_tokens_4s: x.share_tokens_4s,
      share_gasto: x.share_gasto, share_gasto_4s: x.share_gasto_4s, lider: x.lider, paginas: x.paginas })),
    grupos: { eua: { share_tokens: L.grupos.eua.share_tokens, share_gasto: L.grupos.eua.share_gasto },
      china: { share_tokens: L.grupos.china.share_tokens, share_gasto: L.grupos.china.share_gasto } },
    movimentos: ms.slice(0, 200),
  };
  return new Response(JSON.stringify(corpo, null, 1) + '\n', {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=0, must-revalidate' },
  });
}
