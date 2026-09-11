/**
 * Cor segue a ENTIDADE, nunca a posição no ranking. Quatro slots fixos para os
 * quatro maiores laboratórios em volume ACUMULADO desde jan/2025 (DeepSeek,
 * Google, Anthropic e OpenAI, em set/2026); todo o resto é cinza. O teste
 * tests/engine.test.ts falha quando essa lista deixar de ser verdade, e aí as
 * cores precisam ser revistas de propósito, não por acidente.
 */
export const LAB_SLOT: Record<string, string> = { deepseek: '--s1', openai: '--s2', google: '--s3', anthropic: '--s4', Outros: '--s0' };
export const slotLab = (vendor: string) => LAB_SLOT[vendor] ?? '--s0';
export const ORIGEM_SLOT: Record<string, string> = { 'EUA/Canadá': '--s1', China: '--s2', Europa: '--s3', Coreia: '--s4', Outros: '--s0', 'Não identificado': '--s0' };
export const PESOS_SLOT: Record<string, string> = { Proprietário: '--s1', 'Open-weights': '--s3', 'Não identificado': '--s0' };
export const FAMILIA_SLOT: Record<string, Record<string, string>> = {
  anthropic: { Opus: '--s1', Sonnet: '--s3', Haiku: '--s2', Fable: '--s4', Outros: '--s0' },
  openai: { 'GPT-5 e GPT-6': '--s1', 'Mini e nano': '--s3', 'Codex e série o': '--s2', 'gpt-oss (pesos abertos)': '--s4', 'GPT-4 e anteriores': '--s0' },
  google: { 'Gemini Pro': '--s1', 'Gemini Flash': '--s3', 'Gemini Flash-Lite': '--s2', 'Gemma (pesos abertos)': '--s4', Outros: '--s0' },
};
export const iniciais = (lab: string) => lab.replace(/\(.*\)/, '').trim().split(/[\s.]+/).map(p => p[0]).join('').slice(0, 2).toUpperCase();
