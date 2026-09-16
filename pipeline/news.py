"""Radar: uma edicao por dia com o que mudou no catalogo e no trafego.

Cada edicao e um arquivo imutavel em data/news/AAAA-MM-DD.json. O dia e o da
foto do catalogo (data/catalogs/models/). Escreve uma vez: se o arquivo ja
existe, nada acontece. Correcao manual vira AAAA-MM-DD.r2.json, e quem le usa a
revisao mais alta.

Nenhum texto sai daqui. Cada evento leva tipo, numeros e chaves, e o front
escreve a frase em cada idioma, como no bloco "Agora". Cada evento tambem leva
o "cruzamento": o que o historico de trafego diz sobre o modelo ou o
laboratorio no dia da noticia.

Eventos do catalogo (compara a foto do dia com as anteriores):
- novo: modelo que nao estava na foto anterior
- removido: modelo que saiu do catalogo
- preco: preco misto (75% entrada, 25% saida) chegou a um patamar novo, que se
  manteve por duas fotos seguidas e difere 10% ou mais do ultimo patamar
  estavel (duas fotos ou mais, ou o inicio da janela de 8 fotos). Preco que
  oscila e volta e ruido de roteamento entre provedores, nao noticia
- desativacao: data de expiracao anunciada ou alterada (datas depois de 2090
  sao marcador da fonte e ficam fora)
- raciocinio: o modelo passou a exigir raciocinio, ou deixou de exigir
- contexto: janela de contexto mudou
- alias: apelido "~.../latest" criado ou apontando para outro modelo
Variantes de endpoint (":free", ":batch"...) ficam fora: sao o mesmo modelo.

Eventos do trafego (so quando o ultimo dia do trafego e a vespera da edicao,
para uma edicao retroativa nao usar o trafego de hoje):
- estreia: primeiro volume do modelo no ultimo dia publicado
- lider: o lider de 7 dias mudou desde a edicao anterior
- top10: modelo entrou no top 10 de 7 dias desde a edicao anterior
- alta: ganho de 3 pp ou mais em 7 dias, sem repetir o mesmo modelo por 7 edicoes

Relevancia e uma formula fixa (RELEVANCIA), para a ordem ser auditavel.

Uso:
    python pipeline/news.py                # edicao do dia da foto mais recente
    python pipeline/news.py --dia 2026-09-15
    python pipeline/news.py --todas        # todas as edicoes possiveis que faltam
"""
import argparse
import datetime as dt
import gzip
import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_web import BLEND_PROMPT, lab_de, r  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
CATALOGO = DATA / "catalogs" / "models"
DESTINO = DATA / "news"
VERSAO = 1
LIMIAR_PRECO = 0.10
LIMIAR_ALTA_PP = 3.0
JANELA_FOTOS = 8
DATA_MARCADOR = "2090-01-01"


def ler_json(arq):
    return json.loads(arq.read_text()) if arq.exists() else None


def dias_de_catalogo(pasta=CATALOGO):
    return sorted({p.name.split(".")[0] for p in pasta.glob("*.json.gz")})


def ler_catalogo(dia, pasta=CATALOGO):
    arqs = sorted(pasta.glob(f"{dia}*.json.gz"))
    if not arqs:
        return None
    env = json.loads(gzip.decompress(arqs[-1].read_bytes()))
    return {m["id"]: m for m in env["requests"][0]["response"]["data"]}


def variante(mid):
    return ":" in mid


def apelido(mid):
    return mid.startswith("~")


def preco(m):
    p = m.get("pricing") or {}
    try:
        e, s = float(p.get("prompt")), float(p.get("completion"))
    except (TypeError, ValueError):
        return None
    if e < 0 or s < 0:  # a fonte usa -1 para preco variavel
        return None
    return {"entrada": e * 1e6, "saida": s * 1e6, "misto": (BLEND_PROMPT * e + (1 - BLEND_PROMPT) * s) * 1e6}


def nome(m):
    n = m.get("name") or m["id"]
    return (n.split(": ", 1)[1] if ": " in n else n).strip()


def expira(m):
    v = m.get("expiration_date")
    return v if isinstance(v, str) and v < DATA_MARCADOR else None


def obrigatorio(m):
    rz = m.get("reasoning")
    return bool(rz.get("mandatory")) if isinstance(rz, dict) else None


def base_modelo(m):
    limpo = m["id"].lstrip("~")
    return {"slug": m.get("canonical_slug") or m["id"], "id": m["id"], "nome": nome(m),
            "lab": lab_de(limpo), "vendor": limpo.split("/")[0]}


