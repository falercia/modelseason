"""Gera os JSON que a v2 (Next.js) le no build: data/web/{agora,mercado,modelos}.json.

Por que existe: o data.json da v1 so enxerga semanas FECHADAS, entao a pagina
mostrava dez dias de atraso. O bloco "Agora" le o dado DIARIO, ate o ultimo dia
publicado pela fonte. E as fontes sem historico (tarefas, apps, sessoes,
benchmarks, provedores) so existem nos snapshots de data/<fonte>/, que o
build.py nao conhece.

Regras que valem para todo numero daqui:
- Denominador de share inclui a linha `other` da fonte, como na v1.
- Variantes de endpoint (`:free`, `:thinking`...) sao somadas no slug base: e o
  mesmo modelo servido de outro jeito, nao outro modelo.
- Ausencia nao vira zero. Modelo sem benchmark fica sem benchmark; lider por
  criterio so e declarado quando ha dado para o criterio.
- Toda janela e fechada no ultimo dia publicado pela fonte, nunca no relogio.

Uso: python pipeline/build_web.py
"""
import gzip
import json
import math
import re
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import taxonomia as tx  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
OUT = DATA / "web"
BLEND_PROMPT = 0.75  # mesma mistura declarada no enrich.py

LAB = {
    "deepseek": "DeepSeek", "google": "Google", "anthropic": "Anthropic", "openai": "OpenAI",
    "xiaomi": "Xiaomi", "tencent": "Tencent", "minimax": "MiniMax", "z-ai": "Z.ai (GLM)",
    "x-ai": "xAI", "nvidia": "NVIDIA", "mistralai": "Mistral AI", "moonshotai": "Moonshot AI",
    "thinkingmachines": "Thinking Machines", "stepfun": "StepFun", "inclusionai": "InclusionAI",
    "poolside": "Poolside", "upstage": "Upstage", "qwen": "Qwen", "meta": "Meta",
    "meta-llama": "Meta", "alibaba": "Alibaba", "bytedance": "ByteDance",
    "bytedance-seed": "ByteDance", "arcee-ai": "Arcee AI", "cohere": "Cohere",
    "microsoft": "Microsoft", "amazon": "Amazon", "perplexity": "Perplexity",
    "liquid": "Liquid AI", "baai": "BAAI", "kwaipilot": "KwaiPilot", "nex-agi": "Nex AGI",
    "dots-studio": "Dots Studio", "tngtech": "TNG", "nousresearch": "Nous Research",
    "openchat": "OpenChat", "ibm-granite": "IBM Granite", "stealth": "Anônimo (stealth)",
    "openrouter": "Teste anônimo", "aion-labs": "AionLabs",
}

# Traducao dos rotulos de tarefa da fonte. Chave desconhecida cai no rotulo original.
TAREFA_PT = {
    "classification_tagging": "Classificação", "data:extraction": "Extração de dados",
    "agent:workflow_execution": "Execução de fluxos", "roleplay_fiction": "Roleplay e ficção",
    "data:transformation": "Transformação de dados", "code:general_impl": "Geração de código",
    "content_writing": "Redação de conteúdo", "translation": "Tradução",
    "qa_knowledge": "Perguntas e conhecimento", "agent:multi_step_planning": "Planejamento em etapas",
    "conversational_reply": "Conversa", "code:debugging": "Depuração",
    "summarization": "Resumo", "agent:tool_dispatch": "Chamada de ferramentas",
    "code:file_read_write": "Leitura e escrita de arquivos", "customer_support": "Atendimento",
    "code:shell_execution": "Execução em terminal", "code:review_security": "Revisão de código",
    "agent:memory_extraction": "Extração de memória", "code:frontend_ui": "Frontend e interface",
    "research_report": "Pesquisa e relatórios", "agent:web_search": "Busca na web",
    "math": "Matemática", "code:repo_scan": "Varredura de repositório",
    "finance_trading": "Finanças e trading", "security_audit": "Auditoria de segurança",
    "code:devops_config": "Configuração de DevOps", "code:sql_database": "SQL e banco de dados",
    "devops": "DevOps",
}
MACRO_PT = {"code": "Código", "data": "Dados", "agent": "Agentes", "general": "Uso geral"}
CATEGORIA_APP_PT = {"coding": "Programação", "creative": "Criação", "productivity": "Produtividade",
                    "entertainment": "Entretenimento"}
TURNOS_PT = {"1-turn": "1 turno", "2-9-turns": "2 a 9 turnos", "10-49-turns": "10 a 49 turnos",
             "50-plus-turns": "50 turnos ou mais"}


def r(v, casas=2):
    if v is None or (isinstance(v, float) and (math.isnan(v) or math.isinf(v))):
        return None
    return round(float(v), casas)


