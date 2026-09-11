'use client';
/**
 * Conteúdo das páginas 404. not-found.tsx não recebe o idioma da rota, então o
 * texto é escolhido aqui, no cliente, pelo IdiomaProvider do layout.
 */
import Link from 'next/link';
import { useIdioma } from './Idioma';
import type { ItemBusca } from './Topo';

export function NaoEncontrado({ tipo, maiores }: { tipo: 'modelo' | 'pagina'; maiores: ItemBusca[] }) {
  const { t, f, url, modelo, nomeLab } = useIdioma();
  const inicio = <Link href={url('/')}>{t({ pt: 'página inicial', en: 'home page' })}</Link>;
  return (
    <main id="conteudo" className="mp" style={{ minHeight: '50vh' }}>
      <div className="crumb"><Link href={url('/')}>Model Season</Link> /</div>
      <h1 style={{ margin: '6px 0 8px' }}>{tipo === 'modelo' ? t({ pt: 'Modelo não encontrado', en: 'Model not found' }) : t({ pt: 'Página não encontrada', en: 'Page not found' })}</h1>
      <p className="sub">
        {tipo === 'modelo'
          ? t({ pt: 'Nenhum modelo com este endereço aparece no histórico de tráfego. Use a busca acima, por nome, laboratório ou parte do slug, ou volte para a ',
                en: 'No model with this address appears in the traffic history. Use the search above, by name, lab or part of the slug, or go back to the ' })
          : t({ pt: 'Este endereço não existe no Model Season. Use a busca acima ou volte para a ', en: 'This address does not exist on Model Season. Use the search above or go back to the ' })}
        {inicio}.
      </p>
      {maiores.length > 0 && (
        <div className="card" style={{ maxWidth: 520, marginTop: 20 }}>
          <p className="kicker">{t({ pt: 'Os mais usados nos últimos 7 dias', en: 'Most used in the last 7 days' })}</p>
          <table className="t">
            <tbody>{maiores.map(i => (
              <tr key={i.s}><td><Link href={modelo(i.s)}>{i.n}</Link></td><td>{nomeLab(i.l)}</td><td className="num">{f.pct(i.sh)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </main>
  );
}
