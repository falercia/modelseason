"""Retroage as series da API que ACEITAM datas passadas, desde 01/01/2025.

Diferente do snapshots.py: aqui nada se perde se esperar, entao o script roda
sob demanda, com teto de chamadas, e retoma de onde parou.

Series:
- rankings: `datasets/rankings-daily` filtrado por
    modality (text, image, image_output, audio, tool_calling) e
    context_bucket (1K, 10K, 100K, 1M, 10M): dado exato, grao diario;
    category (12 casos de uso) e language_type (natural, programming):
    estimativa amostrada da fonte, grao semanal (a fonte recusa period=day).
  Um arquivo por filtro em data/backfill/rankings/<filtro>=<valor>.json.gz,
  com o historico inteiro. Rodar de novo estende ate o ultimo dia publicado.
- apps: `datasets/app-rankings` por semana (segunda a domingo), geral e as 4
  categorias. Um arquivo por semana em data/backfill/apps/<segunda>.json.gz.
  Semana ja gravada e pulada.

Orcamento: rankings custa ~48 chamadas; apps, 5 por semana (~440 no total).
O teto padrao de 400 por execucao deixa folga para o diario dentro do limite
de 500 por dia da conta. Execucoes seguidas completam o que faltar.

Uso:
    python pipeline/backfill.py --serie rankings
    python pipeline/backfill.py --serie apps --max-chamadas 300
"""
import argparse
import datetime as dt
import gzip
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import snapshots as S  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
DESTINO = ROOT / "data" / "backfill"
INICIO = dt.date(2025, 1, 1)
FILTROS_DIA = {"modality": ["text", "image", "image_output", "audio", "tool_calling"],
               "context_bucket": ["1K", "10K", "100K", "1M", "10M"]}
FILTROS_SEMANA = {"category": ["programming", "roleplay", "marketing", "marketing/seo", "technology", "science",
                               "translation", "legal", "finance", "health", "trivia", "academia"],
                  "language_type": ["natural", "programming"]}


class Teto(Exception):
    pass


class ClienteComTeto(S.Cliente):
    def __init__(self, token, maximo, **kw):
        super().__init__(token, **kw)
        self.maximo = maximo

    def get(self, caminho, params=None, com_chave=True):
        if self.chamadas_com_chave >= self.maximo:
            raise Teto()
        return super().get(caminho, params, com_chave)


def escrever(arq, envelope):
    arq.parent.mkdir(parents=True, exist_ok=True)
    corpo = json.dumps(envelope, ensure_ascii=False, separators=(",", ":")).encode()
    tmp = arq.with_name(arq.name + ".tmp")
    tmp.write_bytes(gzip.compress(corpo, compresslevel=9, mtime=0))
    tmp.replace(arq)


def envelope(fonte, as_of, reqs, agora):
    return {"source": fonte, "as_of": as_of, "fetched_at": agora.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "content_sha256": S.hash_conteudo(reqs), "license": "CC BY 4.0",
            "citation": S.CITACAO.get(fonte, S.CITACAO["default"]).format(as_of=as_of), "requests": reqs}


def blocos(ini, fim, dias=364):
    cur = ini
    while cur <= fim:
        nxt = min(cur + dt.timedelta(days=dias - 1), fim)
        yield cur, nxt
        cur = nxt + dt.timedelta(days=1)


def rankings(c, ontem, base, agora):
    feitos = 0
    for filtro, valores, periodo in [(k, v, "day") for k, v in FILTROS_DIA.items()] + \
                                    [(k, v, "week") for k, v in FILTROS_SEMANA.items()]:
        for valor in valores:
            arq = base / "rankings" / f"{filtro}={valor.replace('/', '_')}.json.gz"
            reqs = []
            for a, b in blocos(INICIO, ontem):
                reqs.append(c.get("datasets/rankings-daily", {"start_date": a.isoformat(), "end_date": b.isoformat(),
                                                              "period": periodo, filtro: valor}))
            linhas = sum(len(q["response"].get("data") or []) for q in reqs)
            fim = max(((q["response"].get("meta") or {}).get("end_date") or "") for q in reqs) or ontem.isoformat()
            escrever(arq, envelope("rankings", fim[:10], reqs, agora))
            feitos += 1
            print(f"  {filtro}={valor}: {linhas} linhas ate {fim[:10]} -> {arq.relative_to(ROOT) if arq.is_relative_to(ROOT) else arq}")
    return feitos


def apps(c, ontem, base, agora):
    seg = INICIO + dt.timedelta(days=(7 - INICIO.weekday()) % 7)  # primeira segunda-feira
    feitos = 0
    while seg + dt.timedelta(days=6) <= ontem:
        dom = seg + dt.timedelta(days=6)
        arq = base / "apps" / f"{seg.isoformat()}.json.gz"
        if not arq.exists():
            p = {"start_date": seg.isoformat(), "end_date": dom.isoformat(), "limit": 100, "sort": "popular"}
            reqs = [c.get("datasets/app-rankings", p)]
            reqs += [c.get("datasets/app-rankings", {**p, "limit": 50, "category": k}) for k in S.APP_CATEGORIAS]
            escrever(arq, envelope("apps", dom.isoformat(), reqs, agora))
            feitos += 1
        seg += dt.timedelta(days=7)
    return feitos


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--serie", choices=["rankings", "apps"], required=True)
    ap.add_argument("--max-chamadas", type=int, default=400)
    ap.add_argument("--out", default=None)
    a = ap.parse_args(argv)
    token = os.environ.get("OPENROUTER_API_KEY")
    if not token:
        print("OPENROUTER_API_KEY nao definida", file=sys.stderr)
        return 2
    agora = dt.datetime.now(dt.timezone.utc)
    ontem = agora.date() - dt.timedelta(days=1)
    base = Path(a.out) if a.out else DESTINO
    c = ClienteComTeto(token, a.max_chamadas)
    try:
        n = (rankings if a.serie == "rankings" else apps)(c, ontem, base, agora)
        print(f"Completo: {n} arquivo(s) gravado(s), {c.chamadas_com_chave} chamadas.")
    except Teto:
        print(f"Teto de {a.max_chamadas} chamadas atingido. Rode de novo amanha para continuar; o que foi gravado fica.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
