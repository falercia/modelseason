"""Checagens offline do Radar (pipeline/news.py), com catalogos sinteticos.

Uso: python pipeline/test_news.py
"""
import datetime as dt
import gzip
import json
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import news as N  # noqa: E402

falhas = []


def ok(nome, cond, det=""):
    print(("  ok  " if cond else "  X   ") + nome + ("" if cond else f"  [{det}]"))
    if not cond:
        falhas.append(nome)


def modelo(mid, entrada=1.0, saida=2.0, ctx=100000, canon=None, **extra):
    return {"id": mid, "canonical_slug": canon or mid + "-20260101", "name": "Lab: " + mid.split("/")[-1] + " ",
            "created": 1788000000, "context_length": ctx,
            "pricing": {"prompt": str(entrada / 1e6), "completion": str(saida / 1e6)},
            "architecture": {"modality": "text->text"}, **extra}


def gravar(pasta, dia, modelos):
    env = {"source": "models", "as_of": dia, "requests": [{"response": {"data": modelos}}]}
    (pasta / f"{dia}.json.gz").write_bytes(gzip.compress(json.dumps(env).encode()))


DIAS = ["2026-09-10", "2026-09-11", "2026-09-12", "2026-09-13", "2026-09-14"]
AGORA_UTC = dt.datetime(2026, 9, 14, 8, tzinfo=dt.timezone.utc)

