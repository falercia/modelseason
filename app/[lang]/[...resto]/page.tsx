import { notFound } from 'next/navigation';

/**
 * Qualquer caminho sem rota própria dentro de um idioma cai aqui e vira o 404
 * de app/[lang]/not-found.tsx, com topo, busca e rodapé no idioma certo.
 */
export const dynamicParams = true;
export default function Resto(): never {
  notFound();
}
