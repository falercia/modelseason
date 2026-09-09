"""Guard de frescor: falha se data/rankings_daily.csv parou de avançar.

Existe porque o modo de falha perigoso do pipeline nao e o erro barulhento
(chave revogada da 401 e o job quebra sozinho), e sim o silencioso: a API
responde 200 com dados velhos, o commit nao muda nada e a pagina fica
congelada mostrando "atualizado hoje". Este script transforma isso em falha.

Uso: python pipeline/check_freshness.py [--max-lag-days N]
Sai com 1 se o ultimo dia do CSV estiver mais de N dias atras de ontem (UTC).
"""
import argparse, datetime as dt, sys
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
CSV = ROOT / "data" / "rankings_daily.csv"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-lag-days", type=int, default=2)
    args = ap.parse_args()

    if not CSV.exists():
        print(f"ERRO: {CSV} nao existe.", file=sys.stderr)
        return 1

    df = pd.read_csv(CSV, usecols=["date"], parse_dates=["date"])
    last = df["date"].max().date()
    yesterday = dt.datetime.now(dt.timezone.utc).date() - dt.timedelta(days=1)
    lag = (yesterday - last).days

    print(f"Ultimo dia no CSV: {last} | ontem (UTC): {yesterday} | atraso: {lag}d "
          f"| tolerancia: {args.max_lag_days}d")

    if lag > args.max_lag_days:
        print(
            f"ERRO: dados parados ha {lag} dias. Causas provaveis: chave sem permissao "
            f"de leitura, endpoint rankings-daily alterado, ou OpenRouter atrasando a "
            f"publicacao. Verifique o log do passo 'Buscar dados novos'.",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
