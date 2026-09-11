import { carregarConteudo } from '@/lib/content';
import { agora, dadosV1, indiceBusca, mercado } from '@/lib/data';
import { InfoProvider } from '@/components/shell/Info';
import { Indice, Topo } from '@/components/shell/Topo';
import { Rodape } from '@/components/shell/Rodape';
import { Agora } from '@/components/agora/Agora';
import { Historico } from '@/components/secoes/Historico';
import { fBR, fD } from '@/lib/format';

export const dynamic = 'force-static';

const INDICE = [
  { lbl: 'Agora', itens: [{ href: '#agora', n: '—', t: 'Retrato do dia' }, { href: '#lideres', n: '—', t: 'Líderes por critério' }] },
  { lbl: 'Histórico', itens: [
    { href: '#s01', n: '01', t: 'Para que usam' },
    { href: '#s02', n: '02', t: 'Tamanho e concentração' },
    { href: '#s03', n: '03', t: 'Share por laboratório' },
    { href: '#s04', n: '04', t: 'Origem e pesos' },
    { href: '#s05', n: '05', t: 'Que carga exige' },
    { href: '#s06', n: '06', t: 'Onde é usado' },
    { href: '#s07', n: '07', t: 'Dinheiro' },
    { href: '#s08', n: '08', t: 'Qualidade × adoção' },
    { href: '#s09', n: '09', t: 'Os três grandes' },
    { href: '#s10', n: '10', t: 'Ciclo de vida' },
    { href: '#s11', n: '11', t: 'O que mudou' },
    { href: '#s12', n: '12', t: 'Comparador' },
    { href: '#s13', n: '13', t: 'Mapa da temporada' },
    { href: '#s14', n: '14', t: 'Sinais' },
  ] },
  { lbl: 'Referência', itens: [{ href: '#s15', n: '15', t: 'Como ler cada indicador' }] },
];

export default function Home() {
  const D = dadosV1(), A = agora(), M = mercado(), C = carregarConteudo();
  return (
    <InfoProvider conteudo={C}>
      <Topo itens={indiceBusca()} />
      <div className="shell">
        <Indice grupos={INDICE} />
        <main id="conteudo">
          <header className="hd">
            <div>
              <div className="eyebrow">Inteligência de mercado · Modelos de linguagem</div>
              <h1>O que importa em IA hoje</h1>
              <p className="sub">Quem lidera, o que mudou e para que os modelos de linguagem estão sendo usados, medido no tráfego real de tokens.</p>
            </div>
            <div className="meta">
              Dado diário até <b>{fD(A.ultimo_dia)}</b><br />
              Histórico: <b>{fBR(D.daily_first)}</b> a <b>{fBR(D.daily_last)}</b><br />
              Semanas completas: <b>{D.weeks.length}</b> · Modelos: <b>{D.n_models}</b><br />
              Licença dos dados: CC BY 4.0
            </div>
          </header>
          <Agora A={A} />
          <Historico D={D} M={M} />
        </main>
      </div>
      <Rodape asOf={D.as_of} ultimoDia={A.ultimo_dia} />
    </InfoProvider>
  );
}
