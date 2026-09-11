/**
 * Rótulos de valores que vêm do dado. O pipeline e o motor usam chaves em
 * português ('EUA/Canadá', 'Outros', 'Até $0,20') como identificadores: elas
 * dão cor, ordem e filtro, e aparecem na URL de um recorte compartilhado. Por
 * isso a chave nunca muda; só o rótulo exibido é traduzido, aqui.
 *
 * tests/format.test.ts falha se aparecer no data.json um valor sem rótulo em
 * inglês, para uma categoria nova da fonte não vazar em português no /en.
 */
import type { Lang } from './i18n.ts';

// ------------------------------------------------------------ laboratórios

const LAB: Record<string, string> = {
  deepseek: 'DeepSeek', google: 'Google', anthropic: 'Anthropic', openai: 'OpenAI', xiaomi: 'Xiaomi',
  tencent: 'Tencent', minimax: 'MiniMax', 'z-ai': 'Z.ai (GLM)', 'x-ai': 'xAI',
  nvidia: 'NVIDIA', mistralai: 'Mistral AI', moonshotai: 'Moonshot AI', thinkingmachines: 'Thinking Machines',
  stepfun: 'StepFun', inclusionai: 'InclusionAI', poolside: 'Poolside', upstage: 'Upstage', qwen: 'Qwen',
  meta: 'Meta', 'meta-llama': 'Meta', alibaba: 'Alibaba', bytedance: 'ByteDance', 'bytedance-seed': 'ByteDance',
  'arcee-ai': 'Arcee AI', cohere: 'Cohere', microsoft: 'Microsoft', amazon: 'Amazon', perplexity: 'Perplexity',
  liquid: 'Liquid AI', baai: 'BAAI', kwaipilot: 'KwaiPilot', 'nex-agi': 'Nex AGI', 'dots-studio': 'Dots Studio',
  tngtech: 'TNG', nousresearch: 'Nous Research', openchat: 'OpenChat', 'ibm-granite': 'IBM Granite', 'aion-labs': 'AionLabs',
};
const LAB_IDIOMA: Record<Lang, Record<string, string>> = {
  pt: { Outros: 'Outros', stealth: 'Anônimo (stealth)', openrouter: 'Teste anônimo' },
  en: { Outros: 'Other', stealth: 'Anonymous (stealth)', openrouter: 'Anonymous test' },
};
/** Nome do laboratório a partir da chave do slug ("x-ai" → "xAI"). Chave desconhecida vira Título Capitalizado. */
export const rotuloLab = (k: string, lang: Lang) =>
  LAB_IDIOMA[lang][k] ?? LAB[k] ?? k.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
/** Nome de laboratório que já veio pronto do pipeline (campo "lab" dos JSON de data/web). */
const LAB_PT_EN: Record<string, string> = { 'Anônimo (stealth)': 'Anonymous (stealth)', 'Teste anônimo': 'Anonymous test', Outros: 'Other' };
export const nomeLab = (nome: string, lang: Lang) => (lang === 'pt' ? nome : LAB_PT_EN[nome] ?? nome);

// ------------------------------------------------------------ dimensões do motor e do filtro

/** Todo valor de dimensão da matriz (D.matriz.dic) e as chaves de agregação do motor. */
const VALOR_EN: Record<string, string> = {
  // origem do laboratório
  China: 'China', Coreia: 'Korea', 'EUA/Canadá': 'US/Canada', Europa: 'Europe', Outros: 'Other', 'Não identificado': 'Unknown',
  // licença dos pesos
  'Open-weights': 'Open weights', Proprietário: 'Proprietary',
  // cobrança
  Pago: 'Paid', 'Endpoint gratuito': 'Free endpoint', 'Modelo gratuito': 'Free model',
  // faixa de preço por 1M tokens (mistura do catálogo)
  Gratuito: 'Free', 'Até $0,20': 'Up to $0.20', '$0,20 a $1': '$0.20 to $1', '$1 a $5': '$1 to $5', 'Acima de $5': 'Over $5',
  // janela de contexto
  'Até 32k': 'Up to 32k', '33k a 128k': '33k to 128k', '129k a 400k': '129k to 400k', 'Acima de 400k': 'Over 400k',
  // modalidade e raciocínio declarados
  Multimodal: 'Multimodal', 'Só texto': 'Text only', 'Com raciocínio': 'Reasoning', 'Sem raciocínio': 'No reasoning',
  // agregados de faixa e cobrança que o motor soma
  'Não informado': 'Not reported',
};
export const rotuloValor = (v: string, lang: Lang) => (lang === 'pt' ? v : VALOR_EN[v] ?? v);
export const temRotuloEn = (v: string) => v in VALOR_EN;