def lab_de(slug):
    v = slug.split("/")[0]
    return LAB.get(v, v.replace("-", " ").title())


def ler_snapshot(pasta):
    """O arquivo mais recente de data/<pasta>/, contando revisoes (.rN)."""
    arqs = sorted((DATA / pasta).glob("*.json.gz"))
    if not arqs:
        return None
    def chave(p):
        nome = p.name.replace(".json.gz", "")
        base, _, rev = nome.partition(".r")
        return (base, int(rev) if rev else 1)
    arq = max(arqs, key=chave)
    return json.loads(gzip.decompress(arq.read_bytes()))


# ------------------------------------------------------------------ base

def carregar():
    df = pd.read_csv(DATA / "rankings_daily.csv", parse_dates=["date"], dtype={"total_tokens": "int64"})
    df = df.drop_duplicates(["date", "model_permaslug"])
    df["base"] = df.model_permaslug.str.split(":").str[0]
    df["free"] = df.model_permaslug.str.endswith(":free")
    cat = pd.read_csv(DATA / "models_catalog.csv").set_index("canonical_slug")
    return df, cat


def meta_modelo(slug, cat):
    vendor = slug.split("/")[0]
    m = {"slug": slug, "lab": lab_de(slug), "vendor": vendor,
         "origem": tx.origin(vendor), "pesos": tx.openw(slug)}
    if slug in cat.index:
        c = cat.loc[slug]
        nome = c["name"] if isinstance(c["name"], str) else None
        if nome and ": " in nome:
            nome = nome.split(": ", 1)[1]
        pp, pc = c.get("price_prompt"), c.get("price_completion")
        misto = None
        if pd.notna(pp) and pd.notna(pc):
            misto = (BLEND_PROMPT * pp + (1 - BLEND_PROMPT) * pc) * 1e6
        if isinstance(c.get("hugging_face_id"), str) and c.get("hugging_face_id"):
            m["pesos"] = "Open-weights"
        m.update({
            "nome": nome,
            "model_id": c.get("model_id") if isinstance(c.get("model_id"), str) else None,
            "lancamento": c.get("created_at") if isinstance(c.get("created_at"), str) else None,
            "contexto": int(c["context_length"]) if pd.notna(c.get("context_length")) else None,
            "preco_entrada": r(pp * 1e6, 4) if pd.notna(pp) else None,
            "preco_saida": r(pc * 1e6, 4) if pd.notna(pc) else None,
            "preco_misto": r(misto, 4),
            "modalidade": c.get("modality") if isinstance(c.get("modality"), str) else None,
            "raciocinio": bool(c["reasoning"]) if pd.notna(c.get("reasoning")) else None,
            "aa_inteligencia": r(c.get("aa_intelligence"), 1),
            "aa_codigo": r(c.get("aa_coding"), 1),
            "aa_agentes": r(c.get("aa_agentic"), 1),
            "ativo_no_catalogo": bool(c.get("active")) if pd.notna(c.get("active")) else None,
        })
    if not m.get("nome"):
        # Fora do catalogo: o slug sem a data da versao, que e o nome menos ruim.
        cauda = slug.split("/")[-1]
        cauda = re.sub(r"-20\d{6}$", "", cauda)
        m["nome"] = re.sub(r"-20\d{2}-\d{2}-\d{2}$", "", cauda)
    return m


def nome_curto(slug, cat, fallback=None):
    """Nome do catalogo; se o modelo nao esta no catalogo, o nome que a fonte deu."""
    if slug in cat.index or not fallback:
        return meta_modelo(slug, cat)["nome"]
    nome = fallback.split(": ", 1)[-1]
    return nome.split(" (")[0].strip()


# ------------------------------------------------------------------ agora

def janela(df, ini, fim):
    return df[(df.date >= ini) & (df.date <= fim)]


def shares(dfj):
    tot = float(dfj.total_tokens.sum())
    s = dfj[dfj.base != "other"].groupby("base").total_tokens.sum().sort_values(ascending=False)
    return s, tot


