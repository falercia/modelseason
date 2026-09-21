"""Checagens offline do snapshots.py. Nao usa rede nem chave.

Uso: python pipeline/test_snapshots.py
"""
import datetime as dt
import sys
import tempfile
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import snapshots as S  # noqa: E402

# Os testes negativos fazem o snapshots.py imprimir ::error:: e ::warning:: de
# proposito. Sem esta pausa, o GitHub transforma cada um em anotacao vermelha
# num run verde. O resultado real dos testes continua no codigo de saida.
PAUSA = f"testes-{uuid.uuid4().hex}"
print(f"::stop-commands::{PAUSA}")

TOKEN = "sk-or-v1-TESTE-nao-pode-aparecer-em-arquivo"
AGORA = dt.datetime(2026, 9, 10, 7, 15, tzinfo=dt.timezone.utc)


class Resp:
    def __init__(self, status, corpo=None, headers=None):
        self.status_code, self._corpo, self.headers = status, corpo, headers or {}
        self.text = str(corpo)[:300]

    def json(self):
        return self._corpo


class Fake:
    """Sessao falsa: responde por caminho e registra cada chamada."""

    def __init__(self, respostas):
        self.respostas, self.log = respostas, []

    def get(self, url, headers=None, params=None, timeout=None):
        caminho = url.split("/api/v1/", 1)[1]
        self.log.append((caminho, dict(params or {}), dict(headers or {})))
        r = self.respostas(caminho, params or {})
        return r if isinstance(r, Resp) else Resp(200, r)


def tasks_resp(as_of="2026-09-09", share=0.4):
    return {"data": {"window_days": 7, "as_of": as_of, "classifications": [
        {"tag": "code:general_impl", "display_name": "Code Generation", "macro_category": "code",
         "usage_share": 0.2, "token_share": share, "models": [{"id": "x/y", "tag_usage_share": 1, "tag_token_share": 1}]}],
        "macro_categories": [{"key": "code", "label": "Code", "usage_share": 0.2, "token_share": share}]}}


def roteador(tasks=None, sessions_linhas=503):
    def r(caminho, params):
        if caminho == "classifications/task":
            return tasks if tasks is not None else tasks_resp()
        if caminho == "datasets/session-cost":
            ini = params.get("offset", 0)
            n = max(0, min(500, sessions_linhas - ini))
            return {"data": [{"app_slug": "a", "model_permaslug": "m", "turn_range": "1-turn",
                              "median_session_cost_usd": 0.01}] * n,
                    "meta": {"as_of": "2026-09-08T00:00:00Z", "window_days": 7, "window_end_date": "2026-09-07"}}
        if caminho == "benchmarks":
            fonte = params.get("source", "all")
            return {"data": [{"source": fonte, "model_permaslug": "m"}],
                    "meta": {"as_of": "2026-09-05T12:00:00Z" if fonte == "all" else "2026-09-06T00:00:00Z"}}
        if caminho == "datasets/app-rankings":
            return {"data": [{"rank": 1, "app_id": 1, "app_name": "A", "total_tokens": "10", "total_requests": 1}],
                    "meta": {"as_of": "2026-09-10T02:00:00Z", "start_date": params["start_date"],
                             "end_date": params["end_date"], "version": "v1"}}
        publicas = {"providers": 106, "endpoints/zdr": 845, "embeddings/models": 33,
                    "images/models": 52, "videos/models": 28}
        if caminho in publicas:
            return {"data": [{"id": f"x/{i}", "status": 0} for i in range(publicas[caminho])]}
        if caminho == "models":
            n = 420 if params.get("output_modalities") == "all" else 351
            return {"data": [{"id": f"x/{i}", "pricing": {"prompt": "0.000001"}} for i in range(n)], "total_count": n}
        return Resp(404, {"error": "not found"})
    return r


def cliente(rot):
    return S.Cliente(TOKEN, sessao=Fake(rot), dormir=lambda s: None)


falhas = []


def check(nome, cond, detalhe=""):
    print(("  ok  " if cond else "  X   ") + nome + ("" if cond else f"  [{detalhe}]"))
    if not cond:
        falhas.append(nome)