def patamar_novo(serie):
    """serie: precos mistos em ordem, o ultimo e o do dia (None = ausente).

    Devolve (anterior, novo) quando o dia confirma um patamar novo, senao None.
    Confirma: os dois ultimos valores iguais e o penultimo diferente do
    anterior a ele. O patamar anterior e a sequencia mais recente com duas
    fotos ou mais, ou a primeira da janela, cuja duracao real e desconhecida."""
    if len(serie) < 3 or None in serie[-3:]:
        return None
    iguais = lambda a, b: math.isclose(a, b, rel_tol=1e-9)
    if not iguais(serie[-1], serie[-2]) or iguais(serie[-2], serie[-3]):
        return None
    corridas = []  # [valor, tamanho], da mais antiga para a mais nova, sem as duas ultimas fotos
    for v in serie[:-2]:
        if v is None:
            corridas.append([None, 1])
        elif corridas and corridas[-1][0] is not None and iguais(corridas[-1][0], v):
            corridas[-1][1] += 1
        else:
            corridas.append([v, 1])
    for i in range(len(corridas) - 1, -1, -1):
        v, n = corridas[i]
        if v is not None and (n >= 2 or i == 0):
            return None if iguais(v, serie[-1]) else (v, serie[-1])
    return None


# ------------------------------------------------------------------ cruzamento

class Contexto:
    """O que o historico diz no dia da edicao: modelos.json, agora.json e data.json."""

    def __init__(self, modelos, agora, dados_v1):
        self.M = (modelos or {}).get("modelos", {})
        self.A = agora or {}
        self.labs = {x["lab"]: x for x in (dados_v1 or {}).get("volume_vs_dinheiro", [])}
        self.lideres_lab = {}
        for m in self.M.values():
            if (m.get("share_7d") or 0) <= 0:
                continue
            atual = self.lideres_lab.get(m["vendor"])
            if atual is None or m["share_7d"] > atual["share_7d"]:
                self.lideres_lab[m["vendor"]] = m

    def modelo(self, slug):
        m = self.M.get(slug)
        if not m:
            return None
        return {"share_7d": m.get("share_7d"), "rank_7d": m.get("rank_7d"),
                "pico_share": m.get("pico_share"), "semanas_com_volume": m.get("semanas_com_volume")}

    def laboratorio(self, vendor, exceto=None):
        lab = self.labs.get(vendor)
        lider = self.lideres_lab.get(vendor)
        if lider is not None and lider["slug"] == exceto:
            lider = None
        if not lab and not lider:
            return None
        out = {}
        if lab:
            out.update({"share_tokens": lab.get("share_tokens"), "share_gasto": lab.get("share_gasto")})
        if lider:
            out["lider"] = {"slug": lider["slug"], "nome": lider["nome"], "share_7d": lider["share_7d"],
                            "preco_misto": lider.get("preco_misto")}
        return out

    def peso(self, slug, vendor):
        """Share de 7 dias do modelo, ou um quinto do share do laboratorio."""
        m = self.M.get(slug)
        if m is not None:
            return float(m.get("share_7d") or 0)
        lab = self.labs.get(vendor)
        return float(lab["share_tokens"]) / 5 if lab and lab.get("share_tokens") else 0.0


def cruzar(ev, ctx):
    ev["cruzamento"] = {"modelo": ctx.modelo(ev["slug"]), "laboratorio": ctx.laboratorio(ev["vendor"], exceto=ev["slug"])}
    return ev


RELEVANCIA = {
    # base, multiplicador do peso (share em pontos), teto do bonus
    "lider": (90, 0, 0),
    "novo": (40, 2, 30),
    "desativacao": (35, 5, 40),
    "removido": (30, 5, 40),
    "estreia": (35, 8, 40),
    "top10": (50, 2, 20),
    "alta": (40, 3, 30),
    "raciocinio": (30, 3, 30),
    "preco": (20, 3, 30),
    "contexto": (15, 2, 20),
    "alias": (15, 1, 10),
}


def relevancia(ev, peso):
    base, mult, teto = RELEVANCIA[ev["tipo"]]
    extra = 0.0
    if ev["tipo"] == "preco":
        extra = min(20.0, abs(ev["dados"]["variacao_pct"]) / 5)
    return int(round(base + min(teto, mult * peso) + extra))


# ------------------------------------------------------------------ catalogo

