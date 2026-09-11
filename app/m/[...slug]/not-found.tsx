import Link from 'next/link';
import { carregarConteudo } from '@/lib/content';
import { agora, dadosV1, indiceBusca } from '@/lib/data';
import { urlModelo } from '@/lib/format';
import { pct } from '@/components/modelo/comum';
import { InfoProvider } from '@/components/shell/Info';
import { Topo } from '@/components/shell/Topo';
import { Rodape } from '@/components/shell/Rodape';

/** Slug que não está em modelos.json: 404 com a busca à mão. */
export default function ModeloNaoEncontrado() {
  const A = agora(), D = dadosV1();
  const maiores = indiceBusca().filter(i => i.sh > 0).slice(0, 8);
  return (
    <InfoProvider conteudo={carregarConteudo()}>
      <Topo itens={indiceBusca()} />
      <main id="conteudo" className="mp" style={{ minHeight: '50vh' }}>
        <div className="crumb"><Link href="/">Model Season</Link> /</div>
        <h1 style={{ margin: '6px 0 8px' }}>Modelo não encontrado</h1>
        <p className="sub">Nenhum modelo com este endereço aparece no histórico de tráfego. Use a busca acima, por nome, laboratório ou parte do slug, ou volte para a <Link href="/">página inicial</Link>.</p>
        {maiores.length > 0 && (
          <div className="card" style={{ maxWidth: 520, marginTop: 20 }}>
            <p className="kicker">Os mais usados nos últimos 7 dias</p>
            <table className="t">
              <tbody>{maiores.map(i => (
                <tr key={i.s}><td><Link href={urlModelo(i.s)}>{i.n}</Link></td><td>{i.l}</td><td className="num">{pct(i.sh)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </main>
      <Rodape asOf={D.as_of} ultimoDia={A.ultimo_dia} />
    </InfoProvider>
  );
}