with tempfile.TemporaryDirectory() as tmp:
    base = Path(tmp)
    keyed = ["tasks", "sessions", "benchmarks", "apps"]

    c = cliente(roteador())
    f = S.rodar(keyed, c, base=base, agora=AGORA)
    check("todas as fontes com chave gravam", f == [], f)
    check("tasks nomeado pelo as_of da fonte, nao pelo relogio", (base / "tasks/2026-09-09.json.gz").exists())
    check("sessions nomeado por window_end_date", (base / "sessions/2026-09-07.json.gz").exists())
    check("benchmarks nomeado pelo maior as_of", (base / "benchmarks/2026-09-06.json.gz").exists())
    check("apps pede o dia UTC anterior e nomeia pelo end_date", (base / "apps/2026-09-09.json.gz").exists())
    s = S.ler(base / "sessions/2026-09-07.json.gz")
    check("sessions pagina ate a ultima pagina", len(s["requests"]) == 2, len(s["requests"]))
    check("orcamento: ate 35 chamadas com chave", c.chamadas_com_chave <= 35, c.chamadas_com_chave)
    apps = S.ler(base / "apps/2026-09-09.json.gz")
    check("apps cobre geral, trending, 4 categorias e 15 subcategorias", len(apps["requests"]) == 22, len(apps["requests"]))
    t = S.ler(base / "tasks/2026-09-09.json.gz")
    check("envelope traz citacao com a data da fonte", t["citation"].endswith("as of 2026-09-09"), t["citation"])
    check("envelope guarda a resposta bruta", t["requests"][0]["response"] == tasks_resp())

    vazou = [p for p in base.rglob("*.gz") if TOKEN.encode() in S.gzip.decompress(p.read_bytes())]
    check("a chave nunca aparece em arquivo", not vazou, vazou)
    check("a chave vai so no cabecalho", all(TOKEN not in str(p) for _, p, _ in c.s.log))

    bytes1 = (base / "tasks/2026-09-09.json.gz").read_bytes()
    _, estado = S.gravar("tasks", "2026-09-09", t["requests"], base=base)
    check("mesmo conteudo nao regrava", estado == "igual", estado)
    check("gzip deterministico", (base / "tasks/2026-09-09.json.gz").read_bytes() == bytes1)

    S.rodar(["tasks"], cliente(roteador(tasks=tasks_resp(share=0.5))), base=base, agora=AGORA)
    check("revisao da fonte vira .r2 e o original fica intacto",
          (base / "tasks/2026-09-09.r2.json.gz").exists()
          and (base / "tasks/2026-09-09.json.gz").read_bytes() == bytes1)
    S.rodar(["tasks"], cliente(roteador(tasks=tasks_resp(share=0.5))), base=base, agora=AGORA)
    check("revisao repetida nao gera .r3", not (base / "tasks/2026-09-09.r3.json.gz").exists())

    f = S.rodar(["tasks", "sessions"], cliente(roteador(tasks={"data": {"as_of": "2026-09-10", "classifications": []}})),
                base=base, agora=AGORA)
    check("resposta vazia e falha, nao arquivo vazio", f == ["tasks"] and not (base / "tasks/2026-09-10.json.gz").exists(), f)

    tent = {"n": 0}

    def instavel(caminho, params):
        tent["n"] += 1
        return Resp(429, {}, {"Retry-After": "1"}) if tent["n"] == 1 else tasks_resp("2026-09-11")
    f = S.rodar(["tasks"], cliente(instavel), base=base, agora=AGORA)
    check("429 e absorvido com nova tentativa", f == [] and tent["n"] == 2, (f, tent))

    f = S.rodar(["tasks"], cliente(lambda c, p: Resp(401, {"error": "bad key"})), base=base, agora=AGORA)
    check("401 falha na hora, sem insistir", f == ["tasks"])

    r1 = [{"path": "/m", "params": {}, "response": {"data": {"endpoints": [{"price": 1, "status": 0, "latency_last_30m": 5}]}}}]
    r2 = [{"path": "/m", "params": {}, "response": {"data": {"endpoints": [{"price": 1, "status": -2, "latency_last_30m": 9}]}}}]
    r3 = [{"path": "/m", "params": {}, "response": {"data": {"endpoints": [{"price": 2, "status": 0, "latency_last_30m": 5}]}}}]
    check("endpoints: saude de provedor fica fora do hash",
          S.hash_conteudo(r1, "endpoints") == S.hash_conteudo(r2, "endpoints"))
    check("endpoints: mudanca de preco muda o hash",
          S.hash_conteudo(r1, "endpoints") != S.hash_conteudo(r3, "endpoints"))
    check("fora de endpoints, status conta", S.hash_conteudo(r1, "tasks") != S.hash_conteudo(r2, "tasks"))

    ap1 = [{"path": "/datasets/app-rankings", "params": {}, "response": {"data": [{"rank": 1}], "meta": {"as_of": "2026-09-10T19:16:39Z", "end_date": "2026-09-09"}}}]
    ap2 = [{"path": "/datasets/app-rankings", "params": {}, "response": {"data": [{"rank": 1}], "meta": {"as_of": "2026-09-10T21:00:00Z", "end_date": "2026-09-09"}}}]
    check("apps: horario da consulta fica fora do hash", S.hash_conteudo(ap1, "apps") == S.hash_conteudo(ap2, "apps"))

    def bench_vazio(caminho, params):
        if params.get("arena") == "agents":
            return {"data": [], "meta": {"as_of": "2026-09-12T19:00:00Z"}}
        return roteador()(caminho, params)
    as_of, _, _ = S.coletar_benchmarks(cliente(bench_vazio))
    check("benchmarks: resposta vazia nao define a data", as_of == "2026-09-05", as_of)

    publicas = ["providers", "zdr", "embeddings", "images", "videos", "models"]
    cp = S.Cliente(None, sessao=Fake(roteador()), dormir=lambda s: None)
    f = S.rodar(publicas, cp, base=base, agora=AGORA)
    check("fontes publicas rodam sem chave", f == [] and cp.chamadas_com_chave == 0, (f, cp.chamadas_com_chave))
    check("fontes publicas nao mandam cabecalho de autorizacao", all(not h for _, _, h in cp.s.log))
    esperados = ["providers", "zdr", "catalogs/embeddings", "catalogs/images", "catalogs/videos", "catalogs/models"]
    check("fontes publicas nas pastas certas, com o dia UTC da coleta",
          all((base / d / "2026-09-10.json.gz").exists() for d in esperados),
          [d for d in esperados if not (base / d / "2026-09-10.json.gz").exists()])
    check("main nao exige chave quando so ha fontes publicas",
          not any(x not in S.PUBLICAS for x in publicas))

    def truncado(caminho, params):
        return {"data": [{"id": "a"}] * 3}
    f = S.rodar(["zdr"], S.Cliente(None, sessao=Fake(truncado), dormir=lambda s: None), base=base, agora=AGORA)
    check("resposta publica truncada e falha", f == ["zdr"], f)

    pedidos = [p for c_, p, _ in cp.s.log if c_ == "models"]
    check("models: pede o catalogo de todas as modalidades, sem paginar",
          pedidos == [{"output_modalities": "all"}], pedidos)
    env = S.ler(base / "catalogs" / "models" / "2026-09-10.json.gz")
    check("models: guarda o preco bruto de cada modelo",
          len(env["requests"][0]["response"]["data"]) == 420 and "pricing" in env["requests"][0]["response"]["data"][0])

    def paginado(caminho, params):
        return {"data": [{"id": f"x/{i}"} for i in range(300)], "total_count": 900}
    f = S.rodar(["models"], S.Cliente(None, sessao=Fake(paginado), dormir=lambda s: None), base=base, agora=AGORA)
    check("models: lista menor que total_count e falha", f == ["models"], f)

    def curto(caminho, params):
        return {"data": [{"id": "a"}] * 40, "total_count": 40}
    f = S.rodar(["models"], S.Cliente(None, sessao=Fake(curto), dormir=lambda s: None), base=base, agora=AGORA)
    check("models: catalogo abaixo do minimo e falha", f == ["models"], f)

    z1 = [{"path": "/endpoints/zdr", "params": {}, "response": {"data": [{"price": 1, "status": 0, "uptime_last_5m": 99}]}}]
    z2 = [{"path": "/endpoints/zdr", "params": {}, "response": {"data": [{"price": 1, "status": -2, "uptime_last_5m": 80}]}}]
    check("zdr: saude de provedor fica fora do hash", S.hash_conteudo(z1, "zdr") == S.hash_conteudo(z2, "zdr"))

    n1 = [{"path": "/datasets/app-rankings", "params": {}, "response": {"data": [{"rank": 1, "app_id": 7, "app_name": "Legwork", "total_tokens": "10"}]}}]
    n2 = [{"path": "/datasets/app-rankings", "params": {}, "response": {"data": [{"rank": 1, "app_id": 7, "app_name": "Legwork support chat", "total_tokens": "10"}]}}]
    n3 = [{"path": "/datasets/app-rankings", "params": {}, "response": {"data": [{"rank": 1, "app_id": 7, "app_name": "Legwork", "total_tokens": "11"}]}}]
    _, e1 = S.gravar("apps", "2026-09-01", n1, base=base)
    _, e2 = S.gravar("apps", "2026-09-01", n2, base=base)
    _, e3 = S.gravar("apps", "2026-09-01", n3, base=base)
    check("apps: nome oscilando entre apelidos nao e revisao", (e1, e2) == ("novo", "igual"), (e1, e2))
    check("apps: token diferente continua sendo revisao", e3 == "revisao", e3)

    # Arquivo gravado com uma regra antiga (hash guardado diferente) nao vira revisao falsa.
    arq = base / "apps" / "2026-09-01.json.gz"
    env = S.ler(arq)
    env["content_sha256"] = "hash-de-uma-regra-antiga"
    arq.write_bytes(S.gzip.compress(S.json.dumps(env).encode(), mtime=0))
    _, e4 = S.gravar("apps", "2026-09-01", n2, base=base)
    check("comparacao usa o hash recalculado, nao o gravado", e4 == "igual", e4)

    modelos, _ = S.top_modelos()
    check("top modelos: 50 ids de API, sem sufixo de variante",
          len(modelos) == 50 and all(":" not in m and "/" in m for m in modelos), modelos[:3])