def construir_agora(df, cat):
    ult = df.date.max()
    d = pd.Timedelta
    j7 = (ult - d(days=6), ult)
    p7 = (ult - d(days=13), ult - d(days=7))
    j30 = (ult - d(days=29), ult)
    p30 = (ult - d(days=59), ult - d(days=30))
    s7, t7 = shares(janela(df, *j7))
    sp7, tp7 = shares(janela(df, *p7))
    s30, t30 = shares(janela(df, *j30))
    sp30, tp30 = shares(janela(df, *p30))

    primeira = df[df.base != "other"].groupby("base").date.min()
    def rank_de(serie):
        return {k: i + 1 for i, k in enumerate(serie.index)}
    rk_p7, rk_p30 = rank_de(sp7), rank_de(sp30)

    def linha(slug, s, tot, rk_prev, sp, tp, ini_janela):
        m = meta_modelo(slug, cat)
        share = 100 * s[slug] / tot
        prev = 100 * sp.get(slug, 0) / tp if tp else 0
        estreou = primeira.get(slug) is not None and primeira[slug] >= ini_janela
        return {
            "slug": slug, "nome": m["nome"], "lab": m["lab"], "vendor": m["vendor"], "origem": m["origem"],
            "pesos": m["pesos"], "share": r(share), "T": r(s[slug] / 1e12, 2),
            "share_anterior": r(prev), "delta_pp": r(share - prev),
            "rank_anterior": rk_prev.get(slug), "estreou": bool(estreou),
            "lancamento": m.get("lancamento"),
        }

    top7 = [linha(k, s7, t7, rk_p7, sp7, tp7, j7[0]) for k in s7.index[:10]]
    top30 = [linha(k, s30, t30, rk_p30, sp30, tp30, j30[0]) for k in s30.index[:10]]

    # movimentos: variacao em pp entre as duas janelas de 7 dias, sobre o universo das duas
    univ = set(s7.index) | set(sp7.index)
    mov = []
    for k in univ:
        a = 100 * sp7.get(k, 0) / tp7 if tp7 else 0
        b = 100 * s7.get(k, 0) / t7 if t7 else 0
        if max(a, b) < 0.3:
            continue
        m = meta_modelo(k, cat)
        mov.append({"slug": k, "nome": m["nome"], "lab": m["lab"], "origem": m["origem"],
                    "de": r(a), "para": r(b), "delta_pp": r(b - a),
                    "estreou": bool(primeira.get(k) is not None and primeira[k] >= j7[0])})
    subiram = sorted([x for x in mov if x["delta_pp"] > 0], key=lambda x: -x["delta_pp"])[:5]
    cairam = sorted([x for x in mov if x["delta_pp"] < 0], key=lambda x: x["delta_pp"])[:5]

    # estreias: primeira aparicao na serie inteira dentro da janela de 7 dias
    novos = [k for k in s7.index if primeira.get(k) is not None and primeira[k] >= j7[0]]
    estreias = []
    for k in novos:
        m = meta_modelo(k, cat)
        estreias.append({"slug": k, "nome": m["nome"], "lab": m["lab"], "share": r(100 * s7[k] / t7),
                         "primeiro_dia": primeira[k].strftime("%Y-%m-%d"), "lancamento": m.get("lancamento")})

    # idade do topo
    idade = []
    for x in top7[:6]:
        if x["lancamento"]:
            dias = (ult - pd.Timestamp(x["lancamento"])).days
            idade.append({"slug": x["slug"], "nome": x["nome"], "lab": x["lab"], "dias": int(dias), "share": x["share"]})

    # termometro
    j7df = janela(df, *j7)
    tot_tok = float(j7df.total_tokens.sum())
    nomeados = j7df[j7df.base != "other"].groupby(["base", "free"]).total_tokens.sum().reset_index()
    gasto, tok_com_preco = 0.0, 0.0
    for _, row in nomeados.iterrows():
        m = meta_modelo(row.base, cat)
        if m.get("preco_misto") is None:
            continue
        tok_com_preco += row.total_tokens
        if not row.free:
            gasto += row.total_tokens / 1e6 * m["preco_misto"]
    # Mesma definicao da serie historica da v1: gasto dividido pelo volume TOTAL,
    # com o que nao tem preco contando como zero. A cobertura vai junto.
    preco_efetivo = gasto / (tot_tok / 1e6) if tot_tok else None
    vals = s7.values
    top5 = 100 * vals[:5].sum() / t7 if t7 else None
    nom = vals.sum()
    hhi = float(((100 * vals / nom) ** 2).sum()) if nom else None
    por_origem, por_pesos = {}, {}
    for k, v in s7.items():
        m = meta_modelo(k, cat)
        por_origem[m["origem"]] = por_origem.get(m["origem"], 0) + v
        por_pesos[m["pesos"]] = por_pesos.get(m["pesos"], 0) + v
    china = 100 * por_origem.get("China", 0) / t7
    abertos = 100 * por_pesos.get("Open-weights", 0) / t7
    diario = df.groupby("date").total_tokens.sum()
    ult30 = diario[diario.index >= j30[0]]

    termometro = {
        "volume_7d_T": r(t7 / 1e12, 1), "volume_7d_ant_T": r(tp7 / 1e12, 1),
        "crescimento_7d_pct": r(100 * (t7 / tp7 - 1), 1) if tp7 else None,
        "volume_30d_T": r(t30 / 1e12, 1),
        "crescimento_30d_pct": r(100 * (t30 / tp30 - 1), 1) if tp30 else None,
        "modelos_ativos_7d": int((s7 > 0).sum()), "modelos_ativos_30d": int((s30 > 0).sum()),
        "preco_efetivo": r(preco_efetivo, 2),
        "preco_cobertura_pct": r(100 * tok_com_preco / tot_tok, 0) if tot_tok else None,
        "top5_pct": r(top5, 1), "hhi": int(round(hhi)) if hhi else None,
        "china_pct": r(china, 1), "abertos_pct": r(abertos, 1), "estreias": len(estreias),
        "diario_30d": [{"d": k.strftime("%Y-%m-%d"), "T": r(v / 1e12, 2)} for k, v in ult30.items()],
    }

    manchete = escrever_manchete(top7, subiram, estreias, idade, top30)
    mudou = o_que_mudou(top7, sp7, tp7, subiram, cairam, estreias, cat)

    return {
        "ultimo_dia": ult.strftime("%Y-%m-%d"),
        "janelas": {"7d": [j7[0].strftime("%Y-%m-%d"), j7[1].strftime("%Y-%m-%d")],
                    "7d_anterior": [p7[0].strftime("%Y-%m-%d"), p7[1].strftime("%Y-%m-%d")],
                    "30d": [j30[0].strftime("%Y-%m-%d"), j30[1].strftime("%Y-%m-%d")]},
        "top7": top7, "top30": top30, "subiram": subiram, "cairam": cairam,
        "estreias": sorted(estreias, key=lambda x: -x["share"]), "idade_topo": idade,
        "termometro": termometro, "manchete": manchete, "mudou": mudou,
    }


