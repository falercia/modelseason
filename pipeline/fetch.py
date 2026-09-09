"""Incremental fetch of OpenRouter rankings-daily into data/rankings_daily.csv.

- Reads the existing CSV, finds the last date, refetches from (last_date - OVERLAP_DAYS)
  through yesterday (UTC) so late revisions by OpenRouter are picked up.
- Respects the API limit of 366 days per request by chunking.
- Dedupes on (date, model_permaslug), keeping the newest fetch.

Env: OPENROUTER_API_KEY (required).
"""
import os, sys, time, datetime as dt
from pathlib import Path
import pandas as pd
import requests

ROOT = Path(__file__).resolve().parents[1]
CSV = ROOT / "data" / "rankings_daily.csv"
URL = "https://openrouter.ai/api/v1/datasets/rankings-daily"
DATASET_START = dt.date(2025, 1, 1)
MAX_SPAN = 364          # API rejects ranges > 366 days; keep a margin
OVERLAP_DAYS = 3        # refetch the last few days to absorb revisions


def chunks(start: dt.date, end: dt.date):
    cur = start
    while cur <= end:
        nxt = min(cur + dt.timedelta(days=MAX_SPAN - 1), end)
        yield cur, nxt
        cur = nxt + dt.timedelta(days=1)


def fetch_range(token: str, start: dt.date, end: dt.date) -> pd.DataFrame:
    r = requests.get(
        URL,
        headers={"Authorization": f"Bearer {token}"},
        params={"start_date": start.isoformat(), "end_date": end.isoformat(), "period": "day"},
        timeout=180,
    )
    if r.status_code == 429:
        time.sleep(30)
        return fetch_range(token, start, end)
    r.raise_for_status()
    rows = r.json()["data"]
    print(f"  {start} → {end}: {len(rows)} rows")
    return pd.DataFrame(rows)


def main() -> int:
    token = os.environ.get("OPENROUTER_API_KEY")
    if not token:
        print("OPENROUTER_API_KEY not set", file=sys.stderr)
        return 2

    yesterday = dt.datetime.now(dt.timezone.utc).date() - dt.timedelta(days=1)
    if CSV.exists():
        old = pd.read_csv(CSV, dtype={"total_tokens": "int64"}, parse_dates=["date"])
        last = old["date"].max().date()
        start = max(DATASET_START, last - dt.timedelta(days=OVERLAP_DAYS))
    else:
        old = pd.DataFrame(columns=["date", "model_permaslug", "total_tokens"])
        start = DATASET_START

    if start > yesterday:
        print("Nothing to fetch.")
        return 0

    print(f"Fetching {start} → {yesterday}")
    parts = [fetch_range(token, a, b) for a, b in chunks(start, yesterday)]
    new = pd.concat(parts, ignore_index=True)
    if new.empty:
        print("API returned no rows.")
        return 0
    new["date"] = pd.to_datetime(new["date"])
    new["total_tokens"] = new["total_tokens"].astype("int64")

    merged = pd.concat([old, new], ignore_index=True)
    merged = merged.drop_duplicates(["date", "model_permaslug"], keep="last")
    merged = merged.sort_values(["date", "total_tokens"], ascending=[True, False])
    merged["date"] = pd.to_datetime(merged["date"]).dt.date
    CSV.parent.mkdir(parents=True, exist_ok=True)
    merged.to_csv(CSV, index=False)
    print(f"Saved {len(merged)} rows, {merged['date'].min()} → {merged['date'].max()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