# ---- comparacao de duas fotos de tarefas (build_web)
import gzip  # noqa: E402
import json  # noqa: E402
import pandas as pd  # noqa: E402
import build_web as B  # noqa: E402

def foto(as_of, cls):
    return {"window_days": 7, "as_of": as_of, "classifications": [
        {"tag": tag, "display_name": tag, "macro_category": "code", "usage_share": 0.1, "token_share": ts,
         "models": [{"id": m, "tag_usage_share": 0.1, "tag_token_share": ms} for m, ms in modelos]}
        for tag, ts, modelos in cls]}

cat = pd.DataFrame([{"model_id": "a/um", "name": "A: Um"}], index=["a/um"])
antes = foto("2026-09-12", [("code:general_impl", 0.30, [("a/um", 0.5), ("b/dois", 0.3)]),
                            ("code:review_security", 0.05, [("a/um", 0.2)]), ("some", 0.10, [])])
agora = foto("2026-09-19", [("code:general_impl", 0.25, [("a/um", 0.4), ("b/dois", 0.45)]),
                            ("code:review_security", 0.09, [("a/um", 0.5), ("c/tres:free", 0.1)]), ("nova", 0.02, [])])
c = B.comparar_tarefas(agora, antes, cat)
check("comparacao: tarefa que mais ganhou, em pontos percentuais", c["ganhou"]["tag"] == "code:review_security" and c["ganhou"]["delta"] == 4.0
      and c["ganhou"]["antes"] == 5.0 and c["ganhou"]["agora"] == 9.0, c["ganhou"])
