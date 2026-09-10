"""Arquivo diario das fontes do OpenRouter que NAO guardam historico.

Por que existe: quatro fontes da API devolvem so uma foto do presente. O dado de
ontem some quando a foto de hoje e publicada, e ninguem consegue reconstruir o
passado depois. Cada dia sem este script rodando e um dia perdido para sempre.

| Fonte       | Endpoint                          | Janela da fonte        | Pasta             |
|-------------|-----------------------------------|------------------------|-------------------|
| tasks       | /classifications/task             | 7 dias moveis          | data/tasks/       |
| sessions    | /datasets/session-cost            | semanal                | data/sessions/    |
| benchmarks  | /benchmarks                       | foto atual por fonte   | data/benchmarks/  |
| endpoints   | /models/{id}/endpoints            | foto atual, sem as_of  | data/endpoints/   |
| apps        | /datasets/app-rankings            | dia fechado (ontem)    | data/apps/        |
| providers   | /providers                        | foto atual, sem as_of  | data/providers/   |
| zdr         | /endpoints/zdr                    | foto atual, sem as_of  | data/zdr/         |
| embeddings  | /embeddings/models                | foto atual, sem as_of  | data/catalogs/embeddings/ |
| images      | /images/models                    | foto atual, sem as_of  | data/catalogs/images/     |
| videos      | /videos/models                    | foto atual, sem as_of  | data/catalogs/videos/     |

`apps` aceita datas passadas e pode ser retroagido. Entra aqui porque a foto
diaria por categoria e subcategoria e barata e ja deixa a serie pronta.

Regras:
- O arquivo guarda a resposta BRUTA. Nada e filtrado ou renomeado; o parser vem
  depois e pode ser refeito a partir daqui. O arquivo e a fonte de verdade.
- O nome do arquivo e a data que a PROPRIA FONTE informa (`as_of`,
  `window_end_date`, `end_date`), nunca a data do relogio. Excecao: as fontes
  publicas (`endpoints`, `providers`, `zdr` e os catalogos), que nao trazem data
  nenhuma e usam o dia UTC da coleta.
- Nunca sobrescreve. Mesma data com o mesmo conteudo: nao grava. Mesma data com
  conteudo diferente (a fonte revisou): grava `AAAA-MM-DD.r2.json.gz`, `r3`...
- Campos que mudam a cada minuto (uptime, latencia, throughput de provedor) ficam
  no arquivo, mas fora do hash de comparacao. Sem isso, rodar duas vezes no mesmo
  dia geraria uma "revisao" que a fonte nunca fez.
- Formato: JSON compacto em gzip. O JSON indentado dava ~650 KB/dia so em
  `endpoints`; comprimido fica em ~30 KB. Ler: `gzip -dc arquivo.json.gz | jq`.
- Falha alto. Fonte com resposta vazia conta como falha, porque falha silenciosa
  e a pior. Uma fonte que falha nao impede as outras de gravar; o codigo de saida
  e 1 se qualquer uma falhou.
- A chave nunca e gravada nem impressa. Cabecalhos nao entram no arquivo.

Orcamento: ~27 chamadas com chave por execucao (limite: 30/min, 500/dia por
conta). As fontes publicas nao consomem a cota da chave.

Env: OPENROUTER_API_KEY (obrigatoria para as fontes com chave).
Uso:
    python pipeline/snapshots.py                      # todas as fontes
    python pipeline/snapshots.py --only tasks,apps
    python pipeline/snapshots.py --apps-day 2026-09-01
    python pipeline/snapshots.py --only endpoints,providers,zdr,embeddings,images,videos --out /tmp/teste   # sem chave
"""
import argparse
import datetime as dt
import gzip
import hashlib
import json
import os
import sys
import time
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
BASE = "https://openrouter.ai/api/v1"

