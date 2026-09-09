"""Snapshot diario do catalogo de modelos do OpenRouter para data/models_catalog.csv.

Por que existe: GET /api/v1/models e um retrato do AGORA. Modelo descontinuado
some do catalogo e leva junto preco, contexto, data de lancamento e benchmark.
O ranking diario, em compensacao, guarda o modelo para sempre. Sem este arquivo,
todo modelo que sai do ar vira uma linha sem metadado no historico, de forma
irreversivel.

Por isso o merge e ACUMULATIVO: linhas nunca sao removidas. `first_seen` guarda
a primeira vez que o modelo apareceu no catalogo, `last_seen` a ultima, e
`active` diz se ele estava listado na execucao de hoje.

O endpoint e publico e nao exige chave.

Uso: python pipeline/fetch_models.py
"""
import datetime as dt
import sys
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parents[1]
CSV = ROOT / "data" / "models_catalog.csv"
URL = "https://openrouter.ai/api/v1/models"

COLUNAS = [
    "canonical_slug", "model_id", "name", "vendor", "created_at",
    "context_length", "max_completion_tokens",
    "price_prompt", "price_completion", "price_cache_read", "price_cache_write",
    "modality", "input_modalities", "output_modalities", "tokenizer",
    "hugging_face_id", "reasoning",
    "aa_intelligence", "aa_coding", "aa_agentic",
    "da_elo_models", "da_categorias",
    "first_seen", "last_seen", "active",
]

# Campos que podem mudar de um dia para o outro e devem ser sobrescritos pelo
# snapshot novo. O resto (first_seen) e imutavel.
MUTAVEIS = [c for c in COLUNAS if c not in ("canonical_slug", "first_seen")]


def num(v):
    """Converte string de preco em float. Devolve None para ausente, invalido ou negativo."""
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if f >= 0 else None


def txt(v):
    """Normaliza texto: string vazia vira None.

    A API devolve "" em vez de null em varios campos, entre eles hugging_face_id.
    Em memoria "" conta como preenchido, mas ao passar pelo CSV vira NaN. Sem esta
    normalizacao, toda metrica de cobertura fica inflada e o numero muda sozinho
    entre uma execucao e a seguinte.
    """
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def linha(x: dict, hoje: str) -> dict:
    pr = x.get("pricing") or {}
    ar = x.get("architecture") or {}
    bm = x.get("benchmarks") or {}
    aa = bm.get("artificial_analysis") or {}
    da = bm.get("design_arena") or []
    tp = x.get("top_provider") or {}
    rz = x.get("reasoning") or {}

    # Elo do design_arena: mediana entre as categorias da arena "models",
    # que e a que compara modelos entre si. As arenas "agents" medem outra coisa.
    elos = [e.get("elo") for e in da
            if isinstance(e, dict) and e.get("arena") == "models" and e.get("elo")]
    elo_mediano = float(pd.Series(elos).median()) if elos else None

    criado = x.get("created")
    criado_iso = (dt.datetime.fromtimestamp(criado, dt.timezone.utc).date().isoformat()
                  if criado else None)

    slug = x.get("canonical_slug") or x.get("id") or ""

    return {
        "canonical_slug": slug,
        "model_id": txt(x.get("id")),
        "name": txt(x.get("name")),
        "vendor": slug.split("/")[0] if "/" in slug else None,
        "created_at": criado_iso,
        "context_length": x.get("context_length"),
        "max_completion_tokens": tp.get("max_completion_tokens"),
        "price_prompt": num(pr.get("prompt")),
        "price_completion": num(pr.get("completion")),
        "price_cache_read": num(pr.get("input_cache_read")),
        "price_cache_write": num(pr.get("input_cache_write")),
        "modality": txt(ar.get("modality")),
        "input_modalities": "|".join(ar.get("input_modalities") or []) or None,
        "output_modalities": "|".join(ar.get("output_modalities") or []) or None,
        "tokenizer": txt(ar.get("tokenizer")),
        "hugging_face_id": txt(x.get("hugging_face_id")),
        "reasoning": bool(rz),
        "aa_intelligence": aa.get("intelligence_index"),
        "aa_coding": aa.get("coding_index"),
        "aa_agentic": aa.get("agentic_index"),
        "da_elo_models": elo_mediano,
        "da_categorias": len(elos) or None,
        "first_seen": hoje,
        "last_seen": hoje,
        "active": True,
    }


