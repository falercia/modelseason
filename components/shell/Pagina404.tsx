/**
 * 404 completa (topo, conteúdo, rodapé), usada pelos not-found.tsx. Como o
 * not-found não sabe o idioma, o painel de referência recebe o conteúdo dos
 * dois idiomas e escolhe no cliente. É a única página que paga esse peso.
 */
import { carregarConteudo } from '@/lib/content';
import { agora, dadosV1, indiceBusca } from '@/lib/data';
import { IDIOMAS } from '@/lib/i18n';
import { InfoProvider } from './Info';
import { Topo } from './Topo';
import { Rodape } from './Rodape';
import { NaoEncontrado } from './NaoEncontrado';

export function Pagina404({ tipo }: { tipo: 'modelo' | 'pagina' }) {
  const A = agora(), D = dadosV1(), busca = indiceBusca();
  const porIdioma = Object.fromEntries(IDIOMAS.map(l => [l, carregarConteudo(l)]));
  return (
    <InfoProvider conteudo={porIdioma}>
      <Topo itens={busca} />
      <NaoEncontrado tipo={tipo} maiores={busca.filter(i => i.sh > 0).slice(0, 8)} />
      <Rodape asOf={D.as_of} ultimoDia={A.ultimo_dia} />
    </InfoProvider>
  );
}