/** Licença dos pesos em frase ("Pesos abertos" na página de modelo em português). */
export const rotuloPesos = (p: string, lang: Lang) =>
  lang === 'pt'
    ? (p === 'Open-weights' ? 'Pesos abertos' : p === 'Proprietário' ? 'Proprietário' : 'Não identificado')
    : (p === 'Open-weights' ? 'Open weights' : p === 'Proprietário' ? 'Proprietary' : 'Unknown');

/** Título de cada grupo do painel de filtros. */
export const GRUPO_FILTRO: Record<Lang, Record<string, string>> = {
  pt: { cobranca: 'Cobrança', pesos: 'Licença dos pesos', origin: 'País-sede do lab', faixa_preco: 'Faixa de preço (por 1M tokens)',
    faixa_ctx: 'Janela de contexto', multimodal: 'Modalidade', raciocinio: 'Raciocínio' },
  en: { cobranca: 'Billing', pesos: 'Weights license', origin: 'Lab headquarters', faixa_preco: 'Price tier (per 1M tokens)',
    faixa_ctx: 'Context window', multimodal: 'Modality', raciocinio: 'Reasoning' },
};

// ------------------------------------------------------------ famílias (seção 09)

const FAMILIA_EN: Record<string, string> = {
  'GPT-5 e GPT-6': 'GPT-5 and GPT-6', 'Mini e nano': 'Mini and nano', 'Codex e série o': 'Codex and o-series',
  'gpt-oss (pesos abertos)': 'gpt-oss (open weights)', 'GPT-4 e anteriores': 'GPT-4 and earlier',
  'Gemma (pesos abertos)': 'Gemma (open weights)', Outros: 'Other',
};
export const rotuloFamilia = (f: string, lang: Lang) => (lang === 'pt' ? f : FAMILIA_EN[f] ?? f);

// ------------------------------------------------------------ finalidade, apps e sessões

export const NOME_MACRO: Record<Lang, Record<string, string>> = {
  pt: { code: 'Código', agent: 'Agentes', data: 'Dados', general: 'Uso geral' },
  en: { code: 'Code', agent: 'Agents', data: 'Data', general: 'General use' },
};
export const rotuloMacro = (k: string, lang: Lang) => NOME_MACRO[lang][k] ?? k;

/** Tarefas da fonte em caixa de frase, como o resto da interface. Tag desconhecida usa o nome da fonte. */
const TAREFA_EN: Record<string, string> = {
  classification_tagging: 'Classification', 'data:extraction': 'Data extraction', 'agent:workflow_execution': 'Workflow execution',
  roleplay_fiction: 'Roleplay and fiction', 'data:transformation': 'Data transformation', 'code:general_impl': 'Code generation',
  content_writing: 'Content writing', translation: 'Translation', qa_knowledge: 'Q&A and knowledge',
  'agent:multi_step_planning': 'Multi-step planning', conversational_reply: 'Conversation', 'code:debugging': 'Debugging',
  summarization: 'Summarization', 'agent:tool_dispatch': 'Tool calling', 'code:file_read_write': 'File read and write',
  customer_support: 'Customer support', 'code:shell_execution': 'Shell execution', 'code:review_security': 'Code review',
  'agent:memory_extraction': 'Memory extraction', 'code:frontend_ui': 'Frontend and UI', research_report: 'Research and reports',
  'agent:web_search': 'Web search', math: 'Math', 'code:repo_scan': 'Repo scanning', finance_trading: 'Finance and trading',
  security_audit: 'Security audit', 'code:devops_config': 'DevOps configuration', 'code:sql_database': 'SQL and databases', devops: 'DevOps',
};
export const rotuloTarefa = (t: { tag: string; nome: string; nome_fonte?: string }, lang: Lang) =>
  lang === 'pt' ? t.nome : TAREFA_EN[t.tag] ?? t.nome_fonte ?? t.tag;