def eventos_catalogo(dia, fotos, ctx):
    """fotos: {dia: catalogo} com o dia da edicao e ate JANELA_FOTOS - 1 anteriores."""
    dias = sorted(d for d in fotos if d <= dia)[-JANELA_FOTOS:]
    if len(dias) < 2 or dias[-1] != dia:
        return []
    hoje, ontem = fotos[dias[-1]], fotos[dias[-2]]
    evs = []

    def ev(tipo, m, dados):
        e = {"tipo": tipo, **base_modelo(m), "dados": dados}
        return cruzar(e, ctx)

    for mid, m in hoje.items():
        if variante(mid):
            continue
        a = ontem.get(mid)
        if a is None:
            if apelido(mid):
                alvo = (m.get("alias_target") or {})
                evs.append(ev("alias", m, {"alvo_slug": alvo.get("slug"), "alvo_nome": nome(alvo) if alvo.get("name") else alvo.get("slug"), "anterior": None}))
                continue
            p = preco(m)
            criado = dt.datetime.fromtimestamp(m["created"], dt.timezone.utc).strftime("%Y-%m-%d") if m.get("created") else None
            evs.append(ev("novo", m, {
                "criado": criado, "contexto": m.get("context_length"),
                "preco_entrada": r(p["entrada"], 4) if p else None, "preco_saida": r(p["saida"], 4) if p else None,
                "preco_misto": r(p["misto"], 4) if p else None,
                "raciocinio": m.get("reasoning") is not None, "raciocinio_obrigatorio": obrigatorio(m),
                "modalidade": (m.get("architecture") or {}).get("modality"),
                "pesos_abertos": bool(m.get("hugging_face_id")), "expira": expira(m),
            }))
            continue
        if apelido(mid):
            alvo, alvo_a = (m.get("alias_target") or {}).get("slug"), (a.get("alias_target") or {}).get("slug")
            if alvo != alvo_a and alvo:
                evs.append(ev("alias", m, {"alvo_slug": alvo, "alvo_nome": nome(m["alias_target"]), "anterior": alvo_a}))
            continue
        # preco: patamar novo confirmado por duas fotos
        precos = [preco(fotos[d][mid]) if mid in fotos[d] else None for d in dias]
        mud = patamar_novo([p["misto"] if p else None for p in precos])
        if mud and mud[0] > 0:
            var = mud[1] / mud[0] - 1
            if abs(var) >= LIMIAR_PRECO:
                antes = next(p for p in reversed(precos[:-2]) if p and math.isclose(p["misto"], mud[0], rel_tol=1e-9))
                ph = precos[-1]
                evs.append(ev("preco", m, {
                    "de": r(mud[0], 4), "para": r(mud[1], 4), "variacao_pct": r(100 * var, 1),
                    "entrada_de": r(antes["entrada"], 4), "entrada_para": r(ph["entrada"], 4),
                    "saida_de": r(antes["saida"], 4), "saida_para": r(ph["saida"], 4), "desde": dias[-2]}))
        if expira(m) != expira(a) and expira(m):
            evs.append(ev("desativacao", m, {"data": expira(m), "anterior": expira(a)}))
        if obrigatorio(m) is not None and obrigatorio(a) is not None and obrigatorio(m) != obrigatorio(a):
            evs.append(ev("raciocinio", m, {"obrigatorio": obrigatorio(m)}))
        if m.get("context_length") and a.get("context_length") and m["context_length"] != a["context_length"]:
            evs.append(ev("contexto", m, {"de": a["context_length"], "para": m["context_length"]}))

    for mid, a in ontem.items():
        if variante(mid) or apelido(mid) or mid in hoje:
            continue
        evs.append(ev("removido", a, {"visto_em": dias[-2], "expira": expira(a)}))
    return evs


# ------------------------------------------------------------------ trafego

def edicoes_anteriores(dia, pasta=DESTINO, n=7):
    out = []
    for p in sorted(pasta.glob("*.json"), reverse=True):
        d = p.name.split(".")[0]
        if d < dia and (not out or out[-1]["dia"] != d):
            out.append(json.loads(p.read_text()))
        if len(out) >= n:
            break
    return out