def pp(v):
    return f"{v:.1f}".replace(".", ",")


def escrever_manchete(top7, subiram, estreias, idade, top30):
    """Manchete por regra, em ordem de prioridade. Nenhuma frase sem numero medido."""
    novo_no_topo = [x for x in idade if x["dias"] <= 21 and x["slug"] in [t["slug"] for t in top7[:3]]]
    if novo_no_topo:
        x = novo_no_topo[0]
        sub = next((s for s in subiram if s["slug"] == x["slug"]), None)
        detalhe = (f"{x['nome']} ({x['lab']}) foi de {pp(sub['de'])}% para {pp(sub['para'])}% em uma semana."
                   if sub else f"{x['nome']} ({x['lab']}) está entre os três mais usados da semana.")
        return {"regra": "lancamento_recente_no_topo",
                "titulo": f"Um modelo lançado há {x['dias']} dias já leva {pp(x['share'])}% do tráfego.",
                "destaques": [f"{x['dias']} dias", f"{pp(x['share'])}%"],
                "texto": detalhe + (f" {len(estreias)} modelos estrearam nos últimos sete dias." if estreias else "")}
    if subiram and subiram[0]["delta_pp"] >= 3:
        s = subiram[0]
        return {"regra": "maior_alta",
                "titulo": f"{s['nome']} ganhou {pp(s['delta_pp'])} pontos de share em uma semana.",
                "destaques": [f"{pp(s['delta_pp'])} pontos"],
                "texto": f"Saiu de {pp(s['de'])}% para {pp(s['para'])}% do volume. É a maior alta entre as duas últimas janelas de sete dias."}
    if top7 and top7[0]["rank_anterior"] not in (None, 1):
        x = top7[0]
        return {"regra": "troca_de_lider",
                "titulo": f"{x['nome']} assumiu a liderança com {pp(x['share'])}% do tráfego.",
                "destaques": [f"{pp(x['share'])}%"],
                "texto": f"Na semana anterior ele era o {x['rank_anterior']}º."}
    x = top7[0]
    return {"regra": "lider_estavel", "titulo": f"{x['nome']} segue na liderança, com {pp(x['share'])}% do tráfego.",
            "destaques": [f"{pp(x['share'])}%"], "texto": f"Em 30 dias, o líder é {top30[0]['nome']}."}


