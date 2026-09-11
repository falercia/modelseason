/** Formato dos JSON gerados por pipeline/build_web.py. */
export interface LinhaTop {
  slug: string; nome: string; lab: string; vendor: string; origem: string; pesos: string; share: number; T: number;
  share_anterior: number; delta_pp: number; rank_anterior: number | null; estreou: boolean; lancamento: string | null;
}
export interface Movimento { slug: string; nome: string; lab: string; origem: string; de: number; para: number; delta_pp: number; estreou: boolean }
export interface Estreia { slug: string; nome: string; lab: string; share: number; primeiro_dia: string; lancamento: string | null }
export interface Lider {
  id: string; rotulo: string; tipo: string; criterio: string; fonte: string; as_of: string | null; unidade: string;
  slug?: string; nome?: string; lab?: string; valor?: number; n?: number; inteligencia?: number;
  vice?: { nome: string; valor: number } | null; empate?: { slug: string; nome: string }[] | null;
}
export interface Agora {
  ultimo_dia: string; janelas: Record<string, [string, string]>;
  top7: LinhaTop[]; top30: LinhaTop[]; subiram: Movimento[]; cairam: Movimento[]; estreias: Estreia[];
  idade_topo: { slug: string; nome: string; lab: string; dias: number; share: number }[];
  termometro: {
    volume_7d_T: number; volume_7d_ant_T: number; crescimento_7d_pct: number | null; volume_30d_T: number;
    crescimento_30d_pct: number | null; modelos_ativos_7d: number; modelos_ativos_30d: number;
    preco_efetivo: number | null; preco_cobertura_pct: number | null; top5_pct: number | null; hhi: number | null;
    china_pct: number; abertos_pct: number; estreias: number; diario_30d: { d: string; T: number }[];
  };
  manchete: { regra: string; titulo: string; destaques: string[]; texto: string };
  mudou: { tipo: string; slug: string; titulo: string; evidencia: string; observar: string }[];
  lideres: Lider[];
}
export interface AppLinha { rank: number; app_id: number; nome: string; T: number; requisicoes: number | null }
export interface Mercado {
  tarefas?: {
    as_of: string; janela_dias: number; fotos_arquivadas: number;
    macro: { key: string; nome: string; token_share: number; usage_share: number }[];
    classificacoes: { tag: string; nome: string; nome_fonte: string; macro: string; token_share: number; usage_share: number;
      modelos: { id: string; slug: string; nome: string; lab: string; token_share: number }[] }[];
  };
  apps?: {
    dia: string; geral: AppLinha[]; tendencia: AppLinha[]; tokens_top100_T: number;
    categorias: { key: string; nome: string; apps: AppLinha[] }[]; subcategorias: { key: string; apps: AppLinha[] }[];
  };
  sessoes?: {
    janela_fim: string | null; janela_dias: number | null; as_of: string | null;
    harness: { slug: string; nome: string; celulas: { slug: string; nome: string; lab: string; turnos: string; custo: number }[] }[];
    resumo: { harness: string; turnos: string; turnos_nome: string; modelos: number; mediana: number; min: number; max: number }[];
  };
  benchmarks?: { as_of: string; aa_modelos: number; fontes: Record<string, number>;
    evals: { slug: string; nome: string; lab: string; tipo: string; score: number | null; custo_tarefa: number | null; tarefas: number | null }[] };
  provedores?: { dia: string; total: number; por_sede: { pais: string; n: number }[] };
  zdr?: { dia: string; endpoints: number; modelos: number; provedores: number };
}
export interface Modelo {
  slug: string; nome: string; lab: string; vendor: string; origem: string; pesos: string; model_id?: string | null;
  lancamento?: string | null; contexto?: number | null; preco_entrada?: number | null; preco_saida?: number | null;
  preco_misto?: number | null; modalidade?: string | null; raciocinio?: boolean | null;
  aa_inteligencia?: number | null; aa_codigo?: number | null; aa_agentes?: number | null; ativo_no_catalogo?: boolean | null;
  serie_share: number[]; share_7d: number | null; rank_7d: number | null; pico_share: number | null; pico_semana: string | null;
  tokens_total_T: number; primeira_semana: string | null; semanas_top10: number; semanas_com_volume: number;
  tarefas: { tag: string; nome: string; macro: string; share_na_tarefa: number; peso_da_tarefa: number }[];
  provedores: { provedor: string; entrada: number | null; saida: number | null; contexto: number | null; quantizacao: string | null; zdr: boolean }[];
  avaliacoes: { tipo: string; score: number | null; custo_tarefa: number | null }[];
}
export interface Modelos { semanas: string[]; modelos: Record<string, Modelo> }