def eventos_trafego(dia, ctx, anteriores):
    A = ctx.A
    if not A or not A.get("ultimo_dia"):
        return [], None
    vespera = (dt.date.fromisoformat(dia) - dt.timedelta(days=1)).isoformat()
    if A["ultimo_dia"] != vespera:
        return [], None
    top = A.get("top7") or []
    estado = {"ultimo_dia": A["ultimo_dia"], "lider_7d": top[0]["slug"] if top else None,
              "top10_7d": [x["slug"] for x in top[:10]]}
    ant = next((e.get("estado") for e in anteriores if e.get("estado")), None)
    ja = {(e["tipo"], e["slug"]) for ed in anteriores for e in ed.get("eventos", [])}
    evs = []

    def ev(tipo, x, dados):
        e = {"tipo": tipo, "slug": x["slug"], "id": None, "nome": x["nome"], "lab": x["lab"],
             "vendor": x.get("vendor") or x["slug"].split("/")[0], "dados": dados}
        return cruzar(e, ctx)

    if ant and top and ant.get("lider_7d") and ant["lider_7d"] != top[0]["slug"]:
        antigo = ctx.M.get(ant["lider_7d"], {})
        evs.append(ev("lider", top[0], {"share": top[0]["share"], "anterior_slug": ant["lider_7d"],
                                         "anterior_nome": antigo.get("nome", ant["lider_7d"]),
                                         "anterior_share": antigo.get("share_7d")}))
    if ant:
        for i, x in enumerate(top[:10]):
            if x["slug"] not in ant.get("top10_7d", []) and ("top10", x["slug"]) not in ja:
                evs.append(ev("top10", x, {"posicao": i + 1, "share": x["share"], "lancamento": x.get("lancamento")}))
    for x in A.get("estreias") or []:
        if x["primeiro_dia"] == A["ultimo_dia"] and ("estreia", x["slug"]) not in ja:
            dias_cat = None
            if x.get("lancamento"):
                dias_cat = (dt.date.fromisoformat(x["primeiro_dia"]) - dt.date.fromisoformat(x["lancamento"])).days
            evs.append(ev("estreia", {**x, "vendor": x["slug"].split("/")[0]},
                          {"primeiro_dia": x["primeiro_dia"], "share_7d": x["share"], "lancamento": x.get("lancamento"),
                           "dias_desde_catalogo": dias_cat}))
    for x in A.get("subiram") or []:
        if x["delta_pp"] >= LIMIAR_ALTA_PP and ("alta", x["slug"]) not in ja and not x.get("estreou"):
            evs.append(ev("alta", x, {"de": x["de"], "para": x["para"], "delta_pp": x["delta_pp"]}))
    return evs, estado


# ------------------------------------------------------------------ edicao

def montar(dia, fotos, ctx, anteriores, agora_utc):
    evs = eventos_catalogo(dia, fotos, ctx)
    ev_t, estado = eventos_trafego(dia, ctx, anteriores)
    evs += ev_t
    for e in evs:
        e["relevancia"] = relevancia(e, ctx.peso(e["slug"], e["vendor"]))
    evs.sort(key=lambda e: (-e["relevancia"], e["tipo"], e["slug"]))
    dias = sorted(d for d in fotos if d <= dia)
    return {
        "versao": VERSAO, "dia": dia, "gerado_em": agora_utc.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "fontes": {"catalogo": [dias[0], dias[-1]], "trafego": estado["ultimo_dia"] if estado else None},
        "citacao": f"Source: OpenRouter (openrouter.ai/rankings), as of {dia}",
        "licenca": "CC BY 4.0",
        "estado": estado,
        "principal": evs[0]["tipo"] + ":" + evs[0]["slug"] if evs else None,
        "eventos": evs,
    }


def escrever(dia, edicao, pasta=DESTINO):
    pasta.mkdir(parents=True, exist_ok=True)
    arq = pasta / f"{dia}.json"
    if arq.exists():
        return None
    arq.write_text(json.dumps(edicao, ensure_ascii=False, indent=1) + "\n")
    return arq


def rodar(dias, pasta_cat=CATALOGO, pasta_out=DESTINO, modelos=None, agora=None, dados_v1=None, agora_utc=None):
    agora_utc = agora_utc or dt.datetime.now(dt.timezone.utc)
    ctx = Contexto(modelos, agora, dados_v1)
    todos = dias_de_catalogo(pasta_cat)
    gravados = []
    for dia in dias:
        if (pasta_out / f"{dia}.json").exists():
            print(f"  {dia}: ja existe, mantido")
            continue
        janela = [d for d in todos if d <= dia][-JANELA_FOTOS:]
        if len(janela) < 2 or janela[-1] != dia:
            print(f"  {dia}: sem foto do dia ou da vespera, pulado")
            continue
        fotos = {d: ler_catalogo(d, pasta_cat) for d in janela}
        ed = montar(dia, fotos, ctx, edicoes_anteriores(dia, pasta_out), agora_utc)
        if not ed["eventos"] and not ed["estado"]:
            print(f"  {dia}: nada mudou e sem trafego da vespera, sem edicao")
            continue
        arq = escrever(dia, ed, pasta_out)
        gravados.append(arq)
        print(f"  {dia}: {len(ed['eventos'])} evento(s), principal {ed['principal']}")
    return gravados


def main(argv=None):
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--dia")
    g.add_argument("--todas", action="store_true")
    a = ap.parse_args(argv)
    todos = dias_de_catalogo()
    if not todos:
        print("Nenhuma foto do catalogo.")
        return 0
    dias = todos[1:] if a.todas else [a.dia or todos[-1]]
    rodar(dias, modelos=ler_json(DATA / "web" / "modelos.json"), agora=ler_json(DATA / "web" / "agora.json"),
          dados_v1=ler_json(ROOT / "public" / "data.json"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