def o_que_mudou(top7, sp7, tp7, subiram, cairam, estreias, cat):
    """Ate tres mudancas, cada uma com evidencia e o que observar. Sem causa inventada."""
    itens = []
    if subiram:
        s = subiram[0]
        itens.append({"tipo": "subiu", "slug": s["slug"],
                      "titulo": f"{s['nome']} ganhou espaço",
                      "evidencia": f"Share de {pp(s['de'])}% para {pp(s['para'])}% entre as duas últimas janelas de 7 dias (+{pp(s['delta_pp'])} pp).",
                      "observar": "Uma semana é pico ou tendência? A regra só chama de sustentado quando a alta se repete em janelas sem sobreposição."})
    if cairam:
        c = cairam[0]
        mesmo_lab = next((s for s in subiram if s["lab"] == c["lab"] and s["slug"] != c["slug"]), None)
        obs = (f"No mesmo laboratório, {mesmo_lab['nome']} subiu {pp(mesmo_lab['delta_pp'])} pp. A queda coincide com a troca de geração, o que não prova migração."
               if mesmo_lab else "Queda de share pode ser crescimento dos outros. Confira o volume absoluto na página do modelo antes de concluir.")
        itens.append({"tipo": "caiu", "slug": c["slug"], "titulo": f"{c['nome']} perdeu espaço",
                      "evidencia": f"Share de {pp(c['de'])}% para {pp(c['para'])}% ({pp(c['delta_pp'])} pp).",
                      "observar": obs})
    if estreias:
        e = max(estreias, key=lambda x: x["share"])
        itens.append({"tipo": "estreou", "slug": e["slug"], "titulo": f"{e['nome']} estreou",
                      "evidencia": f"Primeiro volume registrado em {e['primeiro_dia']}, já com {pp(e['share'])}% do tráfego da semana.",
                      "observar": "Estreia no roteador não é data de lançamento, e share de estreia costuma incluir tráfego de teste."})
    return itens[:3]


# ------------------------------------------------------------------ lideres

def construir_lideres(agora, cat):
    """Seis destaques, cada um com criterio, periodo e fonte. Sem 'melhor IA'."""
    bench = ler_snapshot("benchmarks")
    aa = []
    as_of_aa = None
    if bench:
        for q in bench["requests"]:
            for it in q["response"].get("data") or []:
                if it.get("source") == "artificial-analysis":
                    aa.append(it)
            meta = q["response"].get("meta") or {}
        as_of_aa = bench.get("as_of")
    def melhor(campo):
        cand = [x for x in aa if x.get(campo) is not None]
        if not cand:
            return None
        ordem = sorted(cand, key=lambda i: -i[campo])
        x = ordem[0]
        base = x["model_permaslug"].split(":")[0]
        vice = ordem[1] if len(ordem) > 1 else None
        # A fonte nao publica incerteza. Empate no valor publicado vira grupo de
        # lideres, nunca "vantagem" de quem aparece primeiro na lista.
        empatados = [o for o in ordem if r(o[campo], 1) == r(x[campo], 1)]
        return {"slug": base, "nome": nome_curto(base, cat, x.get("display_name")), "lab": lab_de(base),
                "valor": r(x[campo], 1),
                "empate": [{"slug": o["model_permaslug"].split(":")[0],
                            "nome": nome_curto(o["model_permaslug"].split(":")[0], cat, o.get("display_name"))}
                           for o in empatados] if len(empatados) > 1 else None,
                "vice": ({"nome": nome_curto(vice["model_permaslug"].split(":")[0], cat, vice.get("display_name")),
                          "valor": r(vice[campo], 1)} if vice else None),
                "n": len(cand)}
    t = agora["top7"][0]
    sub = agora["subiram"][0] if agora["subiram"] else None
    # economico: menor preco misto entre os 10 maiores indices de inteligencia
    eco = None
    cand = []
    for x in aa:
        if x.get("intelligence_index") is None:
            continue
        pr = x.get("pricing") or {}
        try:
            misto = (BLEND_PROMPT * float(pr["prompt"]) + (1 - BLEND_PROMPT) * float(pr["completion"])) * 1e6
        except (KeyError, TypeError, ValueError):
            continue
        if misto <= 0:
            continue
        cand.append((x, misto))
    cand.sort(key=lambda p: -p[0]["intelligence_index"])
    top10 = cand[:10]
    if top10:
        x, misto = min(top10, key=lambda p: p[1])
        base = x["model_permaslug"].split(":")[0]
        eco = {"slug": base, "nome": nome_curto(base, cat, x.get("display_name")), "lab": lab_de(base), "valor": r(misto, 2),
               "inteligencia": r(x["intelligence_index"], 1)}
    fonte_aa = "Artificial Analysis, via OpenRouter"
    return [
        {"id": "inteligencia", "rotulo": "Avaliação geral", "tipo": "desempenho em avaliação",
         "criterio": "Maior índice de inteligência da Artificial Analysis entre os modelos avaliados",
         "fonte": fonte_aa, "as_of": as_of_aa, "unidade": "índice", **(melhor("intelligence_index") or {})},
        {"id": "codigo", "rotulo": "Programação", "tipo": "desempenho em avaliação",
         "criterio": "Maior índice de código da Artificial Analysis",
         "fonte": fonte_aa, "as_of": as_of_aa, "unidade": "índice", **(melhor("coding_index") or {})},
        {"id": "agentes", "rotulo": "Agentes", "tipo": "desempenho em avaliação",
         "criterio": "Maior índice agêntico da Artificial Analysis",
         "fonte": fonte_aa, "as_of": as_of_aa, "unidade": "índice", **(melhor("agentic_index") or {})},
        {"id": "uso", "rotulo": "Uso", "tipo": "uso observado",
         "criterio": "Maior share de tokens nos últimos 7 dias fechados",
         "fonte": "OpenRouter, rankings diários", "as_of": agora["ultimo_dia"], "unidade": "%",
         "slug": t["slug"], "nome": t["nome"], "lab": t["lab"], "valor": t["share"],
         "vice": {"nome": agora["top7"][1]["nome"], "valor": agora["top7"][1]["share"]}},
        {"id": "ganho", "rotulo": "Ganho de participação", "tipo": "uso observado",
         "criterio": "Maior alta de share em pontos percentuais, 7 dias contra os 7 anteriores",
         "fonte": "OpenRouter, rankings diários", "as_of": agora["ultimo_dia"], "unidade": "pp",
         **({"slug": sub["slug"], "nome": sub["nome"], "lab": sub["lab"], "valor": sub["delta_pp"]} if sub else {})},
        {"id": "economico", "rotulo": "Opção econômica", "tipo": "adequação a um cenário",
         "criterio": "Menor preço por 1M de tokens (mistura 75% entrada, 25% saída) entre os 10 maiores índices de inteligência",
         "fonte": fonte_aa + ", preços do catálogo", "as_of": as_of_aa, "unidade": "US$/1M", **(eco or {})},
    ]