PAUSA_COM_CHAVE = 2.2      # 30 req/min por chave, com folga
PAUSA_PUBLICO = 0.5
TENTATIVAS = 4
TOP_ENDPOINTS = 50         # modelos cobertos no endpoint de provedores

# Campos que mudam a cada chamada sem que a fonte tenha revisado nada. Ficam no
# arquivo, mas fora do hash de comparacao.
# - endpoints: saude de provedor, medida em janelas de 5 min a 1 dia.
# - apps: meta.as_of e o horario da consulta, nao a data do dado (visto na
#   primeira coleta real: as_of 19:16:39 para um end_date de ontem). E app_name
#   oscila entre apelidos do mesmo app ("Legwork" x "Legwork support chat") com
#   rank, app_id e tokens identicos; a identidade do app e o app_id.
# - zdr: mesma saude de provedor de `endpoints`.
_SAUDE = {"status", "uptime_last_5m", "uptime_last_30m", "uptime_last_1d",
          "latency_last_30m", "throughput_last_30m"}
VOLATEIS = {
    "endpoints": _SAUDE,
    "zdr": _SAUDE,
    "apps": {"as_of", "app_name"},
}

# Fontes que nao exigem chave e nao consomem a cota.
PUBLICAS = {"endpoints", "providers", "zdr", "embeddings", "images", "videos"}

APP_CATEGORIAS = ["coding", "creative", "productivity", "entertainment"]
APP_SUBCATEGORIAS = [
    "cli-agent", "ide-extension", "cloud-agent", "programming-app",
    "native-app-builder", "creative-writing", "video-gen", "image-gen",
    "audio-gen", "roleplay", "game", "writing-assistant", "general-chat",
    "personal-agent", "legal",
]

CITACAO = {
    "apps": "Source: OpenRouter (openrouter.ai/apps), as of {as_of}",
    "default": "Source: OpenRouter (openrouter.ai/rankings), as of {as_of}",
}


class FonteVazia(RuntimeError):
    pass


# ---------------------------------------------------------------- HTTP

class Cliente:
    def __init__(self, token, sessao=None, dormir=time.sleep):
        self.token = token
        self.s = sessao or requests.Session()
        self.dormir = dormir
        self.chamadas_com_chave = 0
        self.chamadas_publicas = 0

    def get(self, caminho, params=None, com_chave=True):
        if com_chave and not self.token:
            raise RuntimeError("OPENROUTER_API_KEY nao definida")
        url = f"{BASE}/{caminho.lstrip('/')}"
        headers = {"Authorization": f"Bearer {self.token}"} if com_chave else {}
        params = {k: v for k, v in (params or {}).items() if v is not None}
        ultimo = None
        for tentativa in range(1, TENTATIVAS + 1):
            if com_chave:
                self.chamadas_com_chave += 1
            else:
                self.chamadas_publicas += 1
            try:
                r = self.s.get(url, headers=headers, params=params, timeout=90)
            except requests.RequestException as e:
                ultimo = f"{type(e).__name__}"
                self.dormir(10 * tentativa)
                continue
            self.dormir(PAUSA_COM_CHAVE if com_chave else PAUSA_PUBLICO)
            if r.status_code == 429 or r.status_code >= 500:
                # Teto de 60s: com a API fora do ar, esperar mais so estoura o timeout do job
                # e perde tambem o que as outras fontes ja tinham coletado.
                espera = min(60, int(r.headers.get("Retry-After", "0") or 0) or 30 * tentativa)
                ultimo = f"HTTP {r.status_code}"
                self.dormir(espera)
                continue
            if r.status_code != 200:
                # Corpo curto ajuda o diagnostico e nunca contem a chave.
                raise RuntimeError(f"{caminho} {params} -> HTTP {r.status_code}: {r.text[:200]}")
            return {"path": "/" + caminho.lstrip("/"), "params": params,
                    "status": r.status_code, "response": r.json()}
        raise RuntimeError(f"{caminho} {params} falhou {TENTATIVAS}x ({ultimo})")