with tempfile.TemporaryDirectory() as tmp:
    cat, out = Path(tmp) / "cat", Path(tmp) / "news"
    cat.mkdir()
    base = [modelo("acme/estavel"), modelo("acme/oscila"), modelo("acme/sobe"), modelo("acme/sai"),
            modelo("acme/pouco", entrada=1.0, saida=2.0), modelo("acme/rz", reasoning={"mandatory": False}),
            modelo("~acme/latest", alias_target={"slug": "acme/estavel", "name": "Lab: estavel"}),
            modelo("acme/estavel:free")]
    precos = {  # (entrada, saida) por dia
        "acme/oscila": [(1, 2), (1, 2), (0.5, 1), (1, 2), (1, 2)],
        "acme/sobe": [(1, 2), (1, 2), (1, 2), (2, 4), (2, 4)],
        "acme/pouco": [(1, 2), (1, 2), (1, 2), (1.05, 2.1), (1.05, 2.1)],
    }
    for i, dia in enumerate(DIAS):
        ms = []
        for m in base:
            m = json.loads(json.dumps(m))
            if m["id"] in precos:
                e, s = precos[m["id"]][i]
                m["pricing"] = {"prompt": str(e / 1e6), "completion": str(s / 1e6)}
            if dia == DIAS[-1]:
                if m["id"] == "acme/sai":
                    continue
                if m["id"] == "acme/rz":
                    m["reasoning"] = {"mandatory": True}
                if m["id"] == "acme/estavel":
                    m["expiration_date"] = "2026-10-01"
                    m["context_length"] = 200000
                if m["id"] == "~acme/latest":
                    m["alias_target"] = {"slug": "acme/novo", "name": "Lab: novo"}
            ms.append(m)
        if dia == DIAS[-1]:
            ms.append(modelo("acme/novo", entrada=3, saida=9, reasoning={"mandatory": True}, hugging_face_id="acme/novo"))
            ms.append(modelo("acme/novo:free"))
            ms.append(modelo("acme/marcador", expiration_date="2098-12-31"))
        gravar(cat, dia, ms)
    # o marcador precisa existir na vespera para nao virar "novo"
    antes = json.loads(gzip.decompress((cat / f"{DIAS[-2]}.json.gz").read_bytes()))
    antes["requests"][0]["response"]["data"].append(modelo("acme/marcador"))
    (cat / f"{DIAS[-2]}.json.gz").write_bytes(gzip.compress(json.dumps(antes).encode()))

    modelos = {"modelos": {"acme/sobe-20260101": {"slug": "acme/sobe-20260101", "nome": "sobe", "vendor": "acme",
                                                   "share_7d": 4.0, "rank_7d": 5, "preco_misto": 1.25},
                           "acme/lider-20260101": {"slug": "acme/lider-20260101", "nome": "lider", "vendor": "acme",
                                                    "share_7d": 20.0, "rank_7d": 1, "preco_misto": 0.5}}}
    dados_v1 = {"volume_vs_dinheiro": [{"lab": "acme", "share_tokens": 30.0, "share_gasto": 10.0}]}
    agora = {"ultimo_dia": "2026-09-13",
             "top7": [{"slug": "acme/lider-20260101", "nome": "lider", "lab": "Acme", "share": 20.0},
                      {"slug": "acme/sobe-20260101", "nome": "sobe", "lab": "Acme", "share": 4.0}],
             "estreias": [{"slug": "acme/est-20260101", "nome": "est", "lab": "Acme", "share": 1.2,
                           "primeiro_dia": "2026-09-13", "lancamento": "2026-09-10"}],
             "subiram": [{"slug": "acme/sobe-20260101", "nome": "sobe", "lab": "Acme", "de": 0.5, "para": 4.0,
                          "delta_pp": 3.5, "estreou": False}]}

    g = N.rodar([DIAS[-1]], pasta_cat=cat, pasta_out=out, modelos=modelos, agora=agora, dados_v1=dados_v1, agora_utc=AGORA_UTC)
    ok("grava uma edicao", len(g) == 1 and g[0].exists())
    ed = json.loads(g[0].read_text())
    tipos = {(e["tipo"], e["id"] or e["slug"]) for e in ed["eventos"]}
    ok("modelo novo", ("novo", "acme/novo") in tipos, tipos)
    ok("variante :free nunca vira evento", not any(":" in (e["id"] or "") for e in ed["eventos"]))
    ok("removido", ("removido", "acme/sai") in tipos)
    ok("preco que oscila e volta nao vira noticia", not any(e["id"] == "acme/oscila" for e in ed["eventos"]))
    ok("preco com patamar novo confirmado", ("preco", "acme/sobe") in tipos)
    ok("variacao abaixo de 10% fica fora", not any(e["id"] == "acme/pouco" for e in ed["eventos"]))
    sobe = next(e for e in ed["eventos"] if e["id"] == "acme/sobe")
    ok("variacao de preco em %", sobe["dados"]["variacao_pct"] == 100.0, sobe["dados"])
    ok("desativacao com data real", ("desativacao", "acme/estavel") in tipos)
    ok("data marcador 2098 ignorada", not any(e["tipo"] == "desativacao" and e["id"] == "acme/marcador" for e in ed["eventos"]))
    ok("raciocinio passou a ser obrigatorio", ("raciocinio", "acme/rz") in tipos)
    ok("contexto mudou", ("contexto", "acme/estavel") in tipos)
    ok("apelido trocou de alvo", ("alias", "~acme/latest") in tipos)
    alias = next(e for e in ed["eventos"] if e["tipo"] == "alias")
    ok("laboratorio do apelido sem til", alias["vendor"] == "acme" and not alias["lab"].startswith("~"), alias["lab"])
    novo = next(e for e in ed["eventos"] if e["tipo"] == "novo")
    ok("nome sem espaco sobrando", novo["nome"] == "novo", repr(novo["nome"]))
    ok("novo leva preco, raciocinio e pesos", novo["dados"]["preco_entrada"] == 3.0 and novo["dados"]["raciocinio_obrigatorio"] is True
       and novo["dados"]["pesos_abertos"] is True, novo["dados"])
    ok("cruzamento traz o lider do laboratorio", novo["cruzamento"]["laboratorio"]["lider"]["slug"] == "acme/lider-20260101")
    ok("cruzamento do modelo com trafego", sobe["cruzamento"]["modelo"]["share_7d"] == 4.0)
    ok("estreia de trafego da vespera", ("estreia", "acme/est-20260101") in tipos)
    est = next(e for e in ed["eventos"] if e["tipo"] == "estreia")
    ok("dias entre catalogo e estreia", est["dados"]["dias_desde_catalogo"] == 3, est["dados"])
    ok("alta de 3 pp ou mais", ("alta", "acme/sobe-20260101") in tipos)
    ok("sem edicao anterior, lider e top10 nao disparam", not any(e["tipo"] in ("lider", "top10") for e in ed["eventos"]))
    ok("estado guardado", ed["estado"]["lider_7d"] == "acme/lider-20260101")
    rel = [e["relevancia"] for e in ed["eventos"]]
    ok("ordenado por relevancia", rel == sorted(rel, reverse=True), rel)
    ok("principal e o primeiro", ed["principal"] == ed["eventos"][0]["tipo"] + ":" + ed["eventos"][0]["slug"])

    # imutavel: rodar de novo nao reescreve
    antes_txt = g[0].read_text()
    g2 = N.rodar([DIAS[-1]], pasta_cat=cat, pasta_out=out, modelos=modelos, agora={}, dados_v1=dados_v1, agora_utc=AGORA_UTC)
    ok("edicao existente nao e reescrita", g2 == [] and g[0].read_text() == antes_txt)

    # dia seguinte: lider mudou, entrou no top 10, alta nao repete
    gravar(cat, "2026-09-15", json.loads(gzip.decompress((cat / f"{DIAS[-1]}.json.gz").read_bytes()))["requests"][0]["response"]["data"])
    agora2 = {**agora, "ultimo_dia": "2026-09-14", "estreias": [],
              "top7": [{"slug": "acme/sobe-20260101", "nome": "sobe", "lab": "Acme", "share": 21.0},
                       {"slug": "acme/lider-20260101", "nome": "lider", "lab": "Acme", "share": 19.0},
                       {"slug": "acme/x-20260101", "nome": "x", "lab": "Acme", "share": 2.0}]}
    g3 = N.rodar(["2026-09-15"], pasta_cat=cat, pasta_out=out, modelos=modelos, agora=agora2, dados_v1=dados_v1, agora_utc=AGORA_UTC)
    ed3 = json.loads(g3[0].read_text())
    t3 = {(e["tipo"], e["slug"]) for e in ed3["eventos"]}
    ok("troca de lider", ("lider", "acme/sobe-20260101") in t3, t3)
    ok("lider vem primeiro", ed3["eventos"][0]["tipo"] == "lider")
    ok("entrou no top 10", ("top10", "acme/x-20260101") in t3)
    ok("alta nao repete em 7 edicoes", ("alta", "acme/sobe-20260101") not in t3)
    ok("catalogo igual nao gera evento de catalogo", not any(e["tipo"] in ("novo", "removido", "preco") for e in ed3["eventos"]))

    # retroativa: trafego que nao e da vespera fica fora
    gravar(cat, "2026-09-16", json.loads(gzip.decompress((cat / "2026-09-15.json.gz").read_bytes()))["requests"][0]["response"]["data"])
    g4 = N.rodar(["2026-09-16"], pasta_cat=cat, pasta_out=out, modelos=modelos, agora=agora2, dados_v1=dados_v1, agora_utc=AGORA_UTC)
    ok("sem trafego da vespera e sem mudanca, nenhuma edicao", g4 == [])

    ok("patamar: oscilacao", N.patamar_novo([1.4, 1.092, 1.4, 1.4]) is None)
    ok("patamar: subida simples", N.patamar_novo([1, 2, 2]) == (1, 2))
    ok("patamar: ignora transiente", N.patamar_novo([1, 1, 3, 2, 2]) == (1, 2))
    ok("patamar: ja anunciado", N.patamar_novo([1, 2, 2, 2]) is None)
    ok("patamar: sem a foto anterior nao da para saber se e novo", N.patamar_novo([1, None, 2, 2]) is None)

print(f"\n{'TODAS AS CHECAGENS PASSARAM' if not falhas else str(len(falhas)) + ' FALHA(S)'}")
sys.exit(1 if falhas else 0)