check("comparacao: modelo que mais avancou na tarefa, com o share atual", c["ganhou"]["modelo"]["slug"] == "a/um"
      and c["ganhou"]["modelo"]["delta"] == 30.0 and c["ganhou"]["modelo"]["agora"] == 50.0, c["ganhou"].get("modelo"))
check("comparacao: tarefa que mais perdeu", c["perdeu"]["tag"] == "code:general_impl" and c["perdeu"]["delta"] == -5.0, c["perdeu"])
check("comparacao: tarefa nova conta a partir de zero", "antes" in c["ganhou"] and c["ganhou"]["tag"] != "nova")
check("comparacao: base e distancia em dias", c["base"] == "2026-09-12" and c["dias"] == 7, c)
with tempfile.TemporaryDirectory() as tmp:
    pasta = Path(tmp)
    for d in ("2026-09-10", "2026-09-12", "2026-09-13", "2026-09-19"):
        env = {"requests": [{"response": {"data": foto(d, [("x", 0.1, [])])}}]}
        (pasta / f"{d}.json.gz").write_bytes(gzip.compress(json.dumps(env).encode()))
    check("foto anterior: a mais recente com 7 dias ou mais de distancia", B.foto_tarefas_anterior("2026-09-19", 7, pasta)["as_of"] == "2026-09-12")
    check("foto anterior: arquivo curto demais devolve None", B.foto_tarefas_anterior("2026-09-13", 7, pasta) is None)

print(f"::{PAUSA}::")
print(f"\n{'Falharam ' + str(len(falhas)) if falhas else 'Todas passaram'}.")
sys.exit(1 if falhas else 0)