def main() -> int:
    hoje = dt.datetime.now(dt.timezone.utc).date().isoformat()

    r = requests.get(URL, timeout=120)
    r.raise_for_status()
    modelos = r.json().get("data") or []
    if not modelos:
        print("ERRO: a API devolveu catalogo vazio. Nada foi gravado.", file=sys.stderr)
        return 1

    # Varios `id` compartilham o mesmo `canonical_slug` (variantes :free, :batch,
    # :thinking do mesmo modelo). Nao da para simplesmente ficar com o primeiro:
    # a ordenacao da API nao e garantida, e uma variante pode ter preco 0 enquanto
    # o modelo base e pago, ou ter benchmark que a outra nao tem. Entao:
    #   - preco vem da variante SEM sufixo, que e o modelo de verdade;
    #   - os demais campos sao coalescidos, o primeiro valor nao nulo entre as variantes.
    modelos.sort(key=lambda x: (":" in (x.get("id") or ""), x.get("id") or ""))
    novo = pd.DataFrame([linha(x, hoje) for x in modelos])
    novo = novo[novo.canonical_slug.astype(bool)]
    antes = len(novo)
    novo = (novo.groupby("canonical_slug", as_index=False)
                .agg(lambda s: next((v for v in s if pd.notna(v)), None)))
    print(f"Catalogo do dia: {len(novo)} modelos distintos "
          f"({antes} entradas, {antes - len(novo)} variantes consolidadas).")

    if CSV.exists():
        velho = pd.read_csv(CSV)
        for c in COLUNAS:
            if c not in velho.columns:
                velho[c] = None
        velho = velho[COLUNAS]

        conhecidos = set(velho.canonical_slug)
        atuais = set(novo.canonical_slug)
        entraram = atuais - conhecidos
        sairam = conhecidos - atuais

        # Preserva o first_seen historico e marca como inativo quem saiu do catalogo.
        velho = velho.set_index("canonical_slug")
        novo_i = novo.set_index("canonical_slug")

        first_seen_antigo = velho["first_seen"]
        velho.loc[list(sairam), "active"] = False

        # Sobrescreve os campos mutaveis dos modelos ainda listados.
        comuns = list(atuais & conhecidos)
        velho.loc[comuns, MUTAVEIS] = novo_i.loc[comuns, MUTAVEIS]
        velho.loc[comuns, "first_seen"] = first_seen_antigo.loc[comuns]

        merged = pd.concat([velho, novo_i.loc[list(entraram)]]).reset_index()
        print(f"Novos: {len(entraram)} | saidos do catalogo: {len(sairam)} | "
              f"mantidos: {len(comuns)}")
        if entraram:
            print("  entraram:", ", ".join(sorted(entraram)[:6]),
                  "..." if len(entraram) > 6 else "")
    else:
        merged = novo
        print("Primeiro snapshot, criando o arquivo.")

    merged = merged[COLUNAS].sort_values("canonical_slug")
    CSV.parent.mkdir(parents=True, exist_ok=True)
    merged.to_csv(CSV, index=False)

    ativos = int(merged.active.astype(bool).sum())
    com_aa = int(merged.aa_intelligence.notna().sum())
    com_hf = int(merged.hugging_face_id.notna().sum())
    print(f"Gravado: {len(merged)} modelos ({ativos} ativos) | "
          f"com Intelligence Index: {com_aa} | com peso no Hugging Face: {com_hf}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
