/**
 * Leitura dos dados no servidor. Tudo vem de arquivo versionado no repositório:
 * public/data.json (pipeline da v1) e data/web/*.json (build_web.py). Sem banco,
 * sem chamada externa em tempo de requisição. Cada commit do pipeline gera um
 * deploy novo, e o deploy é o cache.
 */
import 'server-only';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { DadosV1 } from './engine';
import type { Agora, Mercado, Modelos } from './tipos';

// Caminhos literais: o rastreador de arquivos da Vercel inclui só estes quatro
// JSON nas funções, e não o projeto inteiro.
const ler = <T,>(arq: string): T => JSON.parse(readFileSync(arq, 'utf8')) as T;
let cache: { D?: DadosV1; agora?: Agora; mercado?: Mercado; modelos?: Modelos } = {};

export const dadosV1 = () => (cache.D ??= ler<DadosV1>(path.join(process.cwd(), 'public', 'data.json')));
export const agora = () => (cache.agora ??= ler<Agora>(path.join(process.cwd(), 'data', 'web', 'agora.json')));
export const mercado = () => (cache.mercado ??= ler<Mercado>(path.join(process.cwd(), 'data', 'web', 'mercado.json')));
export const modelos = () => (cache.modelos ??= ler<Modelos>(path.join(process.cwd(), 'data', 'web', 'modelos.json')));

/** Lista leve para a busca: slug, nome, laboratório e share da semana. */
export function indiceBusca() {
  const M = modelos().modelos;
  return Object.values(M)
    .map(m => ({ s: m.slug, n: m.nome, l: m.lab, sh: m.share_7d ?? 0 }))
    .sort((a, b) => b.sh - a.sh);
}
