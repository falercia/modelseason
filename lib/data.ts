/**
 * Leitura dos dados no servidor. Tudo vem de arquivo versionado no repositório:
 * public/data.json (pipeline da v1) e data/web/*.json (build_web.py). Sem banco,
 * sem chamada externa em tempo de requisição. Cada commit do pipeline gera um
 * deploy novo, e o deploy é o cache.
 */
import 'server-only';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { DadosV1 } from './engine';
import type { Agora, AssuntoPauta, EdicaoRadar, Mercado, Modelos, Radar } from './tipos';

// Caminhos literais: o rastreador de arquivos da Vercel inclui só estes
// JSON nas funções, e não o projeto inteiro.
const ler = <T,>(arq: string): T => JSON.parse(readFileSync(arq, 'utf8')) as T;
let cache: { D?: DadosV1; agora?: Agora; mercado?: Mercado; modelos?: Modelos; radar?: Radar } = {};

export const dadosV1 = () => (cache.D ??= ler<DadosV1>(path.join(process.cwd(), 'public', 'data.json')));
export const agora = () => (cache.agora ??= ler<Agora>(path.join(process.cwd(), 'data', 'web', 'agora.json')));
export const mercado = () => (cache.mercado ??= ler<Mercado>(path.join(process.cwd(), 'data', 'web', 'mercado.json')));
export const modelos = () => (cache.modelos ??= ler<Modelos>(path.join(process.cwd(), 'data', 'web', 'modelos.json')));
/**
 * Radar = edições de data/web/radar.json + pautas aprovadas em data/pauta/.
 * A pauta entra por PR e não passa pelo build_web.py: assim o PR da pauta só traz
 * um arquivo novo e nunca conflita com os commits do bot em data/web.
 */
export const radar = () => (cache.radar ??= comPautas(ler<Radar>(path.join(process.cwd(), 'data', 'web', 'radar.json'))));

function comPautas(R: Radar): Radar {
  const pasta = path.join(process.cwd(), 'data', 'pauta');
  if (!existsSync(pasta)) return R;
  const porDia = new Map<string, EdicaoRadar>(R.edicoes.map(e => [e.dia, { ...e }]));
  for (const arq of readdirSync(pasta).filter(a => /^\d{4}-\d{2}-\d{2}\.json$/.test(a))) {
    const p = ler<{ dia: string; assuntos: AssuntoPauta[] }>(path.join(pasta, arq));
    if (!p.assuntos?.length) continue;
    const ed = porDia.get(p.dia) ?? { dia: p.dia, revisao: 1, principal: null, fontes: { catalogo: [], trafego: null }, eventos: [] };
    porDia.set(p.dia, { ...ed, assuntos: p.assuntos });
  }
  return { edicoes: [...porDia.values()].sort((a, b) => b.dia.localeCompare(a.dia)) };
}

/** Lista leve para a busca: slug, nome, laboratório e share da semana. */
export function indiceBusca() {
  const M = modelos().modelos;
  return Object.values(M)
    .map(m => ({ s: m.slug, n: m.nome, l: m.lab, sh: m.share_7d ?? 0 }))
    .sort((a, b) => b.sh - a.sh);
}
