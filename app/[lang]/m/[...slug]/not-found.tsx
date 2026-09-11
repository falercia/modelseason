import { Pagina404 } from '@/components/shell/Pagina404';

/** Slug que não está em modelos.json: 404 com a busca à mão. */
export default function ModeloNaoEncontrado() {
  return <Pagina404 tipo="modelo" />;
}
