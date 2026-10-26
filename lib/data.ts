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
import type { Agora, AssuntoPauta, EdicaoRadar, Labs, Mercado, Modelos, MovimentoLab, Radar, TipoMovimento } from './tipos';

// Caminhos literais: o rastreador de arquivos da Vercel inclui só estes
// JSON nas funções, e não o projeto inteiro.
const ler = <T,>(arq: string): T => JSON.parse(readFileSync(arq, 'utf8')) as T;
let cache: { D?: DadosV1; agora?: Agora; mercado?: Mercado; modelos?: Modelos; radar?: Radar; labs?: Labs; movimentos?: MovimentoLab[] } = {};

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

type Pauta = { dia: string; assuntos?: AssuntoPauta[]; movimentos?: MovimentoLab[] };
const PASTA_PAUTA = () => path.join(process.cwd(), 'data', 'pauta');
const pautas = (): Pauta[] => {
  const pasta = PASTA_PAUTA();
  if (!existsSync(pasta)) return [];
  return readdirSync(pasta).filter(a => /^\d{4}-\d{2}-\d{2}\.json$/.test(a)).sort().map(a => ler<Pauta>(path.join(pasta, a)));
};

function comPautas(R: Radar): Radar {
  const porDia = new Map<string, EdicaoRadar>(R.edicoes.map(e => [e.dia, { ...e }]));
  for (const p of pautas()) {
    if (!p.assuntos?.length && !p.movimentos?.length) continue;
    const ed = porDia.get(p.dia) ?? { dia: p.dia, revisao: 1, principal: null, fontes: { catalogo: [], trafego: null }, eventos: [] };
    porDia.set(p.dia, {
      ...ed,
      ...(p.assuntos?.length ? { assuntos: p.assuntos } : {}),
      ...(p.movimentos?.length ? { movimentos: p.movimentos.map(m => ({ ...m, edicao: p.dia })) } : {}),
    });
  }
  return { edicoes: [...porDia.values()].sort((a, b) => b.dia.localeCompare(a.dia)) };
}

/** Peso do tipo na ordem do mesmo dia: o mesmo de pipeline/movimentos.py (TIPOS). */
export const PESO_TIPO: Record<TipoMovimento, number> = { modelo: 5, preco: 4, desativacao: 4, api: 3, app: 2, outro: 0 };

/** Placar dos laboratórios acompanhados (data/web/labs.json, build_web.py). */
export const labs = () => (cache.labs ??= ler<Labs>(path.join(process.cwd(), 'data', 'web', 'labs.json')));

/**
 * Todos os movimentos publicados: os das pautas mescladas e o registro inicial
 * (data/movimentos/inicial.json), do mais novo para o mais velho. Como a pauta, não
 * passam pelo build_web.py, então o PR da pauta nunca conflita com os commits do bot.
 */
export const movimentos = () => (cache.movimentos ??= (() => {
  const ini = path.join(process.cwd(), 'data', 'movimentos', 'inicial.json');
  const fontes: Pauta[] = [...pautas(), ...(existsSync(ini) ? [ler<Pauta>(ini)] : [])];
  const vistos = new Set<string>();
  const out: MovimentoLab[] = [];
  for (const p of fontes) for (const m of p.movimentos ?? []) {
    if (vistos.has(m.id)) continue;
    vistos.add(m.id);
    out.push({ ...m, edicao: p.dia });
  }
  return out.sort((a, b) => b.data.localeCompare(a.data) || PESO_TIPO[b.tipo] - PESO_TIPO[a.tipo] || a.id.localeCompare(b.id));
})());

/** Lista leve para a busca: slug, nome, laboratório e share da semana. */
export function indiceBusca() {
  const M = modelos().modelos;
  return Object.values(M)
    .map(m => ({ s: m.slug, n: m.nome, l: m.lab, sh: m.share_7d ?? 0 }))
    .sort((a, b) => b.sh - a.sh);
}