export const CATEGORIA_APP: Record<Lang, Record<string, string>> = {
  pt: { coding: 'Programação', creative: 'Criação', productivity: 'Produtividade', entertainment: 'Entretenimento' },
  en: { coding: 'Coding', creative: 'Creative', productivity: 'Productivity', entertainment: 'Entertainment' },
};
export const rotuloCategoriaApp = (c: { key: string; nome: string }, lang: Lang) => (lang === 'pt' ? c.nome : CATEGORIA_APP.en[c.key] ?? c.key);

const TURNOS: Record<Lang, Record<string, string>> = {
  pt: { '1-turn': '1 turno', '2-9-turns': '2 a 9 turnos', '10-49-turns': '10 a 49 turnos', '50-plus-turns': '50 turnos ou mais' },
  en: { '1-turn': '1 turn', '2-9-turns': '2 to 9 turns', '10-49-turns': '10 to 49 turns', '50-plus-turns': '50 turns or more' },
};
export const rotuloTurnos = (r: { turnos: string; turnos_nome?: string }, lang: Lang) => TURNOS[lang][r.turnos] ?? (lang === 'pt' ? r.turnos_nome ?? r.turnos : r.turnos);

// ------------------------------------------------------------ países (sede dos provedores)

const PAIS: Record<Lang, Record<string, string>> = {
  pt: {
    US: 'Estados Unidos', CA: 'Canadá', CN: 'China', HK: 'Hong Kong', TW: 'Taiwan', SG: 'Singapura', JP: 'Japão', KR: 'Coreia do Sul',
    IN: 'Índia', ID: 'Indonésia', IL: 'Israel', AE: 'Emirados Árabes', AU: 'Austrália', BR: 'Brasil',
    GB: 'Reino Unido', UK: 'Reino Unido', IE: 'Irlanda', FR: 'França', DE: 'Alemanha', NL: 'Países Baixos', BE: 'Bélgica', LU: 'Luxemburgo',
    ES: 'Espanha', PT: 'Portugal', IT: 'Itália', CH: 'Suíça', AT: 'Áustria', SE: 'Suécia', NO: 'Noruega', DK: 'Dinamarca', FI: 'Finlândia',
    PL: 'Polônia', CZ: 'Tchéquia', EE: 'Estônia', LT: 'Lituânia', LV: 'Letônia', RO: 'Romênia', UA: 'Ucrânia',
    'Não informado': 'Não informado',
  },
  en: {
    US: 'United States', CA: 'Canada', CN: 'China', HK: 'Hong Kong', TW: 'Taiwan', SG: 'Singapore', JP: 'Japan', KR: 'South Korea',
    IN: 'India', ID: 'Indonesia', IL: 'Israel', AE: 'United Arab Emirates', AU: 'Australia', BR: 'Brazil',
    GB: 'United Kingdom', UK: 'United Kingdom', IE: 'Ireland', FR: 'France', DE: 'Germany', NL: 'Netherlands', BE: 'Belgium', LU: 'Luxembourg',
    ES: 'Spain', PT: 'Portugal', IT: 'Italy', CH: 'Switzerland', AT: 'Austria', SE: 'Sweden', NO: 'Norway', DK: 'Denmark', FI: 'Finland',
    PL: 'Poland', CZ: 'Czechia', EE: 'Estonia', LT: 'Lithuania', LV: 'Latvia', RO: 'Romania', UA: 'Ukraine',
    'Não informado': 'Not reported',
  },
};
/** Código ISO da fonte → nome no idioma. Código desconhecido aparece como veio. */
export const rotuloPais = (p: string, lang: Lang) => PAIS[lang][p] ?? p;