# ---------------------------------------------------------------- gravacao

def _sem_volateis(x, fora):
    if not fora:
        return x
    if isinstance(x, dict):
        return {k: _sem_volateis(v, fora) for k, v in x.items() if k not in fora}
    if isinstance(x, list):
        return [_sem_volateis(v, fora) for v in x]
    return x


def hash_conteudo(requisicoes, fonte=None):
    """Hash so do que a fonte devolveu, sem horario de coleta e sem campos volateis."""
    fora = VOLATEIS.get(fonte, set())
    canon = json.dumps([[q["path"], q["params"], _sem_volateis(q["response"], fora)] for q in requisicoes],
                       sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(canon.encode()).hexdigest()


def gravar(fonte, as_of, requisicoes, base=None, agora=None):
    """Grava o envelope. Devolve (caminho, 'novo' | 'revisao' | 'igual')."""
    pasta = Path(base or DATA) / PASTAS[fonte]
    pasta.mkdir(parents=True, exist_ok=True)
    h = hash_conteudo(requisicoes, fonte)
    existentes = sorted(pasta.glob(f"{as_of}.json.gz")) + sorted(pasta.glob(f"{as_of}.r*.json.gz"))
    for arq in existentes:
        # Compara com o hash RECALCULADO pela regra atual, nao com o gravado. Assim,
        # quando um campo passa a ser volatil, o arquivo antigo nao vira revisao falsa.
        try:
            if hash_conteudo(ler(arq)["requests"], fonte) == h:
                return arq, "igual"
        except (OSError, ValueError, KeyError):
            continue
    if not existentes:
        destino, estado = pasta / f"{as_of}.json.gz", "novo"
    else:
        n = 2
        while (pasta / f"{as_of}.r{n}.json.gz").exists():
            n += 1
        destino, estado = pasta / f"{as_of}.r{n}.json.gz", "revisao"
    agora = agora or dt.datetime.now(dt.timezone.utc)
    envelope = {
        "source": fonte,
        "as_of": as_of,
        "fetched_at": agora.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "content_sha256": h,
        "citation": CITACAO.get(fonte, CITACAO["default"]).format(as_of=as_of),
        "license": "CC BY 4.0",
        "requests": requisicoes,
    }
    corpo = json.dumps(envelope, ensure_ascii=False, separators=(",", ":")).encode()
    tmp = destino.with_name(destino.name + ".tmp")
    # mtime=0 deixa o gzip deterministico: mesmo conteudo, mesmos bytes.
    tmp.write_bytes(gzip.compress(corpo, compresslevel=9, mtime=0))
    tmp.replace(destino)
    return destino, estado


def ler(arq):
    return json.loads(gzip.decompress(Path(arq).read_bytes()))


def dia(valor):
    """'2026-09-09' ou '2026-09-09T02:00:00.000Z' -> '2026-09-09'."""
    if not valor:
        return None
    d = str(valor)[:10]
    dt.date.fromisoformat(d)  # valida
    return d


# ---------------------------------------------------------------- fontes

def coletar_tasks(c, **_):
    q = c.get("classifications/task", {"window": "7d"})
    d = q["response"].get("data") or {}
    if not d.get("classifications"):
        raise FonteVazia("nenhuma classificacao")
    soma = sum(x.get("token_share") or 0 for x in d["classifications"])
    if soma > 1.02:
        print(f"::warning::tasks: token_share soma {soma:.3f} (> 1)")
    return dia(d.get("as_of")), [q], f"{len(d['classifications'])} tarefas"


def coletar_sessions(c, **_):
    reqs, linhas, offset = [], 0, 0
    while offset <= 5000:
        q = c.get("datasets/session-cost", {"limit": 500, "offset": offset})
        reqs.append(q)
        n = len(q["response"].get("data") or [])
        linhas += n
        if n < 500:
            break
        offset += 500
    if linhas == 0:
        raise FonteVazia("nenhuma celula")
    meta = reqs[0]["response"].get("meta") or {}
    as_of = dia(meta.get("window_end_date")) or dia(meta.get("as_of"))
    return as_of, reqs, f"{linhas} celulas em {len(reqs)} pagina(s)"


def coletar_benchmarks(c, **_):
    # A consulta geral traz Artificial Analysis, OpenRouter e a arena `models` do
    # Design Arena. A arena `agents` so vem pedida explicitamente. A `builders`
    # voltou vazia na primeira coleta real, com as_of igual ao horario da consulta,
    # e ficou de fora.
    reqs = [
        c.get("benchmarks", {"include_run_config": "true"}),
        c.get("benchmarks", {"source": "design-arena", "arena": "agents"}),
    ]
    itens = sum(len(q["response"].get("data") or []) for q in reqs)
    if len(reqs[0]["response"].get("data") or []) == 0:
        raise FonteVazia("consulta geral vazia")
    # So respostas com dado informam a data: resposta vazia devolve o horario da consulta.
    datas = [dia((q["response"].get("meta") or {}).get("as_of")) for q in reqs
             if q["response"].get("data")]
    datas = [x for x in datas if x]
    return (max(datas) if datas else None), reqs, f"{itens} itens"


def top_modelos(n=TOP_ENDPOINTS):
    """Os n maiores modelos dos ultimos 7 dias do ranking, com o id da API."""
    r = pd.read_csv(DATA / "rankings_daily.csv", parse_dates=["date"])
    r = r[r["model_permaslug"] != "other"]
    ult = r["date"].max()
    r = r[r["date"] > ult - pd.Timedelta(days=7)]
    r = r.assign(slug=r["model_permaslug"].str.split(":").str[0])
    vol = r.groupby("slug")["total_tokens"].sum().sort_values(ascending=False)
    cat = pd.read_csv(DATA / "models_catalog.csv")
    ids = dict(zip(cat["canonical_slug"], cat["model_id"].str.split(":").str[0]))
    saida, sem_id = [], []
    for slug in vol.index:
        (saida if slug in ids else sem_id).append(ids.get(slug, slug))
        if len(saida) == n:
            break
    return saida, sem_id


def coletar_endpoints(c, agora=None, **_):
    modelos, sem_id = top_modelos()
    if sem_id:
        print(f"  {len(sem_id)} modelo(s) do topo sem id no catalogo, ignorados: {', '.join(sem_id[:5])}")
    reqs, falhas = [], []
    for m in modelos:
        try:
            reqs.append(c.get(f"models/{m}/endpoints", com_chave=False))
        except RuntimeError as e:
            falhas.append(f"{m}: {e}")
    if len(reqs) < 0.8 * len(modelos):
        raise FonteVazia(f"so {len(reqs)}/{len(modelos)} modelos. " + "; ".join(falhas[:3]))
    for f in falhas:
        print(f"::warning::endpoints {f}")
    agora = agora or dt.datetime.now(dt.timezone.utc)
    return agora.date().isoformat(), reqs, f"{len(reqs)}/{len(modelos)} modelos"


def coletar_apps(c, apps_day=None, agora=None, **_):
    agora = agora or dt.datetime.now(dt.timezone.utc)
    alvo = apps_day or (agora.date() - dt.timedelta(days=1)).isoformat()
    base = {"start_date": alvo, "end_date": alvo, "limit": 100}
    reqs = [
        c.get("datasets/app-rankings", {**base, "sort": "popular", "offset": 0}),
        c.get("datasets/app-rankings", {**base, "sort": "popular", "offset": 100}),
        c.get("datasets/app-rankings", {**base, "sort": "trending"}),
    ]
    reqs += [c.get("datasets/app-rankings", {**base, "category": x}) for x in APP_CATEGORIAS]
    reqs += [c.get("datasets/app-rankings", {**base, "subcategory": x}) for x in APP_SUBCATEGORIAS]
    if not reqs[0]["response"].get("data"):
        raise FonteVazia(f"ranking geral vazio para {alvo}")
    fim = dia((reqs[0]["response"].get("meta") or {}).get("end_date"))
    linhas = sum(len(q["response"].get("data") or []) for q in reqs)
    return fim, reqs, f"{linhas} linhas em {len(reqs)} recortes, dia {fim}"


def _foto_publica(caminho, minimo):
    """Fonte publica de uma chamada so, sem data: grava com o dia UTC da coleta."""
    def coletar(c, agora=None, **_):
        q = c.get(caminho, com_chave=False)
        dados = q["response"].get("data") or []
        if len(dados) < minimo:
            raise FonteVazia(f"{len(dados)} itens, esperado ao menos {minimo}")
        agora = agora or dt.datetime.now(dt.timezone.utc)
        return agora.date().isoformat(), [q], f"{len(dados)} itens"
    return coletar


FONTES = {
    "tasks": coletar_tasks,
    "sessions": coletar_sessions,
    "benchmarks": coletar_benchmarks,
    "endpoints": coletar_endpoints,
    "apps": coletar_apps,
    # Minimos bem abaixo do observado em 10/09 (106, 845, 33, 52, 28): pegam
    # resposta truncada ou vazia sem disparar por variacao normal do catalogo.
    "providers": _foto_publica("providers", 50),
    "zdr": _foto_publica("endpoints/zdr", 200),
    "embeddings": _foto_publica("embeddings/models", 10),
    "images": _foto_publica("images/models", 10),
    "videos": _foto_publica("videos/models", 5),
}
PASTAS = {"tasks": "tasks", "sessions": "sessions", "benchmarks": "benchmarks",
          "endpoints": "endpoints", "apps": "apps", "providers": "providers", "zdr": "zdr",
          "embeddings": "catalogs/embeddings", "images": "catalogs/images",
          "videos": "catalogs/videos"}


# ---------------------------------------------------------------- main

def rodar(fontes, cliente, base=None, **kw):
    falhas = []
    for nome in fontes:
        print(f"[{nome}]")
        try:
            as_of, reqs, resumo = FONTES[nome](cliente, **kw)
            if not as_of:
                raise FonteVazia("a fonte nao informou data")
            arq, estado = gravar(nome, as_of, reqs, base=base, agora=kw.get("agora"))
            print(f"  {resumo} -> {arq} ({estado})")
        except Exception as e:  # uma fonte nao derruba as outras
            falhas.append(nome)
            print(f"::error::{nome}: {e}")
    print(f"Chamadas: {cliente.chamadas_com_chave} com chave, {cliente.chamadas_publicas} publicas")
    return falhas


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="", help="fontes separadas por virgula")
    ap.add_argument("--apps-day", default=None, help="dia UTC para apps (AAAA-MM-DD)")
    ap.add_argument("--out", default=None, help="pasta raiz de saida (padrao: data/)")
    a = ap.parse_args(argv)
    fontes = [x.strip() for x in a.only.split(",") if x.strip()] or list(FONTES)
    desconhecidas = [x for x in fontes if x not in FONTES]
    if desconhecidas:
        print(f"Fonte desconhecida: {desconhecidas}. Opcoes: {list(FONTES)}", file=sys.stderr)
        return 2
    if a.apps_day:
        dt.date.fromisoformat(a.apps_day)
    token = os.environ.get("OPENROUTER_API_KEY")
    if not token and any(f not in PUBLICAS for f in fontes):
        print("OPENROUTER_API_KEY nao definida", file=sys.stderr)
        return 2
    falhas = rodar(fontes, Cliente(token), base=a.out, apps_day=a.apps_day)
    if falhas:
        print(f"Falharam: {', '.join(falhas)}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
