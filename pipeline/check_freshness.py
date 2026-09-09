"""Guard de integridade de data/rankings_daily.csv.

Existe porque o modo de falha perigoso do pipeline nao e o erro barulhento
(chave revogada da 401 e o job quebra sozinho), e sim o silencioso: a API
responde 200 com dado velho ou repetido, o commit nao muda nada e a pagina
fica congelada mostrando "atualizado hoje".

Tres verificacoes, em ordem de gravidade:

1. DUPLICATAS  -> falha sempre. Um par (date, model_permaslug) repetido
                  significa que o dedupe do fetch.py quebrou, e a agregacao
                  semanal passa a somar o mesmo volume duas vezes. Silencioso
                  e corrompe todo numero da pagina.
2. FRESCOR     -> aviso a partir de --warn-lag-days, falha a partir de
                  --max-lag-days. O aviso aparece no run sem abrir issue;
                  a falha abre issue.
3. BURACOS     -> apenas informativo. Dias ausentes no historico existem e
                  sao da propria fonte.

Uso:
    python pipeline/check_freshness.py
    python pipeline/check_freshness.py --max-lag-days 10 --warn-lag-days 2
"""
import argparse, datetime as dt, os, sys
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
CSV = ROOT / "data" / "rankings_daily.csv"

# Dias que a fonte nunca publicou. Nao contam como buraco novo.
BURACOS_CONHECIDOS = {dt.date(2025, 6, 15), dt.date(2025, 7, 15)}


def anotar(nivel: str, msg: str) -> None:
    """Imprime no formato do GitHub Actions quando rodando em CI, texto puro fora."""
    if os.environ.get("GITHUB_ACTIONS") == "true":
        print(f"::{nivel}::{msg}")
    else:
        print(f"[{nivel.upper()}] {msg}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-lag-days", type=int, default=10,
                    help="atraso a partir do qual o guard falha (default: 10)")
    ap.add_argument("--warn-lag-days", type=int, default=2,
                    help="atraso a partir do qual apenas avisa (default: 2)")
    args = ap.parse_args()

    if not CSV.exists():
        anotar("error", f"{CSV} nao existe.")
        return 1

    df = pd.read_csv(CSV, parse_dates=["date"])
    falhou = False

    # 1. Duplicatas
    dups = df.duplicated(["date", "model_permaslug"], keep=False)
    n_dups = int(dups.sum())
    if n_dups:
        amostra = (df[dups].sort_values(["date", "model_permaslug"])
                     .head(5)[["date", "model_permaslug"]]
                     .to_string(index=False))
        anotar("error",
               f"{n_dups} linhas duplicadas por (date, model_permaslug). "
               f"O dedupe do fetch.py falhou e a agregacao semanal esta somando "
               f"volume repetido. Primeiras ocorrencias: {amostra.replace(chr(10), ' | ')}")
        falhou = True
    else:
        print(f"Duplicatas: 0 em {len(df)} linhas.")

    # 2. Frescor
    last = df["date"].max().date()
    yesterday = dt.datetime.now(dt.timezone.utc).date() - dt.timedelta(days=1)
    lag = (yesterday - last).days
    print(f"Ultimo dia no CSV: {last} | ontem (UTC): {yesterday} | atraso: {lag}d "
          f"| aviso: {args.warn_lag_days}d | falha: {args.max_lag_days}d")

    if lag > args.max_lag_days:
        anotar("error",
               f"Dados parados ha {lag} dias, acima do limite de {args.max_lag_days}. "
               f"Causas provaveis: chave sem permissao de leitura, endpoint "
               f"rankings-daily alterado, ou OpenRouter fora do ar. "
               f"Verifique o log do passo 'Buscar dados novos'.")
        falhou = True
    elif lag > args.warn_lag_days:
        anotar("warning",
               f"Dados com {lag} dias de atraso. Ainda dentro da tolerancia de "
               f"{args.max_lag_days}, provavelmente atraso de publicacao da fonte. "
               f"Se persistir por mais {args.max_lag_days - lag} dias, o guard falha.")

    # 3. Buracos
    todos = pd.date_range(df["date"].min(), df["date"].max(), freq="D")
    ausentes = {d.date() for d in todos} - {d.date() for d in df["date"].unique()}
    novos = sorted(ausentes - BURACOS_CONHECIDOS)
    if novos:
        anotar("warning",
               f"{len(novos)} dia(s) ausente(s) nao catalogado(s): "
               f"{', '.join(d.isoformat() for d in novos[:10])}")
    else:
        print(f"Buracos: {len(ausentes)} dia(s), todos conhecidos.")

    return 1 if falhou else 0


if __name__ == "__main__":
    sys.exit(main())
