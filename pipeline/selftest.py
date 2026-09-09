"""Autoteste do public/data.json.

Roda depois do build, antes do commit. Existe porque a pagina e uma ferramenta de
mercado: um numero errado publicado silenciosamente custa mais do que um pipeline
que falha barulhentamente.

Verifica invariantes, nao "se parece certo":
  1. a matriz modelo x semana reconcilia com o CSV bruto
  2. todo conjunto de shares soma ~100% em toda semana
  3. nenhum NaN, None ou infinito nas series numericas
  4. as chaves que a pagina consome existem e tem o tamanho certo
  5. o leaderboard e consistente com a ultima semana da matriz
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public" / "data.json"
CSV = ROOT / "data" / "rankings_daily.csv"

TOL_SHARE = 0.5   # pontos percentuais
TOL_RECON = 0.5   # por cento


class Falhas(list):
    def erro(self, msg): self.append(("ERRO", msg))
    def aviso(self, msg): self.append(("AVISO", msg))


def main() -> int:
    f = Falhas()
    d = json.load(open(DATA, encoding="utf-8"))
    n = len(d["weeks"])
    print(f"data.json: {n} semanas, {d['n_models']} modelos, as_of {d['as_of']}")

    # ---- 1. matriz reconcilia com o CSV bruto
    m = d["matriz"]
    if len(m["semanas"]) != n:
        f.erro(f"matriz tem {len(m['semanas'])} semanas, weeks tem {n}")
    tot = np.zeros(n)
    for a, v in zip(m["t0"], m["v"]):
        if v:
            tot[a:a + len(v)] += v
    df = pd.read_csv(CSV, parse_dates=["date"])
    df["week"] = df.date.dt.to_period("W-SUN").dt.start_time
    cheias = df.groupby("week").date.nunique()
    df = df[df.week.isin(cheias[cheias == 7].index)]
    bruto = (df.groupby("week").total_tokens.sum() / 1e6).reindex(
        pd.to_datetime(m["semanas"])).values
    pior = float(np.max(np.abs(tot - bruto) / np.maximum(bruto, 1)) * 100)
    print(f"1. matriz x CSV bruto: erro maximo {pior:.4f}%")
    if pior > TOL_RECON:
        f.erro(f"matriz diverge do CSV em {pior:.3f}%, acima de {TOL_RECON}%")

    # ---- 2. shares somam 100
    conjuntos = ["origin_share", "weights_share", "pesos_share_v2", "cobranca_share",
                 "faixa_preco_share", "faixa_ctx_share", "multimodal_share",
                 "raciocinio_share"]
    for c in conjuntos:
        if c not in d:
            f.erro(f"chave ausente: {c}"); continue
        soma = np.zeros(n)
        for k, v in d[c].items():
            if len(v) != n:
                f.erro(f"{c}['{k}'] tem {len(v)} valores, esperado {n}"); continue
            soma += np.array(v, dtype=float)
        desvio = float(np.max(np.abs(soma - 100)))
        if desvio > TOL_SHARE:
            f.erro(f"{c} soma {100 + desvio:.2f}% na pior semana")
    print(f"2. {len(conjuntos)} conjuntos de share verificados")

    # ---- 3. numeros validos
    def varre(o, caminho=""):
        if isinstance(o, dict):
            for k, v in o.items(): varre(v, f"{caminho}.{k}")
        elif isinstance(o, list):
            for i, v in enumerate(o[:2000]): varre(v, f"{caminho}[{i}]")
        elif isinstance(o, float):
            if np.isnan(o) or np.isinf(o): f.erro(f"valor invalido em {caminho}: {o}")
    for chave in ["weekly_total_T", "top5", "hhi", "spend_total_musd", "preco_efetivo",
                  "ctx_mediano", "origin_share", "vendor_share", "spend_share"]:
        if chave in d: varre(d[chave], chave)
    print("3. nenhum NaN ou infinito nas series principais")

    # ---- 4. chaves e tamanhos que a pagina consome
    series_n = ["weekly_total_T", "top5", "hhi", "an_share", "free_share", "churn",
                "age", "other_share", "spend_total_musd", "preco_efetivo", "ctx_mediano"]
    for k in series_n:
        if k not in d: f.erro(f"chave ausente: {k}")
        elif len(d[k]) != n: f.erro(f"{k} tem {len(d[k])} valores, esperado {n}")
    for k in ["matriz", "trajetoria", "boards", "life", "life_series", "blend",
              "cobertura", "volume_vs_dinheiro", "qualidade"]:
        if k not in d: f.erro(f"chave ausente: {k}")
    print(f"4. {len(series_n) + 9} chaves verificadas")

    # ---- 5. leaderboard bate com a ultima semana da matriz
    ult = {}
    for mod, a, v in zip(m["modelos"], m["t0"], m["v"]):
        i = n - 1 - a
        if v and 0 <= i < len(v): ult[mod["s"]] = v[i]
    # "other" agrega o volume fora do top 50 diario: conta no total, mas nao e modelo
    ult.pop("other", None)
    top = sorted(ult.items(), key=lambda x: -x[1])[:15]
    board = [r["model"] for r in d["boards"]["last"]]
    esperado = [s for s, _ in top]
    if board[:5] != esperado[:5]:
        f.erro(f"leaderboard diverge da matriz.\n     board: {board[:5]}\n     matriz: {esperado[:5]}")
    print("5. leaderboard consistente com a matriz")

    # ---- cobertura, informativo
    cob = d.get("cobertura_ultima_semana", {})
    print(f"cobertura de metadado na ultima semana: {cob.get('volume_com_meta_pct')}%")
    if cob.get("volume_com_meta_pct", 0) < 95:
        f.aviso(f"cobertura de metadado em {cob.get('volume_com_meta_pct')}%")

    erros = [x for x in f if x[0] == "ERRO"]
    print()
    for nivel, msg in f:
        print(f"[{nivel}] {msg}", file=sys.stderr if nivel == "ERRO" else sys.stdout)
    if erros:
        print(f"\nFALHOU: {len(erros)} erro(s).", file=sys.stderr)
        return 1
    print("TODOS OS INVARIANTES PASSARAM.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