# ------------------------------------------------------------------ mercado (fontes sem historico)

def construir_mercado(cat):
    out = {}
    t = ler_snapshot("tasks")
    if t:
        d = t["requests"][0]["response"]["data"]
        cls = []
        for c in sorted(d["classifications"], key=lambda c: -c["token_share"]):
            modelos = []
            for m in c.get("models") or []:
                base = m["id"].split(":")[0]
                # a fonte usa o id da API; o catalogo mapeia para o slug canonico
                slug = next((s for s, row in cat.iterrows() if row.get("model_id") == base), base)
                modelos.append({"id": base, "slug": slug, "nome": nome_curto(slug, cat), "lab": lab_de(slug),
                                "token_share": r(100 * m["tag_token_share"], 1)})
            cls.append({"tag": c["tag"], "nome": TAREFA_PT.get(c["tag"], c["display_name"]),
                        "nome_fonte": c["display_name"], "macro": c["macro_category"],
                        "token_share": r(100 * c["token_share"], 2), "usage_share": r(100 * c["usage_share"], 2),
                        "modelos": modelos})
        out["tarefas"] = {
            "as_of": d["as_of"], "janela_dias": d["window_days"],
            "macro": [{"key": m["key"], "nome": MACRO_PT.get(m["key"], m["label"]),
                       "token_share": r(100 * m["token_share"], 1), "usage_share": r(100 * m["usage_share"], 1)}
                      for m in sorted(d["macro_categories"], key=lambda m: -m["token_share"])],
            "classificacoes": cls,
            "fotos_arquivadas": len(list((DATA / "tasks").glob("*.json.gz"))),
        }
    a = ler_snapshot("apps")
    if a:
        reqs = a["requests"]
        def linhas(q, n):
            return [{"rank": x["rank"], "app_id": x["app_id"], "nome": x["app_name"],
                     "T": r(int(x["total_tokens"]) / 1e12, 3), "requisicoes": x.get("total_requests")}
                    for x in (q["response"].get("data") or [])[:n]]
        geral = next(q for q in reqs if q["params"].get("sort") == "popular" and q["params"].get("offset") == 0 and "category" not in q["params"] and "subcategory" not in q["params"])
        trend = next((q for q in reqs if q["params"].get("sort") == "trending"), None)
        cats = {q["params"]["category"]: q for q in reqs if "category" in q["params"]}
        subs = {q["params"]["subcategory"]: q for q in reqs if "subcategory" in q["params"]}
        tot_top = sum(int(x["total_tokens"]) for x in geral["response"]["data"])
        out["apps"] = {
            "dia": a["as_of"], "geral": linhas(geral, 15), "tendencia": linhas(trend, 8) if trend else [],
            "categorias": [{"key": k, "nome": CATEGORIA_APP_PT.get(k, k), "apps": linhas(q, 5)} for k, q in cats.items()],
            "subcategorias": [{"key": k, "apps": linhas(q, 3)} for k, q in subs.items() if q["response"].get("data")],
            "tokens_top100_T": r(tot_top / 1e12, 2),
        }
    s = ler_snapshot("sessions")
    if s:
        rows = [x for q in s["requests"] for x in q["response"].get("data") or []]
        meta = s["requests"][0]["response"].get("meta") or {}
        harness = {}
        for x in rows:
            h = harness.setdefault(x["app_slug"], {"slug": x["app_slug"], "nome": x["app_name"], "celulas": []})
            base = x["model_permaslug"].split(":")[0]
            h["celulas"].append({"slug": base, "nome": nome_curto(base, cat), "lab": lab_de(base),
                                 "turnos": x["turn_range"], "custo": r(x["median_session_cost_usd"], 4)})
        # por harness e faixa de turnos: mediana entre modelos, minimo e maximo
        resumo = []
        for h in harness.values():
            for faixa in TURNOS_PT:
                cs = sorted(c["custo"] for c in h["celulas"] if c["turnos"] == faixa and c["custo"] is not None)
                if not cs:
                    continue
                med = cs[len(cs) // 2] if len(cs) % 2 else (cs[len(cs) // 2 - 1] + cs[len(cs) // 2]) / 2
                resumo.append({"harness": h["nome"], "turnos": faixa, "turnos_nome": TURNOS_PT[faixa],
                               "modelos": len(cs), "mediana": r(med, 4), "min": r(cs[0], 4), "max": r(cs[-1], 4)})
        out["sessoes"] = {"janela_fim": meta.get("window_end_date"), "janela_dias": meta.get("window_days"),
                          "as_of": meta.get("as_of"), "harness": list(harness.values()), "resumo": resumo}
    b = ler_snapshot("benchmarks")
    if b:
        items = [x for q in b["requests"] for x in q["response"].get("data") or []]
        evals = []
        for x in items:
            if x.get("source") != "openrouter":
                continue
            base = x["model_permaslug"].split(":")[0]
            evals.append({"slug": base, "nome": nome_curto(base, cat), "lab": lab_de(base),
                          "tipo": x.get("benchmark_type"),
                          "score": r(x.get("accuracy", x.get("primary_score")), 4),
                          "custo_tarefa": r(x.get("avg_cost_per_task"), 4), "tarefas": x.get("total_tasks")})
        aa = [x for x in items if x.get("source") == "artificial-analysis"]
        out["benchmarks"] = {"as_of": b["as_of"], "evals": evals,
                             "fontes": {k: sum(1 for x in items if x.get("source") == k)
                                        for k in ("artificial-analysis", "design-arena", "openrouter")},
                             "aa_modelos": len(aa)}
    p = ler_snapshot("providers")
    z = ler_snapshot("zdr")
    if p:
        provs = p["requests"][0]["response"]["data"]
        sede = {}
        for x in provs:
            k = x.get("headquarters") or "Não informado"
            sede[k] = sede.get(k, 0) + 1
        out["provedores"] = {"dia": p["as_of"], "total": len(provs),
                             "por_sede": sorted([{"pais": k, "n": v} for k, v in sede.items()], key=lambda x: -x["n"])}
    if z:
        eps = z["requests"][0]["response"]["data"]
        out["zdr"] = {"dia": z["as_of"], "endpoints": len(eps), "modelos": len({e["model_id"] for e in eps}),
                      "provedores": len({e["provider_name"] for e in eps})}
    return out


# ------------------------------------------------------------------ modelos

def construir_modelos(df, cat, agora, mercado):
    df = df.copy()
    df["week"] = df.date.dt.to_period("W-SUN").dt.start_time
    completas = df.groupby("week").date.nunique()
    completas = completas[completas == 7].index
    dw = df[df.week.isin(completas)]
    semanas = sorted(dw.week.unique())
    tot_w = dw.groupby("week").total_tokens.sum()
    por = dw[dw.base != "other"].groupby(["base", "week"]).total_tokens.sum()
    ult = df.date.max()
    j7 = ult - pd.Timedelta(days=6)
    s7, t7 = shares(janela(df, j7, ult))
    rank7 = {k: i + 1 for i, k in enumerate(s7.index)}
    top10_por_semana = {}
    for w in semanas:
        ss = por.xs(w, level="week") if w in por.index.get_level_values("week") else pd.Series(dtype=float)
        top10_por_semana[w] = set(ss.sort_values(ascending=False).index[:10])

    tarefas_por_modelo = {}
    for c in (mercado.get("tarefas") or {}).get("classificacoes", []):
        for m in c["modelos"]:
            tarefas_por_modelo.setdefault(m["slug"], []).append(
                {"tag": c["tag"], "nome": c["nome"], "macro": c["macro"], "share_na_tarefa": m["token_share"],
                 "peso_da_tarefa": c["token_share"]})

    endpoints = {}
    e = ler_snapshot("endpoints")
    zdr_ids = set()
    z = ler_snapshot("zdr")
    if z:
        zdr_ids = {(x["model_id"], x["provider_name"]) for x in z["requests"][0]["response"]["data"]}
    if e:
        for q in e["requests"]:
            d = q["response"].get("data") or {}
            mid = d.get("id")
            lst = []
            for ep in d.get("endpoints") or []:
                pr = ep.get("pricing") or {}
                try:
                    pe, ps = float(pr.get("prompt", "nan")) * 1e6, float(pr.get("completion", "nan")) * 1e6
                except (TypeError, ValueError):
                    pe = ps = None
                lst.append({"provedor": ep.get("provider_name"), "entrada": r(pe, 3), "saida": r(ps, 3),
                            "contexto": ep.get("context_length"), "quantizacao": ep.get("quantization"),
                            "zdr": (ep.get("model_id"), ep.get("provider_name")) in zdr_ids})
            endpoints[mid] = sorted(lst, key=lambda x: (x["entrada"] is None, x["entrada"] or 0))

    bench = {}
    for ev in (mercado.get("benchmarks") or {}).get("evals", []):
        bench.setdefault(ev["slug"], []).append({"tipo": ev["tipo"], "score": ev["score"], "custo_tarefa": ev["custo_tarefa"]})

    # Todo modelo citado em qualquer parte da pagina precisa ter pagina, mesmo sem
    # volume semanal: tarefas, sessoes e avaliacoes citam modelos fora do top 50.
    citados = set()
    for c in (mercado.get("tarefas") or {}).get("classificacoes", []):
        citados |= {m["slug"] for m in c["modelos"]}
    for h in (mercado.get("sessoes") or {}).get("harness", []):
        citados |= {x["slug"] for x in h["celulas"]}
    for ev in (mercado.get("benchmarks") or {}).get("evals", []):
        citados.add(ev["slug"])
    for x in agora["top7"] + agora["top30"] + agora["subiram"] + agora["cairam"] + agora["estreias"]:
        citados.add(x["slug"])
    for l in agora.get("lideres", []):
        if l.get("slug"):
            citados.add(l["slug"])
        for e2 in l.get("empate") or []:
            citados.add(e2["slug"])

    modelos = {}
    for base in sorted(set(por.index.get_level_values("base")) | set(s7.index) | citados):
        m = meta_modelo(base, cat)
        serie = []
        for w in semanas:
            v = por.get((base, w), 0)
            serie.append(r(100 * v / tot_w[w], 3) if tot_w[w] else 0)
        vol = [float(por.get((base, w), 0)) for w in semanas]
        if max(serie or [0]) <= 0 and base not in s7.index and base not in citados:
            continue
        pico_i = max(range(len(serie)), key=lambda i: serie[i]) if serie else None
        prim = next((i for i, v in enumerate(vol) if v > 0), None)
        m.update({
            "serie_share": serie,
            "share_7d": r(100 * s7.get(base, 0) / t7, 2) if t7 else None,
            "rank_7d": rank7.get(base),
            "pico_share": serie[pico_i] if pico_i is not None else None,
            "pico_semana": semanas[pico_i].strftime("%Y-%m-%d") if pico_i is not None and serie[pico_i] > 0 else None,
            "tokens_total_T": r(sum(vol) / 1e12, 2),
            "primeira_semana": semanas[prim].strftime("%Y-%m-%d") if prim is not None else None,
            "semanas_top10": sum(1 for w in semanas if base in top10_por_semana[w]),
            "semanas_com_volume": sum(1 for v in vol if v > 0),
            "tarefas": sorted(tarefas_por_modelo.get(base, []), key=lambda x: -x["share_na_tarefa"]),
            "provedores": endpoints.get(m.get("model_id") or base, []),
            "avaliacoes": bench.get(base, []),
        })
        modelos[base] = m
    return {"semanas": [w.strftime("%Y-%m-%d") for w in semanas], "modelos": modelos}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    df, cat = carregar()
    agora = construir_agora(df, cat)
    mercado = construir_mercado(cat)
    agora["lideres"] = construir_lideres(agora, cat)
    modelos = construir_modelos(df, cat, agora, mercado)
    for nome, obj in (("agora", agora), ("mercado", mercado), ("modelos", modelos)):
        (OUT / f"{nome}.json").write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"agora: ultimo dia {agora['ultimo_dia']}, top7 {agora['top7'][0]['nome']} {agora['top7'][0]['share']}%")
    print(f"mercado: {', '.join(mercado)}")
    print(f"modelos: {len(modelos['modelos'])} paginas possiveis")
    return 0


if __name__ == "__main__":
    sys.exit(main())
