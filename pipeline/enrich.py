"""Junta o ranking diario com o catalogo de modelos e deriva as dimensoes novas.

O ranking diz QUANTO cada modelo rodou. O catalogo diz O QUE cada modelo e:
preco, contexto, data de lancamento, modalidade, pesos abertos, indice de
qualidade. Este modulo casa os dois e produz as colunas que os graficos usam.

Tres decisoes de modelagem que valem a leitura:

1. SUFIXOS. `deepseek/v4:free` nao e um modelo diferente de `deepseek/v4`, e o
   mesmo modelo servido por um endpoint gratuito. O join usa o slug base; o
   sufixo vira coluna propria, porque a diferenca entre trafego pago e trafego
   subsidiado do MESMO modelo e uma das leituras mais uteis do dataset.

2. GASTO. `total_tokens` soma prompt e completion sem separar os dois, e os
   precos sao diferentes. Entao gasto e ESTIMATIVA, nao medicao. Publicamos tres
   numeros: o piso (tudo prompt), o teto (tudo completion) e a estimativa com a
   mistura declarada em BLEND_PROMPT. Endpoint gratuito custa zero, sempre.

3. PESOS ABERTOS. `hugging_face_id` e prova, o padrao de nome e chute. Onde o
   catalogo tem o campo, ele manda. Onde nao tem, cai na heuristica antiga, e a
   coluna `origem_peso` registra qual das duas respondeu.
"""
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
CATALOGO = ROOT / "data" / "models_catalog.csv"

# Divisao presumida entre tokens de entrada e de saida. Nao e medido pela fonte.
# Reflete o padrao de uso dominante no OpenRouter, em que agentes de codigo e
# chat mandam contexto longo e recebem resposta curta.
BLEND_PROMPT = 0.75
BLEND_COMPLETION = 1 - BLEND_PROMPT

FAIXAS_PRECO = [
    (0, 0, "Gratuito"),
    (0, 0.20, "Até $0,20"),
    (0.20, 1.00, "$0,20 a $1"),
    (1.00, 5.00, "$1 a $5"),
    (5.00, float("inf"), "Acima de $5"),
]

FAIXAS_CTX = [
    (0, 33_000, "Até 32k"),
    (33_000, 130_000, "33k a 128k"),
    (130_000, 400_000, "129k a 400k"),
    (400_000, float("inf"), "Acima de 400k"),
]


def _faixa(v, faixas, nulo="Não identificado"):
    if pd.isna(v):
        return nulo
    for lo, hi, rotulo in faixas:
        if lo == hi == 0:
            if v == 0:
                return rotulo
            continue
        if lo < v <= hi or (lo == 0 and 0 < v <= hi):
            return rotulo
    return nulo


def carregar_catalogo() -> pd.DataFrame:
    if not CATALOGO.exists():
        return pd.DataFrame()
    c = pd.read_csv(CATALOGO)
    return c.set_index("canonical_slug")


def juntar(df: pd.DataFrame, openw_fallback=None) -> pd.DataFrame:
    """Recebe o ranking (date, model_permaslug, total_tokens) e devolve enriquecido."""
    d = df.copy()
    d["slug_base"] = d.model_permaslug.str.split(":").str[0]
    d["sufixo"] = d.model_permaslug.str.split(":").str[1].fillna("")
    d["endpoint_free"] = d.sufixo.eq("free")

    cat = carregar_catalogo()
    if cat.empty:
        for c in ["price_prompt", "price_completion", "context_length", "created_at",
                  "hugging_face_id", "aa_intelligence", "aa_coding", "aa_agentic",
                  "da_elo_models", "modality", "name", "reasoning"]:
            d[c] = np.nan
    else:
        cols = ["price_prompt", "price_completion", "context_length", "created_at",
                "hugging_face_id", "aa_intelligence", "aa_coding", "aa_agentic",
                "da_elo_models", "modality", "name", "reasoning"]
        cols = [c for c in cols if c in cat.columns]
        d = d.join(cat[cols], on="slug_base")

    d["tem_meta"] = d.price_prompt.notna()

    # Preco por 1M tokens, para leitura humana.
    d["preco_prompt_M"] = d.price_prompt * 1e6
    d["preco_compl_M"] = d.price_completion * 1e6
    d["preco_misto_M"] = (BLEND_PROMPT * d.preco_prompt_M
                          + BLEND_COMPLETION * d.preco_compl_M)

    # Gasto estimado. Endpoint gratuito custa zero para quem chama.
    milhoes = d.total_tokens / 1e6
    livre = d.endpoint_free
    d["gasto_est"] = np.where(livre, 0.0, milhoes * d.preco_misto_M).astype(float)
    d["gasto_piso"] = np.where(livre, 0.0, milhoes * d.preco_prompt_M).astype(float)
    d["gasto_teto"] = np.where(livre, 0.0, milhoes * d.preco_compl_M).astype(float)

    # Pago x gratuito, do ponto de vista de quem consome.
    d["cobranca"] = np.select(
        [livre, d.price_prompt.eq(0), d.price_prompt.gt(0)],
        ["Endpoint gratuito", "Modelo gratuito", "Pago"],
        default="Não identificado",
    )

    # Pesos abertos: prova antes de heuristica.
    tem_hf = d.hugging_face_id.notna()
    if openw_fallback is not None:
        chute = d.model_permaslug.map(openw_fallback)
    else:
        chute = pd.Series("Não identificado", index=d.index)
    d["pesos"] = np.where(tem_hf, "Open-weights", chute)
    d["origem_peso"] = np.where(tem_hf, "catálogo", "heurística")

    d["faixa_preco"] = d.preco_misto_M.map(lambda v: _faixa(v, FAIXAS_PRECO))
    d["faixa_ctx"] = d.context_length.map(lambda v: _faixa(v, FAIXAS_CTX))

    d["lancamento"] = pd.to_datetime(d.created_at, errors="coerce")
    ent = d.modality.fillna("").str.split("->").str[0]
    d["multimodal"] = np.where(d.modality.isna(), "Não identificado",
                               np.where(ent.str.contains(r"\+"), "Multimodal", "Só texto"))
    d["raciocinio"] = np.where(d.reasoning.isna(), "Não identificado",
                               np.where(d.reasoning.astype("boolean").fillna(False),
                                        "Com raciocínio", "Sem raciocínio"))
    return d


def cobertura(d: pd.DataFrame) -> dict:
    """Quanto do volume tem metadado. Numero honesto que a pagina precisa mostrar."""
    reais = d[d.model_permaslug != "other"]
    tot = float(reais.total_tokens.sum())
    com = float(reais.loc[reais.tem_meta, "total_tokens"].sum())
    return {
        "modelos": int(reais.model_permaslug.nunique()),
        "modelos_com_meta": int(reais.loc[reais.tem_meta, "model_permaslug"].nunique()),
        "volume_com_meta_pct": round(100 * com / tot, 2) if tot else 0.0,
    }
